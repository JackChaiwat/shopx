from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, literal_column, select, update, desc
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import CurrentAdmin, DBSession
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.models import (
    AuditLog, Order, OrderItem, OrderStatus, Payment, PaymentStatus,
    Product, ProductStatus, Review, ReviewStatus,
    Shop, ShopStatus, User, UserRole, UserStatus,
)

router = APIRouter()


@router.get("/stats")
async def get_platform_stats(db: DBSession, _: CurrentAdmin):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    user_count = (await db.execute(select(func.count(User.id)).where(User.deleted_at.is_(None)))).scalar() or 0
    shop_count = (await db.execute(select(func.count(Shop.id)).where(Shop.deleted_at.is_(None)))).scalar() or 0
    product_count = (await db.execute(select(func.count(Product.id)).where(Product.deleted_at.is_(None)))).scalar() or 0
    order_count = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    revenue = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == PaymentStatus.PAID, Payment.paid_at >= month_start)
    )).scalar() or Decimal("0")
    today_orders = (await db.execute(select(func.count(Order.id)).where(Order.created_at >= today_start))).scalar() or 0
    pending_shops = (await db.execute(select(func.count(Shop.id)).where(Shop.status == ShopStatus.PENDING))).scalar() or 0
    pending_reviews = (await db.execute(select(func.count(Review.id)).where(Review.status == ReviewStatus.PENDING))).scalar() or 0
    new_users = (await db.execute(select(func.count(User.id)).where(User.created_at >= month_start))).scalar() or 0
    seller_count = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.SELLER))).scalar() or 0

    return {"success": True, "data": {
        "total_users": user_count, "total_shops": shop_count, "total_products": product_count,
        "total_orders": order_count, "revenue_this_month": str(revenue),
        "orders_today": today_orders, "pending_shop_approvals": pending_shops,
        "pending_reviews": pending_reviews, "new_users_this_month": new_users, "active_sellers": seller_count,
    }}


@router.get("/analytics/revenue")
async def revenue_analytics(db: DBSession, _: CurrentAdmin, period: str = Query("30d")):
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(period, 30)
    start = datetime.now(timezone.utc) - timedelta(days=days)

    day_bucket = func.date_trunc(literal_column("'day'"), Payment.paid_at)
    daily = await db.execute(
        select(day_bucket.label("day"),
               func.sum(Payment.amount).label("revenue"), func.count(Payment.id).label("transactions"))
        .where(Payment.status == PaymentStatus.PAID, Payment.paid_at >= start)
        .group_by(day_bucket)
        .order_by(day_bucket)
    )
    total = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == PaymentStatus.PAID, Payment.paid_at >= start)
    )).scalar() or Decimal("0")

    status_counts = await db.execute(
        select(Order.status, func.count(Order.id)).where(Order.created_at >= start).group_by(Order.status)
    )

    top_shops = await db.execute(
        select(Shop.name, Shop.id, func.sum(Payment.amount).label("rev"), func.count(Order.id).label("orders"))
        .join(Order, Order.shop_id == Shop.id).join(Payment, Payment.order_id == Order.id)
        .where(Payment.status == PaymentStatus.PAID, Payment.paid_at >= start)
        .group_by(Shop.id, Shop.name).order_by(desc(func.sum(Payment.amount))).limit(10)
    )

    return {"success": True, "data": {
        "period": period, "total_revenue": str(total),
        "daily": [{"date": r.day.strftime("%Y-%m-%d"), "revenue": str(r.revenue), "transactions": r.transactions} for r in daily.all()],
        "order_status": {r[0].value: r[1] for r in status_counts.all()},
        "top_shops": [{"shop_id": str(r.id), "name": r.name, "revenue": str(r.rev), "orders": r.orders} for r in top_shops.all()],
    }}


@router.get("/analytics/users")
async def user_analytics(db: DBSession, _: CurrentAdmin, period: str = Query("30d")):
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(period, 30)
    start = datetime.now(timezone.utc) - timedelta(days=days)
    day_bucket = func.date_trunc(literal_column("'day'"), User.created_at)
    daily = await db.execute(
        select(day_bucket.label("day"), func.count(User.id).label("count"))
        .where(User.created_at >= start).group_by(day_bucket)
        .order_by(day_bucket)
    )
    role_dist = await db.execute(select(User.role, func.count(User.id)).group_by(User.role))
    return {"success": True, "data": {
        "daily_registrations": [{"date": r.day.strftime("%Y-%m-%d"), "count": r.count} for r in daily.all()],
        "role_distribution": {r[0].value: r[1] for r in role_dist.all()},
    }}


