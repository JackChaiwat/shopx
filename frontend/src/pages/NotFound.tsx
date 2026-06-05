import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
  return (
    <>
      <Helmet><title>404 - Page Not Found | ShopX</title></Helmet>
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <p className="text-8xl font-bold text-primary-200 dark:text-primary-900">404</p>
        <h1 className="text-2xl font-bold mt-4 mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-8 max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3">
          <Link to="/" className="btn btn-primary">Go Home</Link>
          <button onClick={() => window.history.back()} className="btn btn-secondary">Go Back</button>
        </div>
      </div>
    </>
  );
}
