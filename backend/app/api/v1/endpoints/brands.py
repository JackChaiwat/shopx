from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.v1.dependencies.auth import CurrentAdmin, DBSession
from app.models.models import Brand
from slugify import slugify

router = APIRouter()


class BrandCreate(BaseModel):
    name: str
    description: Optional[str] = None


@router.get("")
async def list_brands(db: DBSession, q: Optional[str] = None):
    query = select(Brand).where(Brand.is_active == True)
    if q:
        query = query.where(Brand.name.ilike(f"%{q}%"))
    result = await db.execute(query.order_by(Brand.name))
    brands = result.scalars().all()
    return {
        "success": True,
        "data": [
            {"id": str(b.id), "name": b.name, "slug": b.slug, "description": b.description, "logo_url": b.logo_url}
            for b in brands
        ],
    }


@router.post("", status_code=201)
async def create_brand(body: BrandCreate, _: CurrentAdmin, db: DBSession):
    import shortuuid

    slug = slugify(body.name) or f"brand-{shortuuid.uuid()[:6].lower()}"
    existing = await db.execute(select(Brand.id).where(Brand.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{shortuuid.uuid()[:6].lower()}"

    brand = Brand(slug=slug, **body.model_dump())
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return {"success": True, "data": {"id": str(brand.id)}}
