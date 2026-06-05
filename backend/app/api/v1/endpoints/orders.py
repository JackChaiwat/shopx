import math
import uuid as uuid_lib
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import CurrentActiveUser, CurrentSeller, DBSession
from app.api.v1.endpoints.payments import expire_promptpay_payment_if_needed, serialize_payment
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.models import (
    Cart, CartItem, Order, OrderItem, OrderStatus,
    Notification, NotificationType, PaymentStatus, Product, ProductVariant, Shop, UserAddress, Voucher, VoucherType,
)
from app.services.inventory import reserve_cart_stock, restore_order_stock

logger = structlog.get_logger(__name__)
router = APIRouter()


DEFAULT_SHIPPING_ORIGIN_LAT = Decimal("13.7563")
DEFAULT_SHIPPING_ORIGIN_LNG = Decimal("100.5018")
BASE_SHIPPING_FEE = Decimal("35.00")
INCLUDED_SHIPPING_KM = Decimal("3.00")
PER_KM_SHIPPING_FEE = Decimal("8.00")
MAX_SHIPPING_FEE = Decimal("250.00")
NO_COORDINATE_SHIPPING_FEE = Decimal("50.00")


def _decimal_or_none(value) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def _haversine_km(lat1: Decimal, lon1: Decimal, lat2: Decimal, lon2: Decimal) -> Decimal:
    radius_km = 6371.0
    p1 = math.radians(float(lat1))
    p2 = math.radians(float(lat2))
    d_lat = math.radians(float(lat2 - lat1))
    d_lon = math.radians(float(lon2 - lon1))
    a = math.sin(d_lat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lon / 2) ** 2
    distance = radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return Decimal(str(round(distance, 2)))


def _shipping_quote(shop: Optional[Shop], address: UserAddress) -> dict:
    dest_lat = _decimal_or_none(getattr(address, "latitude", None))
    dest_lng = _decimal_or_none(getattr(address, "longitude", None))
    if dest_lat is None or dest_lng is None:
        return {
            "distance_km": None,
            "shipping_fee": NO_COORDINATE_SHIPPING_FEE.quantize(Decimal("0.01")),
            "origin": "fallback_no_customer_pin",
        }

    origin_lat = _decimal_or_none(getattr(shop, "latitude", None)) if shop else None
    origin_lng = _decimal_or_none(getattr(shop, "longitude", None)) if shop else None
    origin = "shop"
    if origin_lat is None or origin_lng is None:
        origin_lat = DEFAULT_SHIPPING_ORIGIN_LAT
        origin_lng = DEFAULT_SHIPPING_ORIGIN_LNG
        origin = "default_bangkok"

    distance = _haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
    extra_km = max(distance - INCLUDED_SHIPPING_KM, Decimal("0"))
    fee = BASE_SHIPPING_FEE + (extra_km * PER_KM_SHIPPING_FEE)
    fee = min(fee, MAX_SHIPPING_FEE).quantize(Decimal("0.01"))
    return {"distance_km": distance, "shipping_fee": fee, "origin": origin}


class CheckoutRequest(BaseModel):
    shipping_address_id: UUID
    voucher_code: Optional[str] = None
    notes: Optional[str] = None
    payment_method: str = "stripe"


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    cancel_reason: Optional[str] = None


class CustomerOrderUpdate(BaseModel):
    shipping_address_id: Optional[UUID] = None
    notes: Optional[str] = None


def _invoice_number(order: Order) -> str:
    year_month = order.created_at.strftime("%Y%m") if order.created_at else datetime.now(timezone.utc).strftime("%Y%m")
    suffix = order.order_number.replace("ORD-", "").replace("-", "")[-8:]
    return f"INV-{year_month}-{suffix}"


def _address_dict(addr: UserAddress) -> dict:
    return {
        "id": str(addr.id),
        "label": addr.label,
        "recipient_name": addr.recipient_name,
        "phone": addr.phone,
        "address_line1": addr.address_line1,
        "address_line2": addr.address_line2,
        "city": addr.city,
        "state": addr.state,
        "postal_code": addr.postal_code,
        "country": addr.country,
        "latitude": str(addr.latitude) if getattr(addr, "latitude", None) is not None else None,
        "longitude": str(addr.longitude) if getattr(addr, "longitude", None) is not None else None,
        "is_default": addr.is_default,
    }