@router.get("/users")
async def list_users(db: DBSession, _: CurrentAdmin, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                     role: Optional[UserRole] = None, status: Optional[UserStatus] = None, q: Optional[str] = None):
    query = select(User).where(User.deleted_at.is_(None))
    if role: query = query.where(User.role == role)
    if status: query = query.where(User.status == status)
    if q: query = query.where(User.email.ilike(f"%{q}%") | User.full_name.ilike(f"%{q}%"))
    query = query.order_by(User.created_at.desc())
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    users = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {
        "items": [{"id": str(u.id), "email": u.email, "full_name": u.full_name, "avatar_url": u.avatar_url,
                   "role": u.role.value, "status": u.status.value, "is_email_verified": u.is_email_verified,
                   "wallet_balance": str(u.wallet_balance), "created_at": u.created_at.isoformat(),
                   "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None} for u in users],
        "total": count, "page": page, "limit": limit, "pages": (count + limit - 1) // limit,
    }}


@router.get("/users/{user_id}")
async def get_user_detail(user_id: UUID, db: DBSession, _: CurrentAdmin):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user: raise NotFoundException("User", user_id)
    order_count = (await db.execute(select(func.count(Order.id)).where(Order.buyer_id == user_id))).scalar() or 0
    total_spent = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).join(Order, Payment.order_id == Order.id)
        .where(Order.buyer_id == user_id, Payment.status == PaymentStatus.PAID)
    )).scalar() or Decimal("0")
    return {"success": True, "data": {
        "id": str(user.id), "email": user.email, "full_name": user.full_name,
        "avatar_url": user.avatar_url, "role": user.role.value, "status": user.status.value,
        "wallet_balance": str(user.wallet_balance), "created_at": user.created_at.isoformat(),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "stats": {"total_orders": order_count, "total_spent": str(total_spent)},
    }}


class UpdateUserRequest(BaseModel):
    status: Optional[UserStatus] = None
    role: Optional[UserRole] = None
    wallet_adjustment: Optional[Decimal] = None
    note: Optional[str] = None


@router.patch("/users/{user_id}")
async def update_user(user_id: UUID, body: UpdateUserRequest, db: DBSession, admin: CurrentAdmin):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user: raise NotFoundException("User", user_id)
    if body.status: user.status = body.status
    if body.role: user.role = body.role
    if body.wallet_adjustment is not None:
        user.wallet_balance = max(Decimal("0"), user.wallet_balance + body.wallet_adjustment)
    db.add(AuditLog(user_id=admin.id, action="user.update", resource_type="user", resource_id=str(user_id),
                    new_values=body.model_dump(exclude_none=True)))
    await db.commit()
    return {"success": True}


class BulkUserAction(BaseModel):
    user_ids: List[UUID]
    action: str


@router.post("/users/bulk-action")
async def bulk_user_action(body: BulkUserAction, db: DBSession, admin: CurrentAdmin):
    status_map = {"suspend": UserStatus.SUSPENDED, "activate": UserStatus.ACTIVE}
    if body.action not in status_map: raise BadRequestException(f"Unknown action: {body.action}")
    await db.execute(update(User).where(User.id.in_(body.user_ids)).values(status=status_map[body.action]))
    await db.commit()
    return {"success": True, "message": f"{body.action} applied to {len(body.user_ids)} users"}


@router.get("/shops")
async def list_shops(db: DBSession, _: CurrentAdmin, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                     status: Optional[ShopStatus] = None, q: Optional[str] = None):
    query = select(Shop).options(selectinload(Shop.owner))
    if status: query = query.where(Shop.status == status)
    if q: query = query.where(Shop.name.ilike(f"%{q}%"))
    query = query.order_by(Shop.created_at.desc())
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    shops = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {
        "items": [{"id": str(s.id), "name": s.name, "slug": s.slug, "status": s.status.value,
                   "rating": str(s.rating), "total_sales": s.total_sales, "follower_count": s.follower_count,
                   "owner_id": str(s.owner_id), "owner_email": s.owner.email if s.owner else None,
                   "verified_at": s.verified_at.isoformat() if s.verified_at else None,
                   "created_at": s.created_at.isoformat()} for s in shops],
        "total": count, "page": page, "limit": limit, "pages": (count + limit - 1) // limit,
    }}


class UpdateShopStatus(BaseModel):
    status: ShopStatus
    reason: Optional[str] = None


