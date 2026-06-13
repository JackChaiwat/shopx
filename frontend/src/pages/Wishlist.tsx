import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Heart, PackageOpen, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { useWishlist, useToggleWishlist } from "@/hooks/useQueries";
import { useCartStore } from "@/store/cartStore";
import { Spinner } from "@/components/ui";
import { formatPrice } from "@/utils";

type WishlistItem = {
  product_id: string;
  product_slug?: string;
  product_name: string;
  base_price: string;
  sale_price: string | null;
  primary_image: string | null;
  stock_quantity?: number;
  status: string;
  added_at: string;
};

export default function Wishlist() {
  const { data: items = [], isLoading } = useWishlist();
  const { mutate: toggle, isPending: removing } = useToggleWishlist();
  const { addItem } = useCartStore();
  const wishlistItems = Array.isArray(items) ? items as WishlistItem[] : [];

  const productHref = (item: WishlistItem) =>
    item.product_slug
      ? `/products/${item.product_slug}`
      : `/search?q=${encodeURIComponent(item.product_name)}`;

  return (
    <>
      <Helmet><title>My Wishlist - ShopX</title></Helmet>
      <main className="min-h-[65vh] bg-gray-50/70 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <header className="mb-7 flex flex-col gap-4 border-b border-gray-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-600">
                <Heart size={16} className="fill-current" />
                Saved products
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">My Wishlist</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                {wishlistItems.length
                  ? `${wishlistItems.length} saved ${wishlistItems.length === 1 ? "item" : "items"}`
                  : "Keep products you like in one place."}
              </p>
            </div>
            <Link to="/search" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700">
              Continue shopping <ArrowRight size={16} />
            </Link>
          </header>

          {isLoading ? (
            <div className="flex min-h-80 items-center justify-center">
              <Spinner className="h-8 w-8 text-primary-500" />
            </div>
          ) : wishlistItems.length === 0 ? (
            <section className="flex min-h-[380px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary-500 dark:bg-primary-950/30">
                <Heart size={38} strokeWidth={1.7} />
              </div>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Your wishlist is empty</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-slate-400">
                Tap the heart button on a product to save it here and return to it later.
              </p>
              <Link to="/search" className="btn btn-primary mt-6 min-h-11 px-6">
                <ShoppingBag size={17} /> Explore Products
              </Link>
            </section>
          ) : (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {wishlistItems.map((item) => {
                const unavailable = item.status !== "active" || (item.stock_quantity ?? 1) <= 0;
                return (
                  <article key={item.product_id} className="group min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                    <div className="relative">
                      <Link to={productHref(item)} className="block aspect-square overflow-hidden bg-gray-100 dark:bg-slate-800">
                        {item.primary_image ? (
                          <img
                            src={item.primary_image}
                            alt={item.product_name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-slate-600">
                            <PackageOpen size={44} />
                          </div>
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggle({ productId: item.product_id, inWishlist: true })}
                        disabled={removing}
                        aria-label="Remove from wishlist"
                        title="Remove from wishlist"
                        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/95 text-red-500 shadow-sm transition hover:bg-red-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <Heart size={17} className="fill-current" />
                      </button>
                      {unavailable && (
                        <span className="absolute bottom-2 left-2 rounded-md bg-gray-900/80 px-2 py-1 text-xs font-semibold text-white">
                          Unavailable
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      <Link to={productHref(item)} className="block">
                        <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-900 hover:text-primary-600 dark:text-white">
                          {item.product_name}
                        </h2>
                      </Link>
                      <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
                        <span className="font-bold text-primary-600 dark:text-primary-400">
                          {formatPrice(item.sale_price || item.base_price)}
                        </span>
                        {item.sale_price && (
                          <span className="text-xs text-gray-400 line-through">{formatPrice(item.base_price)}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => addItem(item.product_id)}
                        disabled={unavailable}
                        className="btn btn-primary btn-sm mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShoppingCart size={15} /> {unavailable ? "Unavailable" : "Add to Cart"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle({ productId: item.product_id, inWishlist: true })}
                        disabled={removing}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 py-1 text-xs font-semibold text-gray-500 transition hover:text-red-500 disabled:opacity-50 dark:text-slate-400"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