def _order_dict(order: Order, include_items: bool = False) -> dict:
    result = {
        "id": str(order.id),
        "order_number": order.order_number,
        "invoice_number": _invoice_number(order),
        "status": order.status.value,
        "subtotal": str(order.subtotal),
        "discount_amount": str(order.discount_amount),
        "shipping_fee": str(order.shipping_fee),
        "tax_amount": str(order.tax_amount),
        "total_amount": str(order.total_amount),
        "tracking_number": order.tracking_number,
        "notes": order.notes,
        "shop_id": str(order.shop_id),
        "shipping_address_id": str(order.shipping_address_id) if order.shipping_address_id else None,
        "shipping_address": _address_dict(order.shipping_address) if order.shipping_address else None,
        "buyer": {
            "id": str(order.buyer.id),
            "email": order.buyer.email,
            "full_name": order.buyer.full_name,
            "phone": order.buyer.phone,
        } if order.buyer else None,
        "created_at": order.created_at.isoformat(),
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
    }
    payment = order.__dict__.get("payment")
    if payment:
        result["payment"] = serialize_payment(payment)

    if include_items and order.items:
        result["items"] = [
            {
                "id": str(i.id),
                "product_id": str(i.product_id),
                "product_name": i.product_name,
                "variant_name": i.variant_name,
                "sku": i.sku,
                "quantity": i.quantity,
                "unit_price": str(i.unit_price),
                "total_price": str(i.total_price),
                "product_image_url": i.product_image_url,
                "review_id": str(i.review_id) if i.review_id else None,
            }
            for i in order.items
        ]
    return result


def _generate_order_number() -> str:
    import time
    ts = str(int(time.time()))[-6:]
    rand = uuid_lib.uuid4().hex[:4].upper()
    return f"ORD-{ts}-{rand}"


def _add_notification(db: DBSession, user_id, notification_type: NotificationType, title: str, body: str, action_url: Optional[str] = None, metadata: Optional[dict] = None) -> None:
    db.add(Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        action_url=action_url,
        notif_metadata=metadata,
    ))

@router.get("/shipping-estimate")
async def shipping_estimate(shipping_address_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    addr_result = await db.execute(
        select(UserAddress).where(UserAddress.id == shipping_address_id, UserAddress.user_id == current_user.id)
    )
    address = addr_result.scalar_one_or_none()
    if not address:
        raise NotFoundException("Shipping address", shipping_address_id)

    result = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items).selectinload(CartItem.product))
        .where(Cart.user_id == current_user.id)
    )
    cart = result.scalar_one_or_none()
    if not cart or not cart.items:
        return {"success": True, "data": {"total_shipping_fee": "0.00", "shipments": []}}

    shop_ids = sorted({item.product.shop_id for item in cart.items}, key=lambda value: str(value))
    shipments = []
    total = Decimal("0.00")
    for shop_id in shop_ids:
        shop = await db.get(Shop, shop_id)
        quote = _shipping_quote(shop, address)
        total += quote["shipping_fee"]
        shipments.append({
            "shop_id": str(shop_id),
            "shop_name": shop.name if shop else "Shop",
            "distance_km": str(quote["distance_km"]) if quote["distance_km"] is not None else None,
            "shipping_fee": str(quote["shipping_fee"]),
            "origin": quote["origin"],
        })

    return {"success": True, "data": {"total_shipping_fee": str(total.quantize(Decimal("0.01"))), "shipments": shipments}}



