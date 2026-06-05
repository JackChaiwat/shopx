import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Header, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import CurrentActiveUser, CurrentSeller, DBSession
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException, PaymentException
from app.models.models import Notification, NotificationType, Order, OrderStatus, Payment, PaymentMethod, PaymentStatus, Shop
from app.services.inventory import restore_order_stock

logger = structlog.get_logger(__name__)
router = APIRouter()
PAYMENT_EXPIRE_MINUTES = 15


class CreatePaymentRequest(BaseModel):
    order_id: UUID
    method: PaymentMethod
    omise_token: Optional[str] = None  # For Omise card payments
    return_url: Optional[str] = None


class VerifyTransferRequest(BaseModel):
    transaction_id: Optional[str] = None
    note: Optional[str] = None


def _metadata_expires_at(payment: Payment) -> Optional[datetime]:
    raw = payment.payment_metadata.get("expires_at") if payment.payment_metadata else None
    if not raw and payment.method == PaymentMethod.PROMPTPAY and payment.created_at:
        created_at = payment.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return created_at + timedelta(minutes=PAYMENT_EXPIRE_MINUTES)
    if not raw:
        return None
    try:
        expires_at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)
    return expires_at


def _payment_is_expired(payment: Payment) -> bool:
    expires_at = _metadata_expires_at(payment)
    return bool(expires_at and datetime.now(timezone.utc) >= expires_at)


async def expire_promptpay_payment_if_needed(payment: Payment, order: Optional[Order] = None, db=None) -> bool:
    if payment.method != PaymentMethod.PROMPTPAY:
        return False
    if payment.status not in (PaymentStatus.PENDING, PaymentStatus.PROCESSING):
        return False
    if not _payment_is_expired(payment):
        return False

    payment.status = PaymentStatus.CANCELLED
    payment.failed_at = datetime.now(timezone.utc)
    payment.failure_reason = "Payment time expired"
    if order and order.status == OrderStatus.PENDING:
        if db is not None:
            await restore_order_stock(order, db)
        order.status = OrderStatus.CANCELLED
        order.cancelled_at = datetime.now(timezone.utc)
        order.cancel_reason = "Payment time expired"
    return True


def serialize_payment(p: Payment) -> dict:
    # Expiry with stock restore is handled by endpoints/tasks where db is available.
    qr_code_url = p.qr_code_url
    if p.method == PaymentMethod.PROMPTPAY and qr_code_url and not qr_code_url.startswith(("data:", "http://", "https://")):
        qr_code_url = _create_qr_data_url(qr_code_url)
    expires_at = _metadata_expires_at(p)

    return {
        "id": str(p.id),
        "order_id": str(p.order_id),
        "method": p.method.value,
        "status": p.status.value,
        "amount": str(p.amount),
        "currency": p.currency,
        "provider_payment_id": p.provider_payment_id,
        "qr_code_url": qr_code_url,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "is_expired": _payment_is_expired(p),
    }


def _payment_dict(p: Payment) -> dict:
    return serialize_payment(p)


def _add_notification(db: DBSession, user_id, notification_type: NotificationType, title: str, body: str, action_url: Optional[str] = None, metadata: Optional[dict] = None) -> None:
    db.add(Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        action_url=action_url,
        notif_metadata=metadata,
    ))


def _mark_payment_paid(payment: Payment, order: Order, source: str, verified_by: Optional[UUID] = None, transaction_id: Optional[str] = None, note: Optional[str] = None) -> None:
    if order.status == OrderStatus.CANCELLED:
        raise BadRequestException("Order was already cancelled. Please create a new order or handle a refund.")
    if payment.status == PaymentStatus.PAID:
        return
    if payment.status in (PaymentStatus.CANCELLED, PaymentStatus.FAILED):
        raise BadRequestException("This payment is no longer payable")

    payment.status = PaymentStatus.PAID
    payment.paid_at = datetime.now(timezone.utc)
    if transaction_id:
        payment.provider_payment_id = transaction_id

    metadata = dict(payment.payment_metadata or {})
    metadata.update({
        "verified_source": source,
        "verified_at": payment.paid_at.isoformat(),
    })
    if verified_by:
        metadata["verified_by"] = str(verified_by)
    if transaction_id:
        metadata["transaction_id"] = transaction_id
    if note:
        metadata["verification_note"] = note
    payment.payment_metadata = metadata

    if order.status == OrderStatus.PENDING:
        order.status = OrderStatus.CONFIRMED


