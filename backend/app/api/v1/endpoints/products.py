from decimal import Decimal
from typing import List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, File, Form, Query, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload
from slugify import slugify  # แก้ไขจาก python_slugify เป็น slugify
import shortuuid

from app.api.v1.dependencies.auth import CurrentActiveUser, CurrentSeller, DBSession, OptionalUser
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.models import (
    Category, Product, ProductImage, ProductStatus, ProductVariant, Shop, ShopStatus,
)
from app.services.storage import storage_service

logger = structlog.get_logger(__name__)
router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


# ── Schemas ─────────────────────────────────────────────

class ProductCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    category_id: Optional[UUID] = None
    brand_id: Optional[UUID] = None
    base_price: Decimal
    sale_price: Optional[Decimal] = None
    stock_quantity: int = 0
    sku: Optional[str] = None
    weight: Optional[Decimal] = None
    tags: Optional[List[str]] = None
    attributes: Optional[dict] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    status: ProductStatus = ProductStatus.DRAFT

    @field_validator("base_price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Price must be positive")
        return v


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    category_id: Optional[UUID] = None
    brand_id: Optional[UUID] = None
    base_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None
    stock_quantity: Optional[int] = None
    sku: Optional[str] = None
    weight: Optional[Decimal] = None
    status: Optional[ProductStatus] = None
    tags: Optional[List[str]] = None
    attributes: Optional[dict] = None


class VariantCreateRequest(BaseModel):
    sku: str
    name: str
    price: Decimal
    sale_price: Optional[Decimal] = None
    stock_quantity: int = 0
    attributes: Optional[dict] = None


class ProductStockAdjustRequest(BaseModel):
    quantity_delta: Optional[int] = None
    stock_quantity: Optional[int] = None
    variant_id: Optional[UUID] = None
    reason: Optional[str] = None

    @field_validator("quantity_delta")
    @classmethod
    def validate_delta(cls, v: Optional[int]) -> Optional[int]:
        if v == 0:
            raise ValueError("Stock change cannot be zero")
        return v

    @field_validator("stock_quantity")
    @classmethod
    def validate_stock(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Stock cannot be negative")
        return v


# ── Helpers ──────────────────────────────────────────────

def _product_dict(p: Product, include_variants: bool = False) -> dict:
    primary_image = next((img.url for img in p.images if img.is_primary), None)
    if not primary_image and p.images:
        primary_image = p.images[0].url

    result = {
        "id": str(p.id),
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "short_description": p.short_description,
        "sku": p.sku,
        "base_price": str(p.base_price),
        "sale_price": str(p.sale_price) if p.sale_price else None,
        "stock_quantity": p.stock_quantity,
        "weight": str(p.weight) if p.weight else None,
        "status": p.status.value,
        "rating": str(p.rating),
        "review_count": p.review_count,
        "sold_count": p.sold_count,
        "view_count": p.view_count,
        "primary_image": primary_image,
        "images": [{"id": str(img.id), "url": img.url, "is_primary": img.is_primary} for img in p.images],
        "shop_id": str(p.shop_id),
        "category_id": str(p.category_id) if p.category_id else None,
        "brand_id": str(p.brand_id) if p.brand_id else None,
        "tags": p.tags,
        "created_at": p.created_at.isoformat(),
    }
    if include_variants:
        result["variants"] = [
            {
                "id": str(v.id),
                "sku": v.sku,
                "name": v.name,
                "price": str(v.price),
                "sale_price": str(v.sale_price) if v.sale_price else None,
                "stock_quantity": v.stock_quantity,
                "attributes": v.attributes,
                "image_url": v.image_url,
                "is_active": v.is_active,
            }
            for v in p.variants
        ]
        result["description"] = p.description
        result["attributes"] = p.attributes
    return result


async def _get_seller_shop(current_user, db) -> Shop:
    result = await db.execute(
        select(Shop).where(Shop.owner_id == current_user.id, Shop.deleted_at.is_(None))
    )
    shop = result.scalar_one_or_none()
    if not shop:
        raise BadRequestException("You don't have a shop. Register as a seller first.")
    if shop.status != ShopStatus.ACTIVE:
        raise ForbiddenException("Your shop is not active")
    return shop


def _sku_prefix_from_category(category: Optional[Category]) -> str:
    source = category.slug if category and category.slug else category.name if category else "product"
    letters = "".join(ch for ch in source.upper() if "A" <= ch <= "Z")
    return (letters[:3] or "PRD").ljust(3, "X")


def _validate_sku(sku: str) -> str:
    normalized = sku.strip().upper()
    if not normalized or not ("A" <= normalized[0] <= "Z"):
        raise BadRequestException("SKU must start with an English letter")
    return normalized


async def _generate_sku(db, category_id: Optional[UUID]) -> str:
    category = None
    if category_id:
        result = await db.execute(select(Category).where(Category.id == category_id, Category.is_active == True))
        category = result.scalar_one_or_none()
        if not category:
            raise BadRequestException("Selected category does not exist")

    prefix = _sku_prefix_from_category(category)
    count = (await db.execute(
        select(func.count(Product.id)).where(Product.category_id == category_id)
    )).scalar() or 0

    number = count + 1
    while True:
        sku = f"{prefix}-{number:06d}"
        existing = await db.execute(select(Product.id).where(Product.sku == sku))
        if not existing.scalar_one_or_none():
            return sku
        number += 1


# ── List & Search ────────────────────────────────────────

@router.get("")
async def list_products(
    current_user: OptionalUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: Optional[UUID] = None,
    brand_id: Optional[UUID] = None,
    shop_id: Optional[UUID] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    status: Optional[ProductStatus] = None,
    sort: str = Query("created_at", pattern="^(created_at|base_price|price|rating|sold_count|stock_quantity|view_count)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    q: Optional[str] = None,
):
    query = select(Product).options(selectinload(Product.images)).where(Product.deleted_at.is_(None))

    seller_owns_shop = False
    if shop_id and current_user:
        seller_owns_shop = bool((await db.execute(
            select(Shop.id).where(Shop.id == shop_id, Shop.owner_id == current_user.id)
        )).scalar_one_or_none())

    if seller_owns_shop:
        if status:
            query = query.where(Product.status == status)
    else:
        query = query.where(Product.status == ProductStatus.ACTIVE)

    if category_id:
        query = query.where(Product.category_id == category_id)
    if brand_id:
        query = query.where(Product.brand_id == brand_id)
    if shop_id:
        query = query.where(Product.shop_id == shop_id)
    if min_price is not None:
        query = query.where(Product.base_price >= min_price)
    if max_price is not None:
        query = query.where(Product.base_price <= max_price)
    if q:
        query = query.where(Product.name.ilike(f"%{q}%"))

    sort_name = "base_price" if sort == "price" else sort
    if sort_name == "base_price":
        sort_col = func.coalesce(Product.sale_price, Product.base_price)
    else:
        sort_col = getattr(Product, sort_name, Product.created_at)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    # Count
    count_result = await db.execute(
        select(func.count()).select_from(
            query.subquery()
        )
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    products = result.scalars().all()

    return {
        "success": True,
        "data": {
            "items": [_product_dict(p) for p in products],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit,
        },
    }


@router.get("/slug/{slug}")
async def get_product_by_slug(slug: str, db: DBSession):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.variants))
        .where(Product.slug == slug, Product.deleted_at.is_(None))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", slug)
    product.view_count += 1
    await db.commit()
    return {"success": True, "data": _product_dict(product, include_variants=True)}


@router.get("/sku-preview")
async def preview_sku(current_user: CurrentSeller, db: DBSession, category_id: Optional[UUID] = None):
    await _get_seller_shop(current_user, db)
    return {"success": True, "data": {"sku": await _generate_sku(db, category_id)}}


@router.get("/{product_id}")
async def get_product(product_id: UUID, db: DBSession):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.variants),
        )
        .where(Product.id == product_id, Product.deleted_at.is_(None))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", product_id)

    # Increment view count
    product.view_count += 1
    await db.commit()

    return {"success": True, "data": _product_dict(product, include_variants=True)}


