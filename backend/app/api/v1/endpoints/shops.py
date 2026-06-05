from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, literal_column, select, update, desc
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import CurrentActiveUser, CurrentAdmin, CurrentSeller, DBSession
from app.core.config import settings
from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.models.models import (
    Order, OrderStatus, Payment, PaymentStatus, Product, ProductStatus,
    Shop, ShopFollow, ShopStatus, UserRole, Review, ReviewStatus,
)
from app.services.storage import storage_service

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class ShopCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None


class ShopUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None


def _shop_dict(shop: Shop) -> dict:
    return {
        "id": str(shop.id), "name": shop.name, "slug": shop.slug,
        "description": shop.description, "logo_url": shop.logo_url, "banner_url": shop.banner_url,
        "status": shop.status.value, "rating": str(shop.rating), "total_sales": shop.total_sales,
        "follower_count": shop.follower_count, "response_rate": str(shop.response_rate),
        "phone": shop.phone, "email": shop.email, "address": shop.address,
        "latitude": str(shop.latitude) if shop.latitude is not None else None,
        "longitude": str(shop.longitude) if shop.longitude is not None else None,
        "verified_at": shop.verified_at.isoformat() if shop.verified_at else None,
        "created_at": shop.created_at.isoformat(),
    }


async def _get_seller_shop(user, db) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id, Shop.deleted_at.is_(None)))
    shop = result.scalar_one_or_none()
    if not shop:
        raise BadRequestException("You don't have a shop yet")
    return shop


# ── Public endpoints ─────────────────────────────────────

@router.get("")
async def list_shops(db: DBSession, page: int = 1, limit: int = 20, q: Optional[str] = None):
    query = select(Shop).where(Shop.status == ShopStatus.ACTIVE, Shop.deleted_at.is_(None))
    if q: query = query.where(Shop.name.ilike(f"%{q}%"))
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    shops = result.scalars().all()
    return {"success": True, "data": [_shop_dict(s) for s in shops]}


@router.get("/my")
async def get_my_shop(current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id, Shop.deleted_at.is_(None)))
    shop = result.scalar_one_or_none()
    if not shop: raise NotFoundException("Shop")
    return {"success": True, "data": _shop_dict(shop)}


@router.get("/{shop_id}")
async def get_shop(shop_id: UUID, db: DBSession):
    result = await db.execute(select(Shop).where(Shop.id == shop_id, Shop.deleted_at.is_(None)))
    shop = result.scalar_one_or_none()
    if not shop: raise NotFoundException("Shop", shop_id)
    return {"success": True, "data": _shop_dict(shop)}


# ── Seller: shop registration & settings ────────────────

@router.post("", status_code=201)
async def register_shop(body: ShopCreateRequest, current_user: CurrentActiveUser, db: DBSession):
    existing = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    if existing.scalar_one_or_none(): raise ConflictException("You already have a shop")

    from slugify import slugify
    import shortuuid
    slug = slugify(body.name)
    if (await db.execute(select(Shop.id).where(Shop.slug == slug))).scalar_one_or_none():
        slug = f"{slug}-{shortuuid.uuid()[:6].lower()}"

    shop = Shop(owner_id=current_user.id, slug=slug, status=ShopStatus.PENDING, **body.model_dump())
    db.add(shop)
    current_user.role = UserRole.SELLER
    await db.commit()
    await db.refresh(shop)
    return {"success": True, "data": _shop_dict(shop)}


@router.patch("/my")
async def update_my_shop(body: ShopUpdateRequest, current_user: CurrentSeller, db: DBSession):
    shop = await _get_seller_shop(current_user, db)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(shop, k, v)
    await db.commit()
    return {"success": True, "data": _shop_dict(shop)}


