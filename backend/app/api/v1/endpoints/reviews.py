"""Reviews endpoint"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from app.api.v1.dependencies.auth import CurrentActiveUser, CurrentSeller, DBSession, OptionalUser
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.models import Order, OrderItem, OrderStatus, Product, Review, ReviewStatus, Shop
from app.services.storage import storage_service

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class ReviewCreate(BaseModel):
    product_id: UUID
    order_id: UUID
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = None
    content: Optional[str] = None


class SellerReplyRequest(BaseModel):
    reply: str


class ReviewStatusRequest(BaseModel):
    status: ReviewStatus


def _review_dict(r: Review) -> dict:
    return {
        "id": str(r.id),
        "product_id": str(r.product_id),
        "user_id": str(r.user_id),
        "rating": r.rating,
        "title": r.title,
        "content": r.content,
        "image_urls": r.image_urls,
        "seller_reply": r.seller_reply,
        "seller_replied_at": r.seller_replied_at.isoformat() if r.seller_replied_at else None,
        "status": r.status.value,
        "helpful_count": r.helpful_count,
        "created_at": r.created_at.isoformat(),
    }


async def _get_owned_review(review_id: UUID, current_user, db) -> Review:
    result = await db.execute(select(Review).where(Review.id == review_id, Review.deleted_at.is_(None)))
    review = result.scalar_one_or_none()
    if not review:
        raise NotFoundException("Review", review_id)

    product = await db.execute(select(Product).where(Product.id == review.product_id))
    p = product.scalar_one_or_none()
    if not p:
        raise NotFoundException("Product")

    shop = await db.execute(select(Shop).where(Shop.id == p.shop_id, Shop.owner_id == current_user.id))
    if not shop.scalar_one_or_none():
        raise ForbiddenException("You don't own this product's shop")

    return review


async def _recalculate_product_rating(product_id: UUID, db) -> None:
    stats = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id))
        .where(
            Review.product_id == product_id,
            Review.status == ReviewStatus.APPROVED,
            Review.deleted_at.is_(None),
        )
    )
    avg_rating, count = stats.one()
    await db.execute(
        update(Product)
        .where(Product.id == product_id)
        .values(rating=round(float(avg_rating or 0), 2), review_count=count)
    )


@router.get("")
async def list_reviews(
    db: DBSession,
    product_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    rating: Optional[int] = Query(None, ge=1, le=5),
):
    query = select(Review).where(Review.status == ReviewStatus.APPROVED, Review.deleted_at.is_(None))
    if product_id:
        query = query.where(Review.product_id == product_id)
    if rating:
        query = query.where(Review.rating == rating)
    query = query.order_by(Review.created_at.desc())

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    reviews = result.scalars().all()
    return {"success": True, "data": [_review_dict(r) for r in reviews]}


@router.post("", status_code=201)
async def create_review(body: ReviewCreate, current_user: CurrentActiveUser, db: DBSession):
    # Ensure product exists
    p_result = await db.execute(select(Product.id).where(Product.id == body.product_id))
    if not p_result.scalar_one_or_none():
        raise NotFoundException("Product", body.product_id)

    order_result = await db.execute(
        select(Order)
        .where(
            Order.id == body.order_id,
            Order.buyer_id == current_user.id,
            Order.status == OrderStatus.DELIVERED,
        )
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise BadRequestException("Reviews can only be submitted for delivered orders")

    item_result = await db.execute(
        select(OrderItem)
        .where(
            OrderItem.order_id == body.order_id,
            OrderItem.product_id == body.product_id,
        )
    )
    order_item = item_result.scalar_one_or_none()
    if not order_item:
        raise BadRequestException("This product is not part of the selected order")

    existing = await db.execute(
        select(Review.id).where(
            Review.user_id == current_user.id,
            Review.product_id == body.product_id,
            Review.order_id == body.order_id,
            Review.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestException("You already reviewed this product for this order")

    review = Review(
        user_id=current_user.id,
        **body.model_dump(),
        status=ReviewStatus.APPROVED,
    )
    db.add(review)

    # Update product rating
    await db.flush()
    order_item.review_id = review.id
    await _recalculate_product_rating(body.product_id, db)

    await db.commit()
    await db.refresh(review)
    return {"success": True, "data": _review_dict(review)}


@router.post("/{review_id}/seller-reply")
async def seller_reply(review_id: UUID, body: SellerReplyRequest, current_user: CurrentSeller, db: DBSession):
    review = await _get_owned_review(review_id, current_user, db)

    review.seller_reply = body.reply
    review.seller_replied_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "data": _review_dict(review)}


@router.patch("/{review_id}/seller-reply")
async def update_seller_reply(review_id: UUID, body: SellerReplyRequest, current_user: CurrentSeller, db: DBSession):
    review = await _get_owned_review(review_id, current_user, db)
    review.seller_reply = body.reply
    review.seller_replied_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "data": _review_dict(review)}


@router.delete("/{review_id}/seller-reply", status_code=204)
async def delete_seller_reply(review_id: UUID, current_user: CurrentSeller, db: DBSession):
    review = await _get_owned_review(review_id, current_user, db)
    review.seller_reply = None
    review.seller_replied_at = None
    await db.commit()


@router.patch("/{review_id}/status")
async def update_review_status(review_id: UUID, body: ReviewStatusRequest, current_user: CurrentSeller, db: DBSession):
    if body.status == ReviewStatus.PENDING:
        raise BadRequestException("Seller can only approve or hide reviews")

    review = await _get_owned_review(review_id, current_user, db)
    review.status = body.status
    await _recalculate_product_rating(review.product_id, db)
    await db.commit()
    return {"success": True, "data": _review_dict(review)}