@router.patch("/shops/{shop_id}/status")
async def update_shop_status(shop_id: UUID, body: UpdateShopStatus, db: DBSession, admin: CurrentAdmin):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop: raise NotFoundException("Shop", shop_id)
    old = shop.status
    shop.status = body.status
    if body.status == ShopStatus.ACTIVE: shop.verified_at = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=admin.id, action="shop.status_change", resource_type="shop", resource_id=str(shop_id),
                    old_values={"status": old.value}, new_values={"status": body.status.value, "reason": body.reason}))
    await db.commit()
    return {"success": True}


@router.get("/products")
async def list_products_admin(db: DBSession, _: CurrentAdmin, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                               status: Optional[ProductStatus] = None, shop_id: Optional[UUID] = None, q: Optional[str] = None):
    query = select(Product).options(selectinload(Product.shop)).where(Product.deleted_at.is_(None))
    if status: query = query.where(Product.status == status)
    if shop_id: query = query.where(Product.shop_id == shop_id)
    if q: query = query.where(Product.name.ilike(f"%{q}%"))
    query = query.order_by(Product.created_at.desc())
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    products = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {
        "items": [{"id": str(p.id), "name": p.name, "status": p.status.value, "base_price": str(p.base_price),
                   "stock_quantity": p.stock_quantity, "sold_count": p.sold_count, "rating": str(p.rating),
                   "shop_id": str(p.shop_id), "shop_name": p.shop.name if p.shop else None,
                   "created_at": p.created_at.isoformat()} for p in products],
        "total": count, "page": page, "limit": limit, "pages": (count + limit - 1) // limit,
    }}


class UpdateProductStatus(BaseModel):
    status: ProductStatus
    reason: Optional[str] = None


@router.patch("/products/{product_id}/status")
async def update_product_status(product_id: UUID, body: UpdateProductStatus, db: DBSession, admin: CurrentAdmin):
    result = await db.execute(select(Product).where(Product.id == product_id))
    p = result.scalar_one_or_none()
    if not p: raise NotFoundException("Product", product_id)
    p.status = body.status
    db.add(AuditLog(user_id=admin.id, action="product.status_change", resource_type="product",
                    resource_id=str(product_id), new_values={"status": body.status.value, "reason": body.reason}))
    await db.commit()
    return {"success": True}


@router.get("/orders")
async def list_orders_admin(db: DBSession, _: CurrentAdmin, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                             status: Optional[OrderStatus] = None, q: Optional[str] = None):
    query = select(Order).options(selectinload(Order.payment))
    if status: query = query.where(Order.status == status)
    if q: query = query.where(Order.order_number.ilike(f"%{q}%"))
    query = query.order_by(Order.created_at.desc())
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    orders = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {
        "items": [{"id": str(o.id), "order_number": o.order_number, "status": o.status.value,
                   "total_amount": str(o.total_amount), "buyer_id": str(o.buyer_id), "shop_id": str(o.shop_id),
                   "payment_status": o.payment.status.value if o.payment else None,
                   "created_at": o.created_at.isoformat()} for o in orders],
        "total": count, "page": page, "limit": limit, "pages": (count + limit - 1) // limit,
    }}


@router.get("/reviews")
async def list_reviews_admin(db: DBSession, _: CurrentAdmin, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                              status: Optional[ReviewStatus] = None):
    query = select(Review).where(Review.deleted_at.is_(None))
    if status: query = query.where(Review.status == status)
    query = query.order_by(Review.created_at.desc())
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    reviews = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {
        "items": [{"id": str(r.id), "product_id": str(r.product_id), "user_id": str(r.user_id),
                   "rating": r.rating, "title": r.title, "content": r.content,
                   "status": r.status.value, "created_at": r.created_at.isoformat()} for r in reviews],
        "total": count, "page": page,
    }}


class UpdateReviewStatus(BaseModel):
    status: ReviewStatus
    reason: Optional[str] = None


@router.patch("/reviews/{review_id}/status")
async def moderate_review(review_id: UUID, body: UpdateReviewStatus, db: DBSession, admin: CurrentAdmin):
    result = await db.execute(select(Review).where(Review.id == review_id))
    r = result.scalar_one_or_none()
    if not r: raise NotFoundException("Review", review_id)
    r.status = body.status
    db.add(AuditLog(user_id=admin.id, action="review.moderate", resource_type="review",
                    resource_id=str(review_id), new_values={"status": body.status.value}))
    await db.commit()
    return {"success": True}