# ── Seller CRUD ──────────────────────────────────────────

@router.post("", status_code=201)
async def create_product(
    body: ProductCreateRequest,
    current_user: CurrentSeller,
    db: DBSession,
):
    shop = await _get_seller_shop(current_user, db)

    # แก้ไข: ตอนนี้ slugify ทำงานได้ถูกต้องแล้ว
    slug = slugify(body.name)
    # Ensure unique slug
    existing = await db.execute(select(Product.id).where(Product.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{shortuuid.uuid()[:6].lower()}"

    data = body.model_dump(exclude_none=True)
    data["sku"] = _validate_sku(data["sku"]) if data.get("sku") else await _generate_sku(db, body.category_id)
    if (await db.execute(select(Product.id).where(Product.sku == data["sku"]))).scalar_one_or_none():
        data["sku"] = await _generate_sku(db, body.category_id)

    product = Product(
        shop_id=shop.id,
        slug=slug,
        **data,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    logger.info("Product created", product_id=str(product.id), shop_id=str(shop.id))
    return {"success": True, "data": {"id": str(product.id), "slug": product.slug, "sku": product.sku}}



@router.patch("/{product_id}/stock")
async def adjust_product_stock(
    product_id: UUID,
    body: ProductStockAdjustRequest,
    current_user: CurrentSeller,
    db: DBSession,
):
    if (body.quantity_delta is None) == (body.stock_quantity is None):
        raise BadRequestException("Send either quantity_delta or stock_quantity")

    shop = await _get_seller_shop(current_user, db)
    product = (await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.shop_id == shop.id, Product.deleted_at.is_(None))
        .with_for_update()
    )).scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", product_id)

    target = product
    target_type = "product"
    if body.variant_id:
        target = (await db.execute(
            select(ProductVariant)
            .where(ProductVariant.id == body.variant_id, ProductVariant.product_id == product_id)
            .with_for_update()
        )).scalar_one_or_none()
        if not target:
            raise NotFoundException("ProductVariant", body.variant_id)
        target_type = "variant"

    current_stock = int(target.stock_quantity or 0)
    new_stock = int(body.stock_quantity) if body.stock_quantity is not None else current_stock + int(body.quantity_delta)
    if new_stock < 0:
        raise BadRequestException("Stock cannot be negative")

    target.stock_quantity = new_stock

    if not body.variant_id:
        if new_stock > 0 and product.status == ProductStatus.OUT_OF_STOCK:
            product.status = ProductStatus.ACTIVE
        elif new_stock == 0 and product.status == ProductStatus.ACTIVE:
            product.status = ProductStatus.OUT_OF_STOCK

    await db.commit()
    logger.info(
        "Product stock adjusted",
        product_id=str(product.id),
        shop_id=str(shop.id),
        target_type=target_type,
        variant_id=str(body.variant_id) if body.variant_id else None,
        old_stock=current_stock,
        new_stock=new_stock,
        reason=body.reason,
    )
    return {
        "success": True,
        "data": {
            "product_id": str(product.id),
            "variant_id": str(body.variant_id) if body.variant_id else None,
            "stock_quantity": new_stock,
            "status": product.status.value,
        },
    }


@router.patch("/{product_id}")
async def update_product(
    product_id: UUID,
    body: ProductUpdateRequest,
    current_user: CurrentSeller,
    db: DBSession,
):
    shop = await _get_seller_shop(current_user, db)
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id, Product.deleted_at.is_(None))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", product_id)

    data = body.model_dump(exclude_none=True)
    if "sku" in data:
        data["sku"] = _validate_sku(data["sku"])
        existing_sku = (await db.execute(
            select(Product.id).where(Product.sku == data["sku"], Product.id != product_id)
        )).scalar_one_or_none()
        if existing_sku:
            raise BadRequestException("SKU already exists")

    for k, v in data.items():
        setattr(product, k, v)
    await db.commit()
    return {"success": True, "data": {"id": str(product.id)}}


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: UUID, current_user: CurrentSeller, db: DBSession):
    shop = await _get_seller_shop(current_user, db)
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id, Product.deleted_at.is_(None))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", product_id)
    product.soft_delete()
    product.status = ProductStatus.DELETED
    await db.commit()


