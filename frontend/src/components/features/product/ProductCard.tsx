import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Star } from "lucide-react";
import type { Product } from "@/types";
import { formatPrice, getDiscountPercent, cn } from "@/utils";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export default function ProductCard({ product, className }: ProductCardProps) {
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const effectivePrice = product.sale_price || product.base_price;
  const discount =
    product.sale_price
      ? getDiscountPercent(product.base_price, product.sale_price)
      : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product.id);
  };

  return (
    <Link
      to={`/products/${product.slug}`}
      className={cn("card group block min-w-0 overflow-hidden tap-highlight-none transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-gray-700", className)}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 sm:group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ShoppingCart size={40} />
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            -{discount}%
          </span>
        )}
        <button
          onClick={handleAddToCart}
          className="absolute bottom-2 right-2 rounded-full bg-white p-2 text-gray-700 shadow transition-colors hover:bg-primary-500 hover:text-white dark:bg-gray-900 dark:text-gray-200 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
          title="Add to cart"
        >
          <ShoppingCart size={16} />
        </button>
      </div>

      {/* Info */}
      <div className="p-2.5 sm:p-3">
        <p className="mb-1 line-clamp-2 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{product.name}</p>

        {/* Price */}
        <div className="mb-1 flex flex-wrap items-baseline gap-1.5">
          <span className="font-bold text-primary-600 dark:text-primary-400">
            {formatPrice(effectivePrice)}
          </span>
          {product.sale_price && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(product.base_price)}
            </span>
          )}
        </div>

        {/* Rating + sold */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-0.5">
            <Star size={11} className="fill-yellow-400 text-yellow-400" />
            {parseFloat(product.rating).toFixed(1)}
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>{product.sold_count.toLocaleString()} sold</span>
        </div>
      </div>
    </Link>
  );
}