@router.post("", status_code=201)
async def create_payment(body: CreatePaymentRequest, current_user: CurrentActiveUser, db: DBSession):
    # Validate order
    result = await db.execute(
        select(Order).where(Order.id == body.order_id, Order.buyer_id == current_user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("Order", body.order_id)
    if order.status != OrderStatus.PENDING:
        raise BadRequestException("Order is not in pending state")

    # Check for existing payment
    existing = await db.execute(select(Payment).where(Payment.order_id == order.id))
    existing_payment = existing.scalar_one_or_none()
    if existing_payment:
        expired = await expire_promptpay_payment_if_needed(existing_payment, order, db)
        if expired:
            await db.commit()
            await db.refresh(existing_payment)
        return {"success": True, "data": _payment_dict(existing_payment)}

    payment = Payment(
        order_id=order.id,
        method=body.method,
        amount=order.total_amount,
        currency="THB",
        status=PaymentStatus.PENDING,
    )

    if body.method == PaymentMethod.STRIPE:
        payment_data = await _create_stripe_payment(order, body.return_url)
        payment.provider_payment_id = payment_data["client_secret"]
        payment.payment_metadata = {"stripe_payment_intent_id": payment_data["payment_intent_id"]}

    elif body.method == PaymentMethod.OMISE:
        if not body.omise_token:
            raise BadRequestException("omise_token required for Omise payments")
        payment_data = await _create_omise_charge(order, body.omise_token)
        payment.provider_charge_id = payment_data.get("charge_id")
        if payment_data.get("status") == "successful":
            payment.status = PaymentStatus.PAID
            payment.paid_at = datetime.now(timezone.utc)
            order.status = OrderStatus.CONFIRMED

    elif body.method == PaymentMethod.PROMPTPAY:
        if settings.OMISE_SECRET_KEY:
            payment_data = await _create_omise_promptpay_charge(order, body.return_url)
            payment.provider_charge_id = payment_data.get("charge_id")
            payment.provider_payment_id = payment_data.get("charge_id")
            payment.qr_code_url = payment_data.get("qr_code_url")
            payment.status = PaymentStatus.PROCESSING
            payment.payment_metadata = {
                "gateway": "omise",
                "omise_charge_id": payment_data.get("charge_id"),
                "omise_source_id": payment_data.get("source_id"),
                "omise_status": payment_data.get("status"),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=PAYMENT_EXPIRE_MINUTES)).isoformat(),
            }
            if payment_data.get("status") == "successful":
                payment.status = PaymentStatus.PAID
                payment.paid_at = datetime.now(timezone.utc)
                order.status = OrderStatus.CONFIRMED
        else:
            payment.qr_code_url = _create_promptpay_payload(order)
            payment.status = PaymentStatus.PROCESSING
            payment.payment_metadata = {
                "gateway": "shopx_manual_promptpay",
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=PAYMENT_EXPIRE_MINUTES)).isoformat()
            }

    elif body.method == PaymentMethod.WALLET:
        if current_user.wallet_balance < order.total_amount:
            raise PaymentException("Insufficient wallet balance")
        current_user.wallet_balance -= order.total_amount
        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.now(timezone.utc)
        order.status = OrderStatus.CONFIRMED

    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    logger.info("Payment created", payment_id=str(payment.id), method=body.method.value)
    return {"success": True, "data": _payment_dict(payment)}


async def _create_stripe_payment(order: Order, return_url: Optional[str]) -> dict:
    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

        intent = stripe.PaymentIntent.create(
            amount=int(order.total_amount * 100),  # cents
            currency="thb",
            metadata={"order_id": str(order.id), "order_number": order.order_number},
        )
        return {"client_secret": intent.client_secret, "payment_intent_id": intent.id}
    except Exception as e:
        logger.error("Stripe error", error=str(e))
        raise PaymentException(f"Stripe payment creation failed: {str(e)}")


async def _create_omise_charge(order: Order, token: str) -> dict:
    try:
        import omise
        omise.api_secret = settings.OMISE_SECRET_KEY

        charge = omise.Charge.create(
            amount=int(order.total_amount * 100),
            currency="thb",
            card=token,
            description=f"Order {order.order_number}",
            metadata={"order_id": str(order.id)},
        )
        return {"charge_id": charge.id, "status": charge.status}
    except Exception as e:
        logger.error("Omise error", error=str(e))
        raise PaymentException(f"Omise payment failed: {str(e)}")


