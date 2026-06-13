import { Link } from "react-router-dom";
import { useCategories } from "@/hooks/useQueries";
import type { Category } from "@/types";

export default function Footer() {
  const { data: categories = [] } = useCategories();
  const footerCategories = Array.isArray(categories)
    ? (categories as Category[])
        .filter((category) => !category.parent_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : [];

  return (
    <footer className="mt-auto border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <h3 className="mb-3 text-lg font-bold text-primary-600">ShopX</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Thailand&apos;s favourite marketplace for everything you need.
            </p>
          </div>

          {footerCategories.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Shop</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                {footerCategories.map((category) => (
                  <li key={category.id}>
                    <Link
                      to={`/search?category_id=${encodeURIComponent(category.id)}`}
                      className="hover:text-primary-600"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="mb-3 text-sm font-semibold">Sell</h4>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><Link to="/seller/register" className="hover:text-primary-600">Start Selling</Link></li>
              <li><Link to="/seller/dashboard" className="hover:text-primary-600">Seller Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Help</h4>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><Link to="/orders" className="hover:text-primary-600">Track Order</Link></li>
              <li><Link to="/profile" className="hover:text-primary-600">My Account</Link></li>
              <li><a href="mailto:support@shopx.com" className="hover:text-primary-600">Contact Us</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6 text-center text-xs text-gray-400 dark:border-gray-800">
          {"\u00A9"} {new Date().getFullYear()} ShopX. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
