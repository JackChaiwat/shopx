#!/usr/bin/env python3
"""
Seed script - run inside the backend container after migrations:
  docker compose exec backend python scripts/seed.py
"""
import asyncio
import sys
import os

sys.path.insert(0, "/app")
os.environ.setdefault("APP_ENV", "development")

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import (
    Brand, Category, Shop, ShopStatus, User, UserRole, UserStatus,
    Product, ProductImage, ProductStatus,
)


async def upsert(db: AsyncSession, model, conflict_col: str, data: dict):
    """Insert if not exists, skip if conflict. Returns the row either way."""
    stmt = (
        pg_insert(model)
        .values(**data)
        .on_conflict_do_nothing(index_elements=[conflict_col])
    )
    await db.execute(stmt)
    await db.flush()
    result = await db.execute(
        select(model).where(getattr(model, conflict_col) == data[conflict_col])
    )
    return result.scalar_one()


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:

        # ── Users ────────────────────────────────
        users_data = [
            {
                "email": "admin@shopx.com",
                "hashed_password": hash_password("Admin@123456"),
                "full_name": "Platform Admin",
                "role": UserRole.ADMIN,
                "status": UserStatus.ACTIVE,
                "is_email_verified": True,
            },
            {
                "email": "buyer@shopx.com",
                "hashed_password": hash_password("Buyer@123456"),
                "full_name": "Test Buyer",
                "role": UserRole.BUYER,
                "status": UserStatus.ACTIVE,
                "is_email_verified": True,
            },
            {
                "email": "seller@shopx.com",
                "hashed_password": hash_password("Seller@123456"),
                "full_name": "Test Seller",
                "role": UserRole.SELLER,
                "status": UserStatus.ACTIVE,
                "is_email_verified": True,
            },
        ]
        users = {}
        for u in users_data:
            row = await upsert(db, User, "email", u)
            users[u["email"]] = row

        seller = users["seller@shopx.com"]

        # ── Categories ───────────────────────────
        cats_data = [
            ("Electronics", "electronics"),
            ("Fashion", "fashion"),
            ("Home & Living", "home-living"),
            ("Sports", "sports"),
            ("Beauty", "beauty"),
            ("Books", "books"),
            ("Toys", "toys"),
            ("Food", "food"),
        ]
        categories = {}
        for name, slug in cats_data:
            row = await upsert(db, Category, "slug", {"name": name, "slug": slug, "is_active": True})
            categories[slug] = row

        # ── Brands ───────────────────────────────
        brands_data = [
            ("Apple", "apple"),
            ("Samsung", "samsung"),
            ("Nike", "nike"),
            ("Adidas", "adidas"),
            ("Sony", "sony"),
        ]
        brands = {}
        for name, slug in brands_data:
            row = await upsert(db, Brand, "slug", {"name": name, "slug": slug, "is_active": True})
            brands[slug] = row

        # ── Seller shop ──────────────────────────
        shop = await upsert(db, Shop, "slug", {
            "owner_id": seller.id,
            "name": "TechGadgets Store",
            "slug": "techgadgets-store",
            "description": "Your one-stop shop for the latest tech gadgets",
            "status": ShopStatus.ACTIVE,
        })

        # ── Products ─────────────────────────────
        import shortuuid

        products_data = [
            {
                "name": "Wireless Bluetooth Headphones",
                "slug": "wireless-bluetooth-headphones",
                "short_description": "Premium sound quality with 30hr battery",
                "base_price": "1299.00",
                "sale_price": "999.00",
                "stock_quantity": 50,
                "status": ProductStatus.ACTIVE,
            },
            {
                "name": "Mechanical Gaming Keyboard",
                "slug": "mechanical-gaming-keyboard",
                "short_description": "RGB backlit, tactile switches",
                "base_price": "2500.00",
                "sale_price": None,
                "stock_quantity": 30,
                "status": ProductStatus.ACTIVE,
            },
            {
                "name": "4K USB-C Monitor",
                "slug": "4k-usb-c-monitor-27inch",
                "short_description": "27 inch 4K IPS display with USB-C",
                "base_price": "12990.00",
                "sale_price": "10990.00",
                "stock_quantity": 15,
                "status": ProductStatus.ACTIVE,
            },
        ]

        for pd in products_data:
            product = await upsert(db, Product, "slug", {
                "shop_id": shop.id,
                "category_id": categories["electronics"].id,
                "brand_id": brands["samsung"].id,
                "description": f"<p>{pd['short_description']}. High quality product.</p>",
                "sku": f"SKU-{shortuuid.uuid()[:8].upper()}",
                **pd,
            })

            # เพิ่ม primary image เฉพาะถ้ายังไม่มี
            existing_img = await db.execute(
                select(ProductImage).where(
                    ProductImage.product_id == product.id,
                    ProductImage.is_primary == True,
                )
            )
            if not existing_img.scalar_one_or_none():
                db.add(ProductImage(
                    product_id=product.id,
                    url="https://via.placeholder.com/600x600.png?text=Product",
                    is_primary=True,
                ))

        await db.commit()
        print("✅ Seed data inserted successfully")
        print("\nTest accounts:")
        print("  Admin:  admin@shopx.com  / Admin@123456")
        print("  Buyer:  buyer@shopx.com  / Buyer@123456")
        print("  Seller: seller@shopx.com / Seller@123456")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())