def _object_value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _extract_omise_promptpay_qr_url(charge: Any) -> Optional[str]:
    source = _object_value(charge, "source") or {}
    scannable_code = _object_value(source, "scannable_code") or {}
    image = _object_value(scannable_code, "image") or {}
    return _object_value(image, "download_uri")


async def _create_omise_promptpay_charge(order: Order, return_url: Optional[str]) -> dict:
    if not settings.OMISE_SECRET_KEY:
        raise PaymentException("OMISE_SECRET_KEY is not configured")
    try:
        import omise
        omise.api_secret = settings.OMISE_SECRET_KEY

        charge_kwargs = {
            "amount": int(order.total_amount * 100),
            "currency": "thb",
            "source": {"type": "promptpay"},
            "description": f"Order {order.order_number}",
            "metadata": {"order_id": str(order.id), "order_number": order.order_number},
        }
        if return_url:
            charge_kwargs["return_uri"] = return_url

        charge = omise.Charge.create(**charge_kwargs)
        qr_url = _extract_omise_promptpay_qr_url(charge)
        if not qr_url:
            raise PaymentException("Omise did not return a PromptPay QR code")

        source = _object_value(charge, "source") or {}
        return {
            "charge_id": _object_value(charge, "id"),
            "source_id": _object_value(source, "id"),
            "status": _object_value(charge, "status"),
            "qr_code_url": qr_url,
        }
    except PaymentException:
        raise
    except Exception as e:
        logger.error("Omise PromptPay error", error=str(e))
        raise PaymentException(f"Omise PromptPay creation failed: {str(e)}")


def _retrieve_omise_charge(charge_id: str) -> Any:
    import omise
    omise.api_secret = settings.OMISE_SECRET_KEY
    return omise.Charge.retrieve(charge_id)


async def _apply_omise_charge_status(charge: Any, db: DBSession) -> Optional[Payment]:
    charge_id = _object_value(charge, "id")
    status = _object_value(charge, "status")
    if not charge_id:
        raise BadRequestException("Missing Omise charge id")

    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.order))
        .where((Payment.provider_charge_id == charge_id) | (Payment.provider_payment_id == charge_id))
    )
    payment = result.scalar_one_or_none()
    if not payment:
        return None

    metadata = dict(payment.payment_metadata or {})
    metadata.update({
        "gateway": "omise",
        "omise_charge_id": charge_id,
        "omise_status": status,
        "omise_webhook_at": datetime.now(timezone.utc).isoformat(),
    })
    payment.payment_metadata = metadata

    if status == "successful":
        was_paid = payment.status == PaymentStatus.PAID
        _mark_payment_paid(payment, payment.order, source="omise_webhook", transaction_id=charge_id)
        if not was_paid:
            _add_notification(
                db,
                payment.order.buyer_id,
                NotificationType.PAYMENT,
                title="Payment received",
                body=f"Payment for order #{payment.order.order_number} was confirmed automatically.",
                action_url=f"/orders/{payment.order.id}",
                metadata={"order_id": str(payment.order.id), "payment_id": str(payment.id), "source": "omise"},
            )
            shop = await db.get(Shop, payment.order.shop_id)
            if shop and shop.owner_id:
                _add_notification(
                    db,
                    shop.owner_id,
                    NotificationType.PAYMENT,
                    title="Customer payment received",
                    body=f"Order #{payment.order.order_number} has been paid via Omise PromptPay.",
                    action_url="/seller/orders",
                    metadata={"order_id": str(payment.order.id), "payment_id": str(payment.id), "source": "omise"},
                )
    elif status in ("failed", "expired"):
        payment.status = PaymentStatus.FAILED if status == "failed" else PaymentStatus.CANCELLED
        payment.failed_at = datetime.now(timezone.utc)
        payment.failure_reason = _object_value(charge, "failure_message") or f"Omise charge {status}"
        if status == "expired" and payment.order.status == OrderStatus.PENDING:
            await restore_order_stock(payment.order, db)
            payment.order.status = OrderStatus.CANCELLED
            payment.order.cancelled_at = datetime.now(timezone.utc)
            payment.order.cancel_reason = "Omise PromptPay payment expired"

    return payment