@router.post("/checkout", status_code=201)
async def checkout(body: CheckoutRequest, current_user: CurrentActiveUser, db: DBSession):
    """Create order(s) from cart. One order per shop."""
    # Get cart with items
    result = await db.execute(
        select(Cart)
        .options(
            selectinload(Cart.items).selectinload(CartItem.product).selectinload(Product.images),
            selectinload(Cart.items).selectinload(CartItem.variant),
        )
        .where(Cart.user_id == current_user.id)
    )
    cart = result.scalar_one_or_none()
    if not cart or not cart.items:
        raise BadRequestException("Cart is empty")

    # Validate address
    addr_result = await db.execute(
        select(UserAddress).where(UserAddress.id == body.shipping_address_id, UserAddress.user_id == current_user.id)
    )
    address = addr_result.scalar_one_or_none()
    if not address:
        raise NotFoundException("Shipping address", body.shipping_address_id)

    # Validate voucher
    voucher = None
    if body.voucher_code:
        v_result = await db.execute(
            select(Voucher).where(
                Voucher.code == body.voucher_code,
                Voucher.is_active == True,
                Voucher.starts_at <= datetime.now(timezone.utc),
                Voucher.expires_at >= datetime.now(timezone.utc),
            )
        )
        voucher = v_result.scalar_one_or_none()
        if not voucher:
            raise BadRequestException("Invalid or expired voucher")

    # Reserve stock with row locks before orders are inserted.
    # This prevents two customers from buying the same last item at once.
    await reserve_cart_stock(list(cart.items), db)

    # Group cart items by shop
    items_by_shop: dict[UUID, list] = {}
    for item in cart.items:
        shop_id = item.product.shop_id
        items_by_shop.setdefault(shop_id, []).append(item)

    created_orders = []
    for shop_id, shop_items in items_by_shop.items():
        subtotal = Decimal("0")
        order_items_data = []

        for item in shop_items:
            p = item.product
            v = item.variant
            price = Decimal(str(v.price if v else p.base_price))
            sale = v.sale_price if v else p.sale_price
            effective = Decimal(str(sale)) if sale else price
            line_total = effective * item.quantity
            subtotal += line_total

            primary_img = next((img.url for img in p.images if img.is_primary), None)
            if not primary_img and p.images:
                primary_img = p.images[0].url

            order_items_data.append({
                "product_id": p.id,
                "variant_id": v.id if v else None,
                "product_name": p.name,
                "variant_name": v.name if v else None,
                "sku": v.sku if v else p.sku,
                "quantity": item.quantity,
                "unit_price": effective,
                "total_price": line_total,
                "product_image_url": primary_img,
            })

        shop = await db.get(Shop, shop_id)
        shipping_fee = _shipping_quote(shop, address)["shipping_fee"]
        tax = subtotal * Decimal("0.07")
        discount = Decimal("0")

        if voucher:
            if voucher.type == VoucherType.PERCENTAGE:
                discount = min(subtotal * voucher.value / 100, voucher.max_discount_amount or subtotal)
            elif voucher.type == VoucherType.FIXED:
                discount = min(voucher.value, subtotal)
            elif voucher.type == VoucherType.FREE_SHIPPING:
                shipping_fee = Decimal("0")

        total = subtotal + shipping_fee + tax - discount

        order = Order(
            order_number=_generate_order_number(),
            buyer_id=current_user.id,
            shop_id=shop_id,
            shipping_address_id=body.shipping_address_id,
            status=OrderStatus.PENDING,
            subtotal=subtotal,
            shipping_fee=shipping_fee,
            tax_amount=tax,
            discount_amount=discount,
            total_amount=total,
            voucher_id=voucher.id if voucher else None,
            notes=body.notes,
        )
        db.add(order)
        await db.flush()  # get order.id

        for item_data in order_items_data:
            oi = OrderItem(order_id=order.id, **item_data)
            db.add(oi)

        if shop and shop.owner_id:
            _add_notification(
                db,
                shop.owner_id,
                NotificationType.ORDER,
                title="New order received",
                body=f"Order #{order.order_number} is waiting for your confirmation.",
                action_url="/seller/orders",
                metadata={"order_id": str(order.id), "order_number": order.order_number},
            )

        created_orders.append(order)

    # Clear cart
    for item in cart.items:
        await db.delete(item)

    if voucher:
        voucher.used_count += 1

    await db.commit()
    for order in created_orders:
        await db.refresh(order)

    logger.info("Orders created", count=len(created_orders), buyer=str(current_user.id))
    return {
        "success": True,
        "data": {
            "orders": [{"id": str(o.id), "order_number": o.order_number, "total": str(o.total_amount)} for o in created_orders],
        },
    }


@router.get("")
async def list_orders(
    current_user: CurrentActiveUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    status: Optional[OrderStatus] = None,
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    query = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.shipping_address), selectinload(Order.payment))
        .where(Order.buyer_id == current_user.id)
    )
    if status:
        query = query.where(Order.status == status)
    if year:
        if month:
            start = datetime(year, month, 1, tzinfo=timezone.utc)
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(year, month + 1, 1, tzinfo=timezone.utc)
        else:
            start = datetime(year, 1, 1, tzinfo=timezone.utc)
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        query = query.where(Order.created_at >= start, Order.created_at < end)
    query = query.order_by(Order.created_at.desc())

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    orders = result.scalars().all()
    return {"success": True, "data": [_order_dict(o, include_items=True) for o in orders]}


@router.get("/{order_id}")
async def get_order(order_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment), selectinload(Order.shipping_address))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("Order", order_id)
    if order.buyer_id != current_user.id:
        raise ForbiddenException("Access denied")

    payment = order.payment
    if payment and await expire_promptpay_payment_if_needed(payment, order, db):
        await db.commit()
        await db.refresh(order)
        await db.refresh(payment)

    data = _order_dict(order, include_items=True)
    if payment:
        data["payment"] = serialize_payment(payment)
    return {"success": True, "data": data}


