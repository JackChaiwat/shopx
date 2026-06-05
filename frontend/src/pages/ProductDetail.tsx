import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, Heart, Minus, Plus, ShoppingCart, Star, Truck } from "lucide-react";
import ProductCard from "@/components/features/product/ProductCard";
import { useProductBySlug, useProducts, useReviews } from "@/hooks/useQueries";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { EmptyState, Skeleton, Spinner, StarRating } from "@/components/ui";
import { formatDate, formatPrice, getDiscountPercent } from "@/utils";
import type { Product, ProductVariant } from "@/types";

function ProductGrid({ title, products }: { title: string; products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link to="/search" className="text-sm font-medium text-primary-600 hover:underline">View all</Link>
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

  if (isLoading) return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),420px]">
        <Skeleton className="aspect-square rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="mx-auto max-w-7xl px-3 py-16 sm:px-6">
      <EmptyState title="Product not found" description="This product may have been removed." />
    </div>
  );

  const effectivePrice = selectedVariant?.sale_price || selectedVariant?.price || product.sale_price || product.base_price;
  const discount = product.sale_price ? getDiscountPercent(product.base_price, product.sale_price) : 0;
  const maxQty = selectedVariant?.stock_quantity ?? product.stock_quantity;
  const relatedItems = (relatedData?.items || []).filter((item) => item.id !== product.id).slice(0, 5);
  const fallbackItems = (newestData?.items || []).filter((item) => item.id !== product.id).slice(0, 5);
  const recommendationItems = relatedItems.length ? relatedItems : fallbackItems;
  const imageUrl = product.images[mainImage]?.url || product.primary_image;

  const handleAddToCart = () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addItem(product.id, selectedVariant?.id, qty);
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addItem(product.id, selectedVariant?.id, qty);
    navigate("/cart");
  };

  return (
    <>
      <Helmet>
        <title>{product.name} - ShopX</title>
        <meta name="description" content={product.short_description || product.name} />
      </Helmet>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6">
        <nav className="mb-5 flex items-center gap-2 text-xs text-gray-500">
          <Link to="/" className="hover:text-primary-600">Home</Link>
          <ChevronLeft size={13} className="rotate-180" />
          <span className="max-w-[70vw] truncate">{product.name}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),420px]">
          <div className="min-w-0 space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,520px),1fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg border border-gray-100 bg-gray-100 dark:border-gray-800 dark:bg-gray-900">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-gray-300">
                      <ShoppingCart size={60} />
                    </div>
                  )}
                </div>
                {product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {product.images.map((img, i) => (
                      <button
                        key={img.id}
                        onClick={() => setMainImage(i)}
                        className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${i === mainImage ? "border-primary-500" : "border-gray-200 dark:border-gray-700"}`}
                      >
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden rounded-lg border border-gray-100 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900 md:block">
                <h2 className="mb-3 font-semibold">Product Info</h2>
                <div className="space-y-3 text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-primary-500" />
                    Fast delivery after seller confirms order
                  </div>
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-primary-500" />
                    {product.review_count} customer reviews
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart size={16} className="text-primary-500" />
                    {product.sold_count.toLocaleString()} sold
                  </div>
                </div>
              </div>
            </div>

            {product.description && (
              <section className="card p-5">
                <h2 className="mb-3 text-lg font-bold">Product Description</h2>
                <div
                  className="prose max-w-none text-sm dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </section>
            )}

            <section className="card p-5">
              <h2 className="mb-4 text-lg font-bold">Customer Reviews ({product.review_count})</h2>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0 dark:border-gray-800">
                      <div className="mb-2 flex items-center gap-2">
                        <StarRating rating={r.rating} size={14} />
                        <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                      </div>
                      {r.title && <p className="mb-1 text-sm font-medium">{r.title}</p>}
                      {r.content && <p className="text-sm text-gray-600 dark:text-gray-400">{r.content}</p>}
                      {r.seller_reply && (
                        <div className="mt-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                          <p className="mb-1 text-xs font-medium text-primary-600">Seller Reply:</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{r.seller_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No reviews yet" description="Be the first to review this product." />
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5">
              <h1 className="text-2xl font-bold leading-snug">{product.name}</h1>
              {product.short_description && (
                <p className="mt-2 text-sm text-gray-500">{product.short_description}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <StarRating rating={parseFloat(product.rating)} size={15} />
                <span className="font-medium">{parseFloat(product.rating).toFixed(1)}</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-500">{product.review_count} reviews</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-500">{product.sold_count.toLocaleString()} sold</span>
              </div>

              <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <div className="flex flex-wrap items-end gap-3">
                  <span className="text-3xl font-bold text-primary-600">{formatPrice(effectivePrice)}</span>
                  {product.sale_price && (
                    <>
                      <span className="text-lg text-gray-400 line-through">{formatPrice(product.base_price)}</span>
                      <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-bold text-red-600">-{discount}%</span>
                    </>
                  )}
                </div>
              </div>

              {product.variants && product.variants.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium">Options</p>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                        disabled={!v.is_active || v.stock_quantity === 0}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selectedVariant?.id === v.id ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30" : "border-gray-200 hover:border-primary-300 dark:border-gray-700"}`}
                      >
                        {v.name}{v.stock_quantity === 0 && " (Out)"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[3rem] border-x border-gray-200 px-4 py-2 text-center font-medium dark:border-gray-700">{qty}</span>
                  <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Plus size={14} />
                  </button>
                </div>
                <span className="text-sm text-gray-500">{maxQty} available</span>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button onClick={handleAddToCart} disabled={maxQty === 0} className="btn btn-outline">
                  <ShoppingCart size={18} /> Add to Cart
                </button>
                <button onClick={handleBuyNow} disabled={maxQty === 0} className="btn btn-primary">
                  Buy Now
                </button>
              </div>
              {maxQty === 0 && <p className="mt-3 text-sm font-medium text-red-500">Out of stock</p>}
            </div>
          </aside>
        </div>

        <ProductGrid title={relatedItems.length ? "More From This Category" : "You May Also Like"} products={recommendationItems} />
      </div>
    </>
  );
}