def _create_promptpay_payload(order: Order) -> str:
    amount = str(order.total_amount)
    return f"PROMPTPAY:{amount}:ORDER:{order.order_number}"


def _create_qr_data_url(qr_data: str) -> str:
    try:
        import qrcode
        import io
        import base64

        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{b64}"
    except Exception as e:
        logger.error("PromptPay QR error", error=str(e))
        raise PaymentException("Failed to generate PromptPay QR")


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: DBSession, stripe_signature: str = Header(None)):
    """Handle Stripe webhook events."""
    payload = await request.body()

    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise BadRequestException(f"Webhook error: {str(e)}")

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        order_id = pi.get("metadata", {}).get("order_id")
        if order_id:
            result = await db.execute(
                select(Payment).where(Payment.payment_metadata["stripe_payment_intent_id"].astext == pi["id"])
            )
            payment = result.scalar_one_or_none()
            if payment:
                payment.status = PaymentStatus.PAID
                payment.paid_at = datetime.now(timezone.utc)
                order_res = await db.execute(select(Order).where(Order.id == payment.order_id))
                order = order_res.scalar_one_or_none()
                if order:
                    order.status = OrderStatus.CONFIRMED
                await db.commit()

    elif event["type"] == "payment_intent.payment_failed":
        pi = event["data"]["object"]
        result = await db.execute(
            select(Payment).where(Payment.payment_metadata["stripe_payment_intent_id"].astext == pi["id"])
        )
        payment = result.scalar_one_or_none()
        if payment:
            payment.status = PaymentStatus.FAILED
            payment.failed_at = datetime.now(timezone.utc)
            payment.failure_reason = pi.get("last_payment_error", {}).get("message")
            await db.commit()

    return {"received": True}


@router.post("/webhook/omise")
async def omise_webhook(request: Request, db: DBSession, secret: Optional[str] = None):
    if not settings.OMISE_SECRET_KEY:
        raise BadRequestException("OMISE_SECRET_KEY is not configured")

    expected_secret = getattr(settings, "OMISE_WEBHOOK_SECRET", "") or ""
    if expected_secret and not hmac.compare_digest(secret or "", expected_secret):
        raise ForbiddenException("Invalid Omise webhook secret")

    event = await request.json()
    event_key = event.get("key")
    if event_key != "charge.complete":
        return {"received": True, "ignored": True}

    webhook_charge = event.get("data") or {}
    charge_id = webhook_charge.get("id")
    if not charge_id:
        raise BadRequestException("Missing charge id")

    try:
        verified_charge = _retrieve_omise_charge(charge_id)
    except Exception as e:
        logger.error("Omise charge verification failed", charge_id=charge_id, error=str(e))
        raise BadRequestException("Could not verify Omise charge")

    payment = await _apply_omise_charge_status(verified_charge, db)
    if not payment:
        logger.warning("Omise webhook payment not found", charge_id=charge_id)
        return {"received": True, "matched": False}

    await db.commit()
    await db.refresh(payment)
    logger.info("Omise webhook processed", charge_id=charge_id, payment_id=str(payment.id), status=payment.status.value)
    return {"received": True, "matched": True, "data": serialize_payment(payment)}


@router.get("/seller/pending-transfers")
async def seller_pending_transfers(current_user: CurrentSeller, db: DBSession):
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundException("Shop")

    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.order).selectinload(Order.buyer))
        .join(Order, Payment.order_id == Order.id)
        .where(
            Order.shop_id == shop.id,
            Payment.method == PaymentMethod.PROMPTPAY,
            Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING]),
        )
        .order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()
    data = []
    changed = False
    for payment in payments:
        if await expire_promptpay_payment_if_needed(payment, payment.order, db):
            changed = True
            continue
        order = payment.order
        buyer = order.buyer
        data.append({
            "payment": serialize_payment(payment),
            "order": {
                "id": str(order.id),
                "order_number": order.order_number,
                "total_amount": str(order.total_amount),
                "status": order.status.value,
                "created_at": order.created_at.isoformat(),
                "buyer": {
                    "id": str(buyer.id),
                    "email": buyer.email,
                    "full_name": buyer.full_name,
                    "phone": buyer.phone,
                } if buyer else None,
            },
        })
    if changed:
        await db.commit()
    return {"success": True, "data": data}


