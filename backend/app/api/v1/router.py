from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    shops,
    products,
    categories,
    brands,
    cart,
    orders,
    payments,
    reviews,
    wishlist,
    notifications,
    chat,
    vouchers,
    flash_sales,
    admin,
    search,
    upload,
    homepage,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(shops.router, prefix="/shops", tags=["Shops"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(cart.router, prefix="/cart", tags=["Cart"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["Reviews"])
api_router.include_router(wishlist.router, prefix="/wishlist", tags=["Wishlist"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(vouchers.router, prefix="/vouchers", tags=["Vouchers"])
api_router.include_router(flash_sales.router, prefix="/flash-sales", tags=["Flash Sales"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(upload.router, prefix="/upload", tags=["Upload"])

api_router.include_router(homepage.router, prefix="/homepage", tags=["Homepage"])
