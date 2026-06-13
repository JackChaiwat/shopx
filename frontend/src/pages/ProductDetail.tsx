import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ChevronRight,
  Heart,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import ProductCard from "@/components/features/product/ProductCard";
import {
  useProductBySlug,
  useProducts,
  useReviews,
  useToggleWishlist,
  useWishlist,
} from "@/hooks/useQueries";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { EmptyState, Skeleton, StarRating } from "@/components/ui";
import { formatDate, formatPrice, getDiscountPercent, cn } from "@/utils";
import type { Product, ProductVariant } from "@/types";

function ProductGrid({ title, products }: { title: string; products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Discover more</p>
          <h2 className="mt-1 text-xl font-bold text-gray-950 dark:text-white">{title}</h2>
        </div>
        <Link to="/search" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((item) => <ProductCard key={item.id} product={item} />)}
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProductBySlug(slug);
  const { data: reviews } = useReviews(product?.id);
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { data: wishlistItems = [] } = useWishlist(isAuthenticated);
  const { mutate: toggleWishlist, isPending: wishlistPending } = useToggleWishlist();
  const navigate = useNavigate();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [qty, setQty] = useState(1);
  const [mainImage, setMainImage] = useState(0);

  const { data: relatedData } = useProducts({
    ...(product?.category_id ? { category_id: product.category_id } : {}),
    limit: 10,
    sort: "sold_count",
    order: "desc",
  });
  const { data: newestData } = useProducts({ limit: 10, sort: "created_at", order: "desc" });

  useEffect(() => {
    setMainImage(0);
    setQty(1);
    setSelectedVariant(null);
  }, [product?.id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <EmptyState title="Product not found" description="This product may have been removed." />
      </div>
    );
  }

  const images = product.images || [];
  const effectivePrice = selectedVariant?.sale_price || selectedVariant?.price || product.sale_price || product.base_price;
  const discount = product.sale_price ? getDiscountPercent(product.base_price, product.sale_price) : 0;
  const maxQty = selectedVariant?.stock_quantity ?? product.stock_quantity;
  const relatedItems = (relatedData?.items || []).filter((item) => item.id !== product.id).slice(0, 5);
  const fallbackItems = (newestData?.items || []).filter((item) => item.id !== product.id).slice(0, 5);
  const recommendationItems = relatedItems.length ? relatedItems : fallbackItems;
  const imageUrl = images[mainImage]?.url || product.primary_image;
  const inWishlist = Array.isArray(wishlistItems)
    && wishlistItems.some((item: any) => item.product_id === product.id);

  const handleAddToCart = () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (maxQty <= 0) return;
    addItem(product.id, selectedVariant?.id, qty);
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (maxQty <= 0) return;
    addItem(product.id, selectedVariant?.id, qty);
    navigate("/cart");
  };

  const handleWishlist = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    toggleWishlist({ productId: product.id, inWishlist });
  };

  return (
    <>
      <Helmet>
        <title>{product.name} - ShopX</title>
        <meta name="description" content={product.short_description || product.name} />
      </Helmet>

      <main className="min-h-screen bg-gray-50/70 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <nav className="mb-5 flex min-w-0 items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Link to="/" className="shrink-0 hover:text-primary-600">Home</Link>
            <ChevronRight size={14} />
            <Link to="/search" className="shrink-0 hover:text-primary-600">Products</Link>
            <ChevronRight size={14} />
            <span className="truncate font-medium text-gray-700 dark:text-slate-200">{product.name}</span>
          </nav>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-8">
            <div className="min-w-0">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="relative flex aspect-square items-center justify-center bg-gray-100 dark:bg-slate-950">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="h-full w-full object-contain" />
                  ) : (
                    <ShoppingCart size={72} className="text-gray-300 dark:text-slate-700" />
                  )}
                  {discount > 0 && (
                    <span className="absolute left-4 top-4 rounded-md bg-red-500 px-2.5 py-1 text-sm font-bold text-white">
                      -{discount}%
                    </span>
                  )}
                </div>
              </div>

              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, index) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setMainImage(index)}
                      className={cn(
                        "h-18 w-18 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition",
                        index === mainImage
                          ? "border-primary-500 ring-2 ring-primary-500/15"
                          : "border-gray-200 hover:border-gray-400 dark:border-slate-700"
                      )}
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary-600">Product details</p>
                    <h1 className="text-2xl font-bold leading-tight text-gray-950 dark:text-white sm:text-3xl">
                      {product.name}
                    </h1>
                  </div>
                  <button
                    type="button"
                    onClick={handleWishlist}
                    disabled={wishlistPending}
                    aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                    title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-60",
                      inWishlist
                        ? "border-red-200 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/40"
                        : "border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:bg-red-950/30"
                    )}
                  >
                    <Heart size={20} className={inWishlist ? "fill-current" : ""} />
                  </button>
                </div>

                {product.short_description && (
                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-300">{product.short_description}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <StarRating rating={parseFloat(product.rating)} size={15} />
                  <span className="font-semibold text-gray-900 dark:text-white">{parseFloat(product.rating).toFixed(1)}</span>
                  <span className="text-gray-300 dark:text-slate-700">|</span>
                  <span className="text-gray-500 dark:text-slate-400">{product.review_count} reviews</span>
                  <span className="text-gray-300 dark:text-slate-700">|</span>
                  <span className="text-gray-500 dark:text-slate-400">{product.sold_count.toLocaleString()} sold</span>
                </div>

                <div className="my-5 border-y border-gray-100 py-5 dark:border-slate-800">
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">{formatPrice(effectivePrice)}</span>
                    {product.sale_price && (
                      <>
                        <span className="pb-1 text-base text-gray-400 line-through">{formatPrice(product.base_price)}</span>
                        <span className="mb-1 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
                          Save {discount}%
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {product.variants && product.variants.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-2 text-sm font-semibold">Options</p>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVariant(selectedVariant?.id === variant.id ? null : variant)}
                          disabled={!variant.is_active || variant.stock_quantity === 0}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                            selectedVariant?.id === variant.id
                              ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-300"
                              : "border-gray-200 hover:border-primary-300 dark:border-slate-700"
                          )}
                        >
                          {variant.name}{variant.stock_quantity === 0 && " (Out)"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Quantity</p>
                    <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-slate-700">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={qty <= 1}
                        onClick={() => setQty(Math.max(1, qty - 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-slate-800"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="flex h-10 min-w-12 items-center justify-center border-x border-gray-200 px-3 font-semibold dark:border-slate-700">{qty}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={qty >= maxQty}
                        onClick={() => setQty(Math.min(maxQty, qty + 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-slate-800"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", maxQty > 0 ? "text-green-600" : "text-red-500")}>
                      {maxQty > 0 ? "In stock" : "Out of stock"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{maxQty} available</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button onClick={handleAddToCart} disabled={maxQty === 0} className="btn btn-outline min-h-12">
                    <ShoppingCart size={18} /> Add to Cart
                  </button>
                  <button onClick={handleBuyNow} disabled={maxQty === 0} className="btn btn-primary min-h-12">
                    Buy Now
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2 border-t border-gray-100 pt-5 dark:border-slate-800">
                  <div className="text-center text-xs text-gray-500 dark:text-slate-400">
                    <Truck size={18} className="mx-auto mb-1.5 text-primary-500" />
                    Fast delivery
                  </div>
                  <div className="text-center text-xs text-gray-500 dark:text-slate-400">
                    <ShieldCheck size={18} className="mx-auto mb-1.5 text-primary-500" />
                    Secure payment
                  </div>
                  <div className="text-center text-xs text-gray-500 dark:text-slate-400">
                    <PackageCheck size={18} className="mx-auto mb-1.5 text-primary-500" />
                    Seller verified
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
            <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Product Description</h2>
              {product.description ? (
                <div
                  className="prose mt-4 max-w-none text-sm leading-7 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              ) : (
                <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">No additional description available.</p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Shopping confidence</h2>
              <div className="mt-4 space-y-4 text-sm text-gray-600 dark:text-slate-300">
                <div className="flex gap-3">
                  <Truck size={18} className="mt-0.5 shrink-0 text-primary-500" />
                  <div><p className="font-semibold text-gray-900 dark:text-white">Delivery updates</p><p>Track the order after seller confirmation.</p></div>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary-500" />
                  <div><p className="font-semibold text-gray-900 dark:text-white">Protected checkout</p><p>Payment status is confirmed by the payment system.</p></div>
                </div>
                <div className="flex gap-3">
                  <RotateCcw size={18} className="mt-0.5 shrink-0 text-primary-500" />
                  <div><p className="font-semibold text-gray-900 dark:text-white">Order support</p><p>Contact the seller through your order page.</p></div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Customer feedback</p>
                <h2 className="mt-1 text-xl font-bold text-gray-950 dark:text-white">Reviews ({product.review_count})</h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-950 dark:text-white">{parseFloat(product.rating).toFixed(1)}</p>
                <StarRating rating={parseFloat(product.rating)} size={14} />
              </div>
            </div>

            {reviews && reviews.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {reviews.map((review) => (
                  <article key={review.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StarRating rating={review.rating} size={14} />
                      <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                    </div>
                    {review.title && <p className="mb-1 text-sm font-semibold">{review.title}</p>}
                    {review.content && <p className="text-sm leading-6 text-gray-600 dark:text-slate-400">{review.content}</p>}
                    {review.seller_reply && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-slate-800">
                        <p className="mb-1 text-xs font-bold text-primary-600">Seller reply</p>
                        <p className="text-sm text-gray-600 dark:text-slate-300">{review.seller_reply}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 text-center dark:border-slate-700">
                <Star size={34} className="mb-3 text-gray-300 dark:text-slate-600" />
                <p className="font-semibold text-gray-900 dark:text-white">No reviews yet</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Be the first customer to review this product.</p>
              </div>
            )}
          </section>

          <ProductGrid title={relatedItems.length ? "More From This Category" : "You May Also Like"} products={recommendationItems} />
        </div>
      </main>
    </>
  );
}