@router.patch("/{order_id}")
async def update_customer_order(
    order_id: UUID,
    body: CustomerOrderUpdate,
    current_user: CurrentActiveUser,
    db: DBSession,
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment), selectinload(Order.shipping_address))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("Order", order_id)
    if order.buyer_id != current_user.id:
        raise ForbiddenException("Access denied")
    if order.status != OrderStatus.PENDING:
        raise BadRequestException("Order details can only be edited while pending")

    if body.shipping_address_id is not None:
        addr_result = await db.execute(
            select(UserAddress).where(
                UserAddress.id == body.shipping_address_id,
                UserAddress.user_id == current_user.id,
            )
        )
        address = addr_result.scalar_one_or_none()
        if not address:
            raise NotFoundException("Shipping address", body.shipping_address_id)
        order.shipping_address_id = body.shipping_address_id

    if body.notes is not None:
        order.notes = body.notes.strip() or None

    await db.commit()
    updated = (await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment), selectinload(Order.shipping_address))
        .where(Order.id == order_id)
    )).scalar_one()
    return {"success": True, "data": _order_dict(updated, include_items=True)}


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: UUID,
    current_user: CurrentActiveUser,
    db: DBSession,
    reason: Optional[str] = None,
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("Order", order_id)
    if order.buyer_id != current_user.id:
        raise ForbiddenException()
    payment = order.__dict__.get("payment")
    if payment and payment.status == PaymentStatus.PAID:
        raise BadRequestException("Paid orders cannot be cancelled by customer. Please contact the seller.")
    if order.status not in (OrderStatus.PENDING, OrderStatus.CONFIRMED):
        raise BadRequestException("Order cannot be cancelled at this stage")

    await restore_order_stock(order, db)
    if payment and payment.status in (PaymentStatus.PENDING, PaymentStatus.PROCESSING):
        payment.status = PaymentStatus.CANCELLED
        payment.failed_at = datetime.now(timezone.utc)
        payment.failure_reason = "Customer cancelled order"
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now(timezone.utc)
    order.cancel_reason = reason

    shop = await db.get(Shop, order.shop_id)
    if shop and shop.owner_id:
        _add_notification(
            db,
            shop.owner_id,
            NotificationType.ORDER,
            title="Order cancelled by customer",
            body=f"Order #{order.order_number} was cancelled. Stock has been returned.",
            action_url="/seller/orders",
            metadata={"order_id": str(order.id), "order_number": order.order_number},
        )

    await db.commit()
    return {"success": True, "message": "Order cancelled"}


# Seller order management
@router.get("/seller/orders")
async def list_seller_orders(
    current_user: CurrentSeller,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    status: Optional[OrderStatus] = None,
    q: Optional[str] = None,
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
):
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundException("Shop")

    query = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.shipping_address), selectinload(Order.buyer), selectinload(Order.payment))
        .where(Order.shop_id == shop.id)
    )
    if status:
        query = query.where(Order.status == status)
    if q:
        query = query.where(Order.order_number.ilike(f"%{q}%"))
    if year:
        if month:
            start = datetime(year, month, 1, tzinfo=timezone.utc)
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(year, month + 1, 1, tzinfo=timezone.utc)
        else:
            start = datetime(year, 1, 1, tzinfo=timezone.utc)
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        query = query.where(Order.created_at >= start, Order.created_at < end)
    query = query.order_by(Order.created_at.desc())

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    orders = result.scalars().all()
    return {"success": True, "data": [_order_dict(o, include_items=True) for o in orders]}


@router.patch("/seller/orders/{order_id}/status")
async def update_order_status(
    order_id: UUID,
    body: OrderStatusUpdate,
    current_user: CurrentSeller,
    db: DBSession,
):
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundException("Shop")

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.shipping_address), selectinload(Order.buyer))
        .where(Order.id == order_id, Order.shop_id == shop.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("Order", order_id)

    previous_status = order.status
    if body.status == OrderStatus.CANCELLED and previous_status != OrderStatus.CANCELLED:
        await restore_order_stock(order, db)

    order.status = body.status
    if body.tracking_number is not None:
        order.tracking_number = body.tracking_number.strip() or None
    if body.cancel_reason is not None:
        order.cancel_reason = body.cancel_reason.strip() or None
    if body.status == OrderStatus.SHIPPED:
        order.shipped_at = datetime.now(timezone.utc)
    if body.status == OrderStatus.DELIVERED:
        order.delivered_at = datetime.now(timezone.utc)
    if body.status == OrderStatus.CANCELLED:
        order.cancelled_at = datetime.now(timezone.utc)

    if body.status != previous_status:
        _add_notification(
            db,
            order.buyer_id,
            NotificationType.ORDER,
            title=f"Order {body.status.value.replace('_', ' ').title()}",
            body=f"Order #{order.order_number} is now {body.status.value.replace('_', ' ')}.",
            action_url=f"/orders/{order.id}",
            metadata={"order_id": str(order.id), "order_number": order.order_number, "status": body.status.value},
        )

    await db.commit()
    return {"success": True, "data": _order_dict(order, include_items=True)}