@router.get("/audit-logs")
async def get_audit_logs(db: DBSession, _: CurrentAdmin, page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=100),
                          action: Optional[str] = None, resource_type: Optional[str] = None):
    query = select(AuditLog)
    if action: query = query.where(AuditLog.action == action)
    if resource_type: query = query.where(AuditLog.resource_type == resource_type)
    query = query.order_by(AuditLog.created_at.desc())
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    logs = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {
        "items": [{"id": str(l.id), "action": l.action, "resource_type": l.resource_type,
                   "resource_id": l.resource_id, "user_id": str(l.user_id) if l.user_id else None,
                   "old_values": l.old_values, "new_values": l.new_values, "ip_address": l.ip_address,
                   "created_at": l.created_at.isoformat()} for l in logs],
        "total": count, "page": page,
    }}


class WalletTopup(BaseModel):
    user_id: UUID
    amount: Decimal
    note: str


@router.post("/wallet/topup")
async def admin_wallet_topup(body: WalletTopup, db: DBSession, admin: CurrentAdmin):
    if body.amount <= 0: raise BadRequestException("Amount must be positive")
    result = await db.execute(select(User).where(User.id == body.user_id))
    user = result.scalar_one_or_none()
    if not user: raise NotFoundException("User", body.user_id)
    user.wallet_balance += body.amount
    db.add(AuditLog(user_id=admin.id, action="wallet.topup", resource_type="user",
                    resource_id=str(body.user_id), new_values={"amount": str(body.amount), "note": body.note}))
    await db.commit()
    return {"success": True, "data": {"new_balance": str(user.wallet_balance)}}


@router.get("/flash-sales")
async def list_flash_sales_admin(db: DBSession, _: CurrentAdmin):
    from app.models.models import FlashSale
    result = await db.execute(select(FlashSale).options(selectinload(FlashSale.items)).order_by(FlashSale.starts_at.desc()).limit(50))
    sales = result.scalars().all()
    return {"success": True, "data": [
        {"id": str(s.id), "name": s.name, "starts_at": s.starts_at.isoformat(),
         "ends_at": s.ends_at.isoformat(), "is_active": s.is_active, "item_count": len(s.items)} for s in sales
    ]}


class FlashSaleCreate(BaseModel):
    name: str
    starts_at: datetime
    ends_at: datetime


@router.post("/flash-sales", status_code=201)
async def create_flash_sale(body: FlashSaleCreate, db: DBSession, admin: CurrentAdmin):
    from app.models.models import FlashSale
    sale = FlashSale(**body.model_dump())
    db.add(sale)
    await db.commit()
    await db.refresh(sale)
    return {"success": True, "data": {"id": str(sale.id)}}


def _period_bounds(period: str):
    now = datetime.now(timezone.utc)
    if period == "7d":
        return now - timedelta(days=7), now
    if period == "90d":
        return now - timedelta(days=90), now
    if period == "1y":
        return now - timedelta(days=365), now
    return now - timedelta(days=30), now


def _billing_invoice_number(order: Order) -> str:
    year_month = order.created_at.strftime("%Y%m") if order.created_at else datetime.now(timezone.utc).strftime("%Y%m")
    suffix = order.order_number.replace("ORD-", "").replace("-", "")[-8:]
    return f"INV-{year_month}-{suffix}"


PLATFORM_FEE_RATE = Decimal("0.05")


@router.get("/billing/summary")
async def billing_summary(db: DBSession, _: CurrentAdmin, period: str = Query("30d")):
    start, end = _period_bounds(period)

    paid_filter = (
        Payment.status == PaymentStatus.PAID,
        Payment.paid_at >= start,
        Payment.paid_at < end,
    )

    gross_paid = (await db.execute(select(func.coalesce(func.sum(Payment.amount), 0)).where(*paid_filter))).scalar() or Decimal("0")
    paid_count = (await db.execute(select(func.count(Payment.id)).where(*paid_filter))).scalar() or 0
    pending_amount = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING]))
    )).scalar() or Decimal("0")
    refunded_amount = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == PaymentStatus.REFUNDED, Payment.created_at >= start, Payment.created_at < end)
    )).scalar() or Decimal("0")

    delivered_paid = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(Order, Order.id == Payment.order_id)
        .where(*paid_filter, Order.status == OrderStatus.DELIVERED)
    )).scalar() or Decimal("0")

    platform_fee = (delivered_paid * PLATFORM_FEE_RATE).quantize(Decimal("0.01"))
    seller_payable = delivered_paid - platform_fee

    status_rows = await db.execute(
        select(Payment.status, func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.created_at >= start, Payment.created_at < end)
        .group_by(Payment.status)
    )

    return {"success": True, "data": {
        "period": period,
        "platform_fee_rate": str(PLATFORM_FEE_RATE),
        "gross_paid": str(gross_paid),
        "paid_transactions": paid_count,
        "pending_amount": str(pending_amount),
        "refunded_amount": str(refunded_amount),
        "delivered_paid": str(delivered_paid),
        "platform_fee": str(platform_fee),
        "seller_payable": str(seller_payable),
        "by_status": [{"status": r[0].value, "count": r[1], "amount": str(r[2])} for r in status_rows.all()],
    }}


