import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useWishlist, useToggleWishlist } from "@/hooks/useQueries";
import { useCartStore } from "@/store/cartStore";
import { EmptyState, Spinner } from "@/components/ui";
import { formatPrice } from "@/utils";

export default function Wishlist() {
  const { data: items, isLoading } = useWishlist();
  const { mutate: toggle } = useToggleWishlist();
  const { addItem } = useCartStore();

  return (
    <>
      <Helmet><title>Wishlist - ShopX</title></Helmet>
      <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <h1 className="text-2xl font-bold mb-6">My Wishlist ({items?.length ?? 0})</h1>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
        ) : !items?.length ? (
          <EmptyState
            icon={<Heart size={48} />}
            title="Your wishlist is empty"
            description="Save items you love by tapping the heart icon"
            action={<Link to="/" className="btn btn-primary">Explore Products</Link>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item: any) => (
              <div key={item.product_id} className="card overflow-x-auto group">
                <Link to={`/products/${item.product_id}`} className="block aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {item.primary_image ? (
                    <img src={item.primary_image} alt={item.product_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ShoppingCart size={40} /></div>
                  )}
                </Link>
                <div className="p-3">
                  <Link to={`/products/${item.product_id}`}>
                    <p className="text-sm font-medium line-clamp-2 hover:text-primary-600 mb-1">{item.product_name}</p>
                  </Link>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-primary-600">
                      {formatPrice(item.sale_price || item.base_price)}
                    </span>
                    {item.sale_price && (
                      <span className="text-xs text-gray-400 line-through">{formatPrice(item.base_price)}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addItem(item.product_id)}
                      className="flex-1 btn btn-primary btn-sm"
                    >
                      <ShoppingCart size={14} /> Add to Cart
                    </button>
                    <button
                      onClick={() => toggle({ productId: item.product_id, inWishlist: true })}
                      className="btn btn-secondary btn-sm p-2"
                      title="Remove from wishlist"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
