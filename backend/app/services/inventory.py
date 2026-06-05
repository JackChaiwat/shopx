from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.models.models import CartItem, Order, Product, ProductStatus, ProductVariant


def _label(product_name: str, variant_name: str | None = None) -> str:
    return f"{product_name} ({variant_name})" if variant_name else product_name


async def reserve_cart_stock(cart_items: list[CartItem], db: AsyncSession) -> None:
    """Reserve stock while checkout is creating orders.

    Rows are locked with SELECT FOR UPDATE so concurrent checkouts cannot sell
    the same unit twice.
    """
    ordered_items = sorted(
        cart_items,
        key=lambda item: (str(item.product_id), str(item.variant_id or "")),
    )

    for item in ordered_items:
        if item.variant_id:
            result = await db.execute(
                select(ProductVariant)
                .where(ProductVariant.id == item.variant_id)
                .with_for_update()
            )
            variant = result.scalar_one_or_none()
            if not variant or not variant.is_active:
                raise BadRequestException(f"{item.product.name} is no longer available")
            if variant.stock_quantity < item.quantity:
                raise BadRequestException(
                    f"Not enough stock for {_label(item.product.name, variant.name)}. "
                    f"Only {variant.stock_quantity} left."
                )
            variant.stock_quantity -= item.quantity
            continue

        result = await db.execute(
            select(Product)
            .where(Product.id == item.product_id)
            .with_for_update()
        )
        product = result.scalar_one_or_none()
        if not product or product.deleted_at is not None or product.status not in (ProductStatus.ACTIVE, ProductStatus.DRAFT):
            raise BadRequestException(f"{item.product.name} is no longer available")
        if product.stock_quantity < item.quantity:
            raise BadRequestException(
                f"Not enough stock for {item.product.name}. Only {product.stock_quantity} left."
            )
        product.stock_quantity -= item.quantity
        if product.stock_quantity == 0:
            product.status = ProductStatus.OUT_OF_STOCK


async def restore_order_stock(order: Order, db: AsyncSession) -> None:
    """Return reserved stock when an unpaid/cancellable order is cancelled."""
    if not order.items:
        return

    ordered_items = sorted(
        order.items,
        key=lambda item: (str(item.product_id), str(item.variant_id or "")),
    )

    for item in ordered_items:
        if item.variant_id:
            result = await db.execute(
                select(ProductVariant)
                .where(ProductVariant.id == item.variant_id)
                .with_for_update()
            )
            variant = result.scalar_one_or_none()
            if variant:
                variant.stock_quantity += item.quantity
            continue

        result = await db.execute(
            select(Product)
            .where(Product.id == item.product_id)
            .with_for_update()
        )
        product = result.scalar_one_or_none()
        if product:
            product.stock_quantity += item.quantity
            if product.status == ProductStatus.OUT_OF_STOCK and product.stock_quantity > 0:
                product.status = ProductStatus.ACTIVE