@router.get("/billing/transactions")
async def billing_transactions(
    db: DBSession,
    _: CurrentAdmin,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[PaymentStatus] = None,
    q: Optional[str] = None,
):
    query = (
        select(Payment, Order, Shop, User)
        .join(Order, Order.id == Payment.order_id)
        .join(Shop, Shop.id == Order.shop_id)
        .join(User, User.id == Order.buyer_id)
    )
    if status:
        query = query.where(Payment.status == status)
    if q:
        query = query.where(Order.order_number.ilike(f"%{q}%") | User.email.ilike(f"%{q}%") | Shop.name.ilike(f"%{q}%"))
    query = query.order_by(Payment.created_at.desc())
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    rows = (await db.execute(query.offset((page - 1) * limit).limit(limit))).all()
    return {"success": True, "data": {
        "items": [{
            "id": str(payment.id),
            "order_id": str(order.id),
            "order_number": order.order_number,
            "invoice_number": _billing_invoice_number(order),
            "shop_id": str(shop.id),
            "shop_name": shop.name,
            "buyer_email": buyer.email,
            "method": payment.method.value,
            "status": payment.status.value,
            "amount": str(payment.amount),
            "currency": payment.currency,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            "created_at": payment.created_at.isoformat(),
        } for payment, order, shop, buyer in rows],
        "total": count,
        "page": page,
        "limit": limit,
        "pages": (count + limit - 1) // limit,
    }}


@router.get("/billing/payouts")
async def billing_payouts(db: DBSession, _: CurrentAdmin, period: str = Query("30d")):
    start, end = _period_bounds(period)
    rows = await db.execute(
        select(
            Shop.id,
            Shop.name,
            Shop.owner_id,
            func.count(Order.id).label("orders"),
            func.coalesce(func.sum(Payment.amount), 0).label("gross"),
        )
        .join(Order, Order.shop_id == Shop.id)
        .join(Payment, Payment.order_id == Order.id)
        .where(Payment.status == PaymentStatus.PAID, Payment.paid_at >= start, Payment.paid_at < end, Order.status == OrderStatus.DELIVERED)
        .group_by(Shop.id, Shop.name, Shop.owner_id)
        .order_by(desc(func.coalesce(func.sum(Payment.amount), 0)))
    )
    items = []
    for shop_id, name, owner_id, orders, gross in rows.all():
        gross = Decimal(str(gross or 0))
        fee = (gross * PLATFORM_FEE_RATE).quantize(Decimal("0.01"))
        items.append({
            "shop_id": str(shop_id),
            "shop_name": name,
            "owner_id": str(owner_id),
            "orders": orders,
            "gross": str(gross),
            "platform_fee": str(fee),
            "payable": str(gross - fee),
            "status": "ready",
        })
    return {"success": True, "data": {"items": items, "platform_fee_rate": str(PLATFORM_FEE_RATE)}}


@router.get("/billing/export.csv")
async def billing_export_csv(db: DBSession, _: CurrentAdmin, period: str = Query("30d")):
    start, end = _period_bounds(period)
    rows = await db.execute(
        select(Payment, Order, Shop, User)
        .join(Order, Order.id == Payment.order_id)
        .join(Shop, Shop.id == Order.shop_id)
        .join(User, User.id == Order.buyer_id)
        .where(Payment.created_at >= start, Payment.created_at < end)
        .order_by(Payment.created_at.desc())
    )
    lines = ["payment_id,invoice_number,order_number,shop,buyer_email,method,status,amount,currency,paid_at,created_at"]
    for payment, order, shop, buyer in rows.all():
        values = [
            str(payment.id),
            _billing_invoice_number(order),
            order.order_number,
            (shop.name or "").replace(",", " "),
            buyer.email,
            payment.method.value,
            payment.status.value,
            str(payment.amount),
            payment.currency,
            payment.paid_at.isoformat() if payment.paid_at else "",
            payment.created_at.isoformat(),
        ]
        lines.append(",".join(values))
    return Response("\n".join(lines), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=shopx-billing-{period}.csv"})