@router.post("/{product_id}/images")
async def upload_product_image(
    product_id: UUID,
    current_user: CurrentSeller,
    db: DBSession,
    file: UploadFile = File(...),
    is_primary: bool = Form(False),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise BadRequestException("Only JPEG, PNG, and WebP images are allowed")

    shop = await _get_seller_shop(current_user, db)
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", product_id)

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise BadRequestException("Image must be under 10MB")

    url = await storage_service.upload_file(
        file_data=data,
        bucket=settings.MINIO_BUCKET_PRODUCTS,
        content_type=file.content_type,
    )

    if is_primary:
        from sqlalchemy import update
        await db.execute(
            update(ProductImage).where(ProductImage.product_id == product_id).values(is_primary=False)
        )

    img = ProductImage(product_id=product_id, url=url, is_primary=is_primary)
    db.add(img)
    await db.commit()
    await db.refresh(img)
    return {"success": True, "data": {"id": str(img.id), "url": url}}


@router.patch("/{product_id}/images/{image_id}/primary")
async def set_primary_product_image(
    product_id: UUID,
    image_id: UUID,
    current_user: CurrentSeller,
    db: DBSession,
):
    shop = await _get_seller_shop(current_user, db)
    product = (await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id, Product.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", product_id)

    image = (await db.execute(
        select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id)
    )).scalar_one_or_none()
    if not image:
        raise NotFoundException("ProductImage", image_id)

    from sqlalchemy import update
    await db.execute(update(ProductImage).where(ProductImage.product_id == product_id).values(is_primary=False))
    image.is_primary = True
    await db.commit()
    return {"success": True, "data": {"id": str(image.id)}}


@router.delete("/{product_id}/images/{image_id}", status_code=204)
async def delete_product_image(
    product_id: UUID,
    image_id: UUID,
    current_user: CurrentSeller,
    db: DBSession,
):
    shop = await _get_seller_shop(current_user, db)
    product = (await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id, Product.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", product_id)

    image = (await db.execute(
        select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id)
    )).scalar_one_or_none()
    if not image:
        raise NotFoundException("ProductImage", image_id)

    await db.delete(image)
    await db.commit()


@router.post("/{product_id}/variants", status_code=201)
async def add_variant(
    product_id: UUID,
    body: VariantCreateRequest,
    current_user: CurrentSeller,
    db: DBSession,
):
    shop = await _get_seller_shop(current_user, db)
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id, Product.deleted_at.is_(None))
    )
    if not result.scalar_one_or_none():
        raise NotFoundException("Product", product_id)

    variant = ProductVariant(product_id=product_id, **body.model_dump())
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return {"success": True, "data": {"id": str(variant.id)}}
