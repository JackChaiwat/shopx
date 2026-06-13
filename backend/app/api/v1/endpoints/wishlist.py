from uuid import UUID
from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import CurrentActiveUser, DBSession
from app.core.exceptions import ConflictException, NotFoundException
from app.models.models import Product, ProductStatus, Wishlist

router = APIRouter()


@router.get("")
async def get_wishlist(current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(Wishlist)
        .options(selectinload(Wishlist.product).selectinload(Product.images))
        .where(Wishlist.user_id == current_user.id)
    )
    items = result.scalars().all()
    return {
        "success": True,
        "data": [
            {
                "product_id": str(i.product_id),
                "product_slug": i.product.slug,
                "product_name": i.product.name,
                "base_price": str(i.product.base_price),
                "sale_price": str(i.product.sale_price) if i.product.sale_price else None,
                "primary_image": next((img.url for img in i.product.images if img.is_primary), None),
                "stock_quantity": i.product.stock_quantity,
                "status": i.product.status.value,
                "added_at": i.created_at.isoformat(),
            }
            for i in items
        ],
    }


@router.post("/{product_id}", status_code=201)
async def add_to_wishlist(product_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    p_result = await db.execute(select(Product.id).where(Product.id == product_id))
    if not p_result.scalar_one_or_none():
        raise NotFoundException("Product", product_id)

    existing = await db.execute(
        select(Wishlist).where(Wishlist.user_id == current_user.id, Wishlist.product_id == product_id)
    )
    if existing.scalar_one_or_none():
        raise ConflictException("Product already in wishlist")

    db.add(Wishlist(user_id=current_user.id, product_id=product_id))
    await db.commit()
    return {"success": True, "message": "Added to wishlist"}


@router.delete("/{product_id}", status_code=204)
async def remove_from_wishlist(product_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(Wishlist).where(Wishlist.user_id == current_user.id, Wishlist.product_id == product_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("Wishlist item")
    await db.delete(item)
    await db.commit()
