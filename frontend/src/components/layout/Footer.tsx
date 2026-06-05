import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg text-primary-600 mb-3">ShopX</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Thailand's favourite marketplace for everything you need.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Shop</h4>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              {["Electronics", "Fashion", "Home & Living", "Sports", "Beauty"].map((c) => (
                <li key={c}>
                  <Link to={`/search?q=${c}`} className="hover:text-primary-600">{c}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Sell</h4>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><Link to="/seller/register" className="hover:text-primary-600">Start Selling</Link></li>
              <li><Link to="/seller/dashboard" className="hover:text-primary-600">Seller Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Help</h4>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><Link to="/orders" className="hover:text-primary-600">Track Order</Link></li>
              <li><Link to="/profile" className="hover:text-primary-600">My Account</Link></li>
              <li><a href="mailto:support@shopx.com" className="hover:text-primary-600">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 mt-8 pt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} ShopX. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
