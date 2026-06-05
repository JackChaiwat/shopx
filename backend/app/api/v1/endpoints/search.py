from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import DBSession
from app.models.models import Product, ProductStatus, Shop, ShopStatus

router = APIRouter()


@router.get("")
async def search(
    db: DBSession,
    q: str = Query(..., min_length=1),
    type: str = Query("products", pattern="^(products|shops|all)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: Optional[UUID] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    sort: str = Query("relevance", pattern="^(relevance|price_asc|price_desc|rating|sold)$"),
):
    results = {}
    keyword = f"%{q}%"

    if type in ("products", "all"):
        query = (
            select(Product)
            .options(selectinload(Product.images))
            .where(
                Product.status == ProductStatus.ACTIVE,
                Product.deleted_at.is_(None),
                Product.name.ilike(keyword),
            )
        )
        if category_id:
            query = query.where(Product.category_id == category_id)
        if min_price:
            query = query.where(Product.base_price >= min_price)
        if max_price:
            query = query.where(Product.base_price <= max_price)

        if sort == "price_asc":
            query = query.order_by(Product.base_price.asc())
        elif sort == "price_desc":
            query = query.order_by(Product.base_price.desc())
        elif sort == "rating":
            query = query.order_by(Product.rating.desc())
        elif sort == "sold":
            query = query.order_by(Product.sold_count.desc())
        else:
            query = query.order_by(Product.sold_count.desc())

        count_q = await db.execute(select(func.count()).select_from(query.subquery()))
        total = count_q.scalar() or 0

        result = await db.execute(query.offset((page - 1) * limit).limit(limit))
        products = result.scalars().all()

        results["products"] = {
            "items": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "slug": p.slug,
                    "base_price": str(p.base_price),
                    "sale_price": str(p.sale_price) if p.sale_price else None,
                    "rating": str(p.rating),
                    "sold_count": p.sold_count,
                    "primary_image": next((i.url for i in p.images if i.is_primary), None) or (p.images[0].url if p.images else None),
                }
                for p in products
            ],
            "total": total,
        }

    if type in ("shops", "all"):
        shop_query = (
            select(Shop)
            .where(Shop.status == ShopStatus.ACTIVE, Shop.deleted_at.is_(None), Shop.name.ilike(keyword))
            .order_by(Shop.rating.desc())
            .limit(10)
        )
        shop_result = await db.execute(shop_query)
        shops = shop_result.scalars().all()
        results["shops"] = {
            "items": [{"id": str(s.id), "name": s.name, "slug": s.slug, "logo_url": s.logo_url, "rating": str(s.rating)} for s in shops]
        }

    return {"success": True, "data": results}