@router.post("/seller/orders/{order_id}/verify-transfer")
async def seller_verify_transfer(order_id: UUID, body: VerifyTransferRequest, current_user: CurrentSeller, db: DBSession):
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundException("Shop")

    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.order))
        .join(Order, Payment.order_id == Order.id)
        .where(Payment.order_id == order_id, Order.shop_id == shop.id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundException("Payment")
    if payment.method != PaymentMethod.PROMPTPAY:
        raise BadRequestException("Only PromptPay transfers can be verified here")

    _mark_payment_paid(
        payment,
        payment.order,
        source="seller_manual",
        verified_by=current_user.id,
        transaction_id=body.transaction_id,
        note=body.note,
    )
    _add_notification(
        db,
        payment.order.buyer_id,
        NotificationType.PAYMENT,
        title="Payment verified",
        body=f"Payment for order #{payment.order.order_number} has been confirmed.",
        action_url=f"/orders/{payment.order.id}",
        metadata={"order_id": str(payment.order.id), "payment_id": str(payment.id)},
    )
    await db.commit()
    await db.refresh(payment)
    return {"success": True, "data": serialize_payment(payment)}


@router.post("/webhook/promptpay")
async def promptpay_webhook(request: Request, db: DBSession, x_shopx_webhook_secret: str = Header(None)):
    payload = await request.json()
    expected_secret = getattr(settings, "PROMPTPAY_WEBHOOK_SECRET", "") or ""
    if expected_secret and x_shopx_webhook_secret != expected_secret:
        raise ForbiddenException("Invalid webhook secret")

    order_id = payload.get("order_id")
    order_number = payload.get("order_number")
    amount = payload.get("amount")
    transaction_id = payload.get("transaction_id") or payload.get("reference")
    if not order_id and not order_number:
        raise BadRequestException("order_id or order_number is required")

    query = select(Payment).options(selectinload(Payment.order)).join(Order, Payment.order_id == Order.id)
    if order_id:
        query = query.where(Order.id == UUID(str(order_id)))
    else:
        query = query.where(Order.order_number == str(order_number))
    result = await db.execute(query)
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundException("Payment")
    if payment.method != PaymentMethod.PROMPTPAY:
        raise BadRequestException("Payment is not PromptPay")
    if amount is not None and Decimal(str(amount)) != payment.amount:
        raise BadRequestException("Transfer amount does not match this order")

    _mark_payment_paid(payment, payment.order, source="promptpay_webhook", transaction_id=transaction_id, note=payload.get("note"))
    _add_notification(
        db,
        payment.order.buyer_id,
        NotificationType.PAYMENT,
        title="PromptPay payment received",
        body=f"Payment for order #{payment.order.order_number} was verified automatically.",
        action_url=f"/orders/{payment.order.id}",
        metadata={"order_id": str(payment.order.id), "payment_id": str(payment.id), "source": "webhook"},
    )
    shop = await db.get(Shop, payment.order.shop_id)
    if shop and shop.owner_id:
        _add_notification(
            db,
            shop.owner_id,
            NotificationType.PAYMENT,
            title="Customer payment received",
            body=f"Order #{payment.order.order_number} has been paid and is ready to confirm.",
            action_url="/seller/orders",
            metadata={"order_id": str(payment.order.id), "payment_id": str(payment.id), "source": "webhook"},
        )
    await db.commit()
    await db.refresh(payment)
    logger.info("PromptPay webhook verified payment", payment_id=str(payment.id), order_id=str(payment.order_id))
    return {"success": True, "data": serialize_payment(payment)}


@router.get("/{payment_id}")
async def get_payment(payment_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.order))
        .join(Order, Payment.order_id == Order.id)
        .where(Payment.id == payment_id, Order.buyer_id == current_user.id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundException("Payment", payment_id)
    if await expire_promptpay_payment_if_needed(payment, payment.order, db):
        await db.commit()
        await db.refresh(payment)
    return {"success": True, "data": _payment_dict(payment)}


@router.get("")
async def get_payment_by_order(
    order_id: UUID,
    current_user: CurrentActiveUser,
    db: DBSession,
):
    """Get payment for a specific order (by buyer)."""
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.order))
        .join(Order, Payment.order_id == Order.id)
        .where(Payment.order_id == order_id, Order.buyer_id == current_user.id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundException("Payment")
    if await expire_promptpay_payment_if_needed(payment, payment.order, db):
        await db.commit()
        await db.refresh(payment)
    return {"success": True, "data": _payment_dict(payment)}


