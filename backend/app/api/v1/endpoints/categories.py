from typing import Optional
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select, update

from app.api.v1.dependencies.auth import CurrentSeller, DBSession
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.models import Category, Product
from slugify import slugify

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = None


@router.get("")
async def list_categories(db: DBSession, parent_id: Optional[UUID] = None):
    query = select(Category).where(Category.is_active == True)
    if parent_id is not None:
        query = query.where(Category.parent_id == parent_id)
    else:
        query = query.where(Category.parent_id.is_(None))
    result = await db.execute(query.order_by(Category.sort_order))
    cats = result.scalars().all()
    return {
        "success": True,
        "data": [
            {
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "description": c.description,
                "image_url": c.image_url,
                "parent_id": str(c.parent_id) if c.parent_id else None,
                "sort_order": c.sort_order,
            }
            for c in cats
        ],
    }


@router.post("", status_code=201)
async def create_category(body: CategoryCreate, _: CurrentSeller, db: DBSession):
    import shortuuid

    slug = slugify(body.name) or f"category-{shortuuid.uuid()[:6].lower()}"

    existing = await db.execute(select(Category.id).where(Category.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{shortuuid.uuid()[:6].lower()}"

    cat = Category(slug=slug, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return {"success": True, "data": {"id": str(cat.id), "slug": cat.slug}}


@router.patch("/{category_id}")
async def update_category(category_id: UUID, body: CategoryUpdate, _: CurrentSeller, db: DBSession):
    import shortuuid

    result = await db.execute(select(Category).where(Category.id == category_id, Category.is_active == True))
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category", category_id)

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        category.name = data["name"]
        next_slug = slugify(data["name"]) or f"category-{shortuuid.uuid()[:6].lower()}"
        existing = await db.execute(
            select(Category.id).where(Category.slug == next_slug, Category.id != category_id)
        )
        category.slug = f"{next_slug}-{shortuuid.uuid()[:6].lower()}" if existing.scalar_one_or_none() else next_slug

    for field in ("description", "parent_id", "sort_order"):
        if field in data:
            setattr(category, field, data[field])

    await db.commit()
    await db.refresh(category)
    return {"success": True, "data": {"id": str(category.id), "slug": category.slug}}


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: UUID, _: CurrentSeller, db: DBSession, detach_products: bool = False):
    result = await db.execute(select(Category).where(Category.id == category_id, Category.is_active == True))
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category", category_id)

    has_products = (await db.execute(select(Product.id).where(Product.category_id == category_id).limit(1))).scalar_one_or_none()
    if has_products and not detach_products:
        raise BadRequestException("Cannot delete a category that is still used by products")

    has_children = (await db.execute(select(Category.id).where(Category.parent_id == category_id, Category.is_active == True).limit(1))).scalar_one_or_none()
    if has_children:
        raise BadRequestException("Cannot delete a category that has subcategories")

    if has_products and detach_products:
        await db.execute(update(Product).where(Product.category_id == category_id).values(category_id=None))

    category.is_active = False
    await db.commit()