@router.post("/my/logo")
async def upload_shop_logo(current_user: CurrentSeller, db: DBSession, file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_IMAGE_TYPES: raise BadRequestException("Invalid image type")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024: raise BadRequestException("Logo must be under 5MB")
    shop = await _get_seller_shop(current_user, db)
    url = await storage_service.upload_file(data, settings.MINIO_BUCKET_AVATARS, content_type=file.content_type)
    shop.logo_url = url
    await db.commit()
    return {"success": True, "data": {"logo_url": url}}


@router.post("/my/banner")
async def upload_shop_banner(current_user: CurrentSeller, db: DBSession, file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_IMAGE_TYPES: raise BadRequestException("Invalid image type")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024: raise BadRequestException("Banner must be under 10MB")
    shop = await _get_seller_shop(current_user, db)
    url = await storage_service.upload_file(data, settings.MINIO_BUCKET_PRODUCTS, content_type=file.content_type)
    shop.banner_url = url
    await db.commit()
    return {"success": True, "data": {"banner_url": url}}


# ── Seller: analytics dashboard ──────────────────────────

@router.get("/my/analytics/overview")
async def seller_analytics_overview(current_user: CurrentSeller, db: DBSession, period: str = "30d"):
    shop = await _get_seller_shop(current_user, db)
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start = datetime.now(timezone.utc) - timedelta(days=days)

    # Total revenue
    revenue = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(Order, Payment.order_id == Order.id)
        .where(Order.shop_id == shop.id, Payment.status == PaymentStatus.PAID, Payment.paid_at >= start)
    )).scalar() or Decimal("0")

    # Order counts by status
    order_stats = await db.execute(
        select(Order.status, func.count(Order.id))
        .where(Order.shop_id == shop.id, Order.created_at >= start)
        .group_by(Order.status)
    )

    # Daily revenue
    day_bucket = func.date_trunc(literal_column("'day'"), Payment.paid_at)
    daily = await db.execute(
        select(day_bucket.label("day"),
               func.sum(Payment.amount).label("revenue"), func.count(Order.id).label("orders"))
        .join(Order, Payment.order_id == Order.id)
        .where(Order.shop_id == shop.id, Payment.status == PaymentStatus.PAID, Payment.paid_at >= start)
        .group_by(day_bucket)
        .order_by(day_bucket)
    )

    # Top products
    top_products = await db.execute(
        select(Product.name, Product.id, Product.sold_count, Product.base_price, Product.sale_price)
        .where(Product.shop_id == shop.id, Product.deleted_at.is_(None))
        .order_by(Product.sold_count.desc()).limit(5)
    )

    # Average order value
    avg_order = (await db.execute(
        select(func.avg(Order.total_amount))
        .where(Order.shop_id == shop.id, Order.created_at >= start)
    )).scalar() or Decimal("0")

    # Product count
    product_count = (await db.execute(
        select(func.count(Product.id))
        .where(Product.shop_id == shop.id, Product.status == ProductStatus.ACTIVE)
    )).scalar() or 0

    # Review summary
    avg_rating = (await db.execute(
        select(func.avg(Review.rating))
        .join(Product, Review.product_id == Product.id)
        .where(Product.shop_id == shop.id)
    )).scalar() or 0

    return {"success": True, "data": {
        "period": period,
        "revenue": str(revenue),
        "avg_order_value": str(round(avg_order, 2)),
        "active_products": product_count,
        "avg_rating": str(round(float(avg_rating), 2)),
        "follower_count": shop.follower_count,
        "total_sales": shop.total_sales,
        "order_status": {r[0].value: r[1] for r in order_stats.all()},
        "daily": [{"date": r.day.strftime("%Y-%m-%d"), "revenue": str(r.revenue), "orders": r.orders}
                  for r in daily.all()],
        "top_products": [{"id": str(r.id), "name": r.name, "sold": r.sold_count,
                          "price": str(r.sale_price or r.base_price)} for r in top_products.all()],
    }}


@router.get("/my/analytics/products")
async def seller_product_analytics(current_user: CurrentSeller, db: DBSession):
    shop = await _get_seller_shop(current_user, db)

    products = await db.execute(
        select(Product.id, Product.name, Product.base_price, Product.sale_price,
               Product.stock_quantity, Product.sold_count, Product.view_count,
               Product.rating, Product.review_count, Product.status)
        .where(Product.shop_id == shop.id, Product.deleted_at.is_(None))
        .order_by(Product.sold_count.desc())
    )

    return {"success": True, "data": [
        {"id": str(r.id), "name": r.name, "price": str(r.sale_price or r.base_price),
         "stock": r.stock_quantity, "sold": r.sold_count, "views": r.view_count,
         "rating": str(r.rating), "reviews": r.review_count, "status": r.status.value,
         "conversion": round(r.sold_count / r.view_count * 100, 2) if r.view_count > 0 else 0}
        for r in products.all()
    ]}


@router.get("/my/analytics/reviews")
async def seller_reviews(current_user: CurrentSeller, db: DBSession, page: int = 1, limit: int = 20):
    shop = await _get_seller_shop(current_user, db)

    query = (
        select(Review)
        .join(Product, Review.product_id == Product.id)
        .where(Product.shop_id == shop.id, Review.deleted_at.is_(None))
        .order_by(Review.created_at.desc())
    )
    count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    reviews = (await db.execute(
        query.options(selectinload(Review.product)).offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    # Rating distribution
    dist = await db.execute(
        select(Review.rating, func.count(Review.id))
        .join(Product, Review.product_id == Product.id)
        .where(Product.shop_id == shop.id, Review.status == ReviewStatus.APPROVED, Review.deleted_at.is_(None))
        .group_by(Review.rating)
    )

    return {"success": True, "data": {
        "items": [{"id": str(r.id), "product_id": str(r.product_id),
                   "product_name": r.product.name if r.product else None,
                   "rating": r.rating, "title": r.title, "content": r.content,
                   "image_urls": r.image_urls, "status": r.status.value,
                   "seller_reply": r.seller_reply,
                   "seller_replied_at": r.seller_replied_at.isoformat() if r.seller_replied_at else None,
                   "created_at": r.created_at.isoformat()} for r in reviews],
        "total": count,
        "rating_distribution": {str(r[0]): r[1] for r in dist.all()},
    }}


# ── Follow / Unfollow ────────────────────────────────────

@router.post("/{shop_id}/follow", status_code=201)
async def follow_shop(shop_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop: raise NotFoundException("Shop", shop_id)
    existing = await db.execute(
        select(ShopFollow).where(ShopFollow.user_id == current_user.id, ShopFollow.shop_id == shop_id)
    )
    if existing.scalar_one_or_none(): raise ConflictException("Already following this shop")
    db.add(ShopFollow(user_id=current_user.id, shop_id=shop_id))
    shop.follower_count += 1
    await db.commit()
    return {"success": True, "message": "Shop followed"}


@router.delete("/{shop_id}/follow", status_code=204)
async def unfollow_shop(shop_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(ShopFollow).where(ShopFollow.user_id == current_user.id, ShopFollow.shop_id == shop_id)
    )
    follow = result.scalar_one_or_none()
    if not follow: raise NotFoundException("Follow")
    await db.delete(follow)
    result2 = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result2.scalar_one_or_none()
    if shop and shop.follower_count > 0: shop.follower_count -= 1
    await db.commit()
