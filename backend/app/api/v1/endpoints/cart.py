from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import CurrentActiveUser, DBSession
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.models import Cart, CartItem, Product, ProductStatus, ProductVariant

router = APIRouter()


class CartAddRequest(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    quantity: int = 1


class CartUpdateRequest(BaseModel):
    quantity: int


def _cart_item_dict(item: CartItem) -> dict:
    p = item.product
    price = Decimal(str(item.variant.price if item.variant else p.base_price))
    sale = item.variant.sale_price if item.variant else p.sale_price
    effective = Decimal(str(sale)) if sale else price

    primary = next((img.url for img in p.images if img.is_primary), None)
    if not primary and p.images:
        primary = p.images[0].url

    return {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "product_name": p.name,
        "product_image": primary,
        "shop_id": str(p.shop_id),
        "variant_id": str(item.variant_id) if item.variant_id else None,
        "variant_name": item.variant.name if item.variant else None,
        "quantity": item.quantity,
        "unit_price": str(effective),
        "subtotal": str(effective * item.quantity),
        "stock_quantity": item.variant.stock_quantity if item.variant else p.stock_quantity,
    }


async def _get_or_create_cart(user_id: UUID, db) -> Cart:
    result = await db.execute(
        select(Cart).where(Cart.user_id == user_id)
    )
    cart = result.scalar_one_or_none()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
    return cart


@router.get("")
async def get_cart(current_user: CurrentActiveUser, db: DBSession):
    cart = await _get_or_create_cart(current_user.id, db)

    result = await db.execute(
        select(CartItem)
        .options(
            selectinload(CartItem.product).selectinload(Product.images),
            selectinload(CartItem.variant),
        )
        .where(CartItem.cart_id == cart.id)
    )
    items = result.scalars().all()

    total = sum(
        Decimal(item.unit_price if hasattr(item, "unit_price") else "0") * item.quantity
        for item in items
    )

    cart_items = [_cart_item_dict(i) for i in items]
    cart_total = sum(Decimal(i["subtotal"]) for i in cart_items)

    return {
        "success": True,
        "data": {
            "id": str(cart.id),
            "items": cart_items,
            "total": str(cart_total),
            "item_count": len(items),
        },
    }


@router.post("/items", status_code=201)
async def add_to_cart(body: CartAddRequest, current_user: CurrentActiveUser, db: DBSession):
    # Validate product
    result = await db.execute(
        select(Product).where(Product.id == body.product_id, Product.status == ProductStatus.ACTIVE)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", body.product_id)

    # Validate variant if provided
    if body.variant_id:
        vresult = await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == body.variant_id,
                ProductVariant.product_id == body.product_id,
                ProductVariant.is_active == True,
            )
        )
        if not vresult.scalar_one_or_none():
            raise NotFoundException("Product variant", body.variant_id)

    # Check stock
    if body.variant_id:
        vr = await db.execute(select(ProductVariant).where(ProductVariant.id == body.variant_id))
        variant = vr.scalar_one_or_none()
        if variant and variant.stock_quantity < body.quantity:
            raise BadRequestException(f"Only {variant.stock_quantity} items in stock")
    elif product.stock_quantity < body.quantity:
        raise BadRequestException(f"Only {product.stock_quantity} items in stock")

    cart = await _get_or_create_cart(current_user.id, db)

    # Check if already in cart
    existing = await db.execute(
        select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == body.product_id,
            CartItem.variant_id == body.variant_id,
        )
    )
    item = existing.scalar_one_or_none()

    if item:
        item.quantity = min(item.quantity + body.quantity, 99)
    else:
        item = CartItem(
            cart_id=cart.id,
            product_id=body.product_id,
            variant_id=body.variant_id,
            quantity=body.quantity,
        )
        db.add(item)

    await db.commit()
    return {"success": True, "message": "Added to cart"}


@router.patch("/items/{item_id}")
async def update_cart_item(
    item_id: UUID,
    body: CartUpdateRequest,
    current_user: CurrentActiveUser,
    db: DBSession,
):
    cart = await _get_or_create_cart(current_user.id, db)
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("Cart item", item_id)

    if body.quantity <= 0:
        await db.delete(item)
    else:
        item.quantity = min(body.quantity, 99)

    await db.commit()
    return {"success": True}


@router.delete("/items/{item_id}", status_code=204)
async def remove_from_cart(item_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    cart = await _get_or_create_cart(current_user.id, db)
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("Cart item", item_id)
    await db.delete(item)
    await db.commit()


@router.delete("", status_code=204)
async def clear_cart(current_user: CurrentActiveUser, db: DBSession):
    cart = await _get_or_create_cart(current_user.id, db)
    result = await db.execute(select(CartItem).where(CartItem.cart_id == cart.id))
    for item in result.scalars().all():
        await db.delete(item)
    await db.commit()
