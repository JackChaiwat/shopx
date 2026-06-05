import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { Spinner } from "@/components/ui";
import { LanguageProvider } from "@/i18n";
import { useQueryClient } from "@tanstack/react-query";

// Buyer pages
const Home              = lazy(() => import("@/pages/Home"));
const ProductDetail     = lazy(() => import("@/pages/ProductDetail"));
const SearchPage        = lazy(() => import("@/pages/Search"));
const CartPage          = lazy(() => import("@/pages/Cart"));
const CheckoutPage      = lazy(() => import("@/pages/Checkout"));
const OrdersPage        = lazy(() => import("@/pages/Orders"));
const OrderDetail       = lazy(() => import("@/pages/OrderDetail"));
const WishlistPage      = lazy(() => import("@/pages/Wishlist"));
const ProfilePage       = lazy(() => import("@/pages/Profile"));
const NotificationsPage = lazy(() => import("@/pages/Notifications"));
const ChatPage          = lazy(() => import("@/pages/Chat"));

// Auth pages
const LoginPage         = lazy(() => import("@/pages/Login"));
const RegisterPage      = lazy(() => import("@/pages/Register"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPassword"));
const ResetPasswordPage  = lazy(() => import("@/pages/ResetPassword"));
const VerifyEmailPage    = lazy(() => import("@/pages/VerifyEmail"));

// Seller pages
const SellerDashboard   = lazy(() => import("@/pages/seller/Dashboard"));
const SellerProducts    = lazy(() => import("@/pages/seller/Products"));
const SellerOrders      = lazy(() => import("@/pages/seller/Orders"));
const SellerAnalytics   = lazy(() => import("@/pages/seller/Analytics"));
const SellerReviews     = lazy(() => import("@/pages/seller/Reviews"));
const SellerSettings    = lazy(() => import("@/pages/seller/Settings"));

// Admin pages
const AdminDashboard    = lazy(() => import("@/pages/admin/Dashboard"));
const NotFound          = lazy(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Spinner className="w-8 h-8 text-primary-500" />
    </div>
  );
}


function RouteDataRefresher() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const { fetchCart } = useCartStore();
  const canUseProtectedApi = isAuthenticated && user?.is_email_verified && user.status === "active";

  useEffect(() => {
    const path = location.pathname;

    if (path === "/" || path.startsWith("/search") || path.startsWith("/products/")) {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["product-slug"] });
    }

    if (!canUseProtectedApi) return;

    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] });

    if (path.startsWith("/cart") || path.startsWith("/checkout")) {
      fetchCart();
    }

    if (path.startsWith("/orders")) {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
    }

    if (path.startsWith("/notifications")) {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }

    if (path.startsWith("/chat")) {
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    }

    if (path.startsWith("/profile")) {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    }

    if (path.startsWith("/seller")) {
      queryClient.invalidateQueries({ queryKey: ["my-shop"] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-products-manage"] });
      queryClient.invalidateQueries({ queryKey: ["seller-analytics-overview"] });
      queryClient.invalidateQueries({ queryKey: ["seller-product-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["seller-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["homepage-slides-manage"] });
    }
  }, [location.pathname, location.search, canUseProtectedApi, fetchCart, queryClient]);

  return null;
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_email_verified || user.status !== "active")
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user?.email || "")}`} replace />;
  if (role === "seller" && !["seller", "admin", "super_admin"].includes(user?.role || ""))
    return <Navigate to="/" replace />;
  if (role === "admin" && !["admin", "super_admin"].includes(user?.role || ""))
    return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppInner() {
  const { initialize, isAuthenticated, user, logout } = useAuthStore();
  const { fetchCart } = useCartStore();
  const navigate = useNavigate();
  const canUseProtectedApi = isAuthenticated && user?.is_email_verified && user.status === "active";

  useEffect(() => { initialize(); }, []);
  useEffect(() => { if (canUseProtectedApi) fetchCart(); }, [canUseProtectedApi]);

  useEffect(() => {
    const publicAuthPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
    const handleLogout = () => {
      logout();
      if (!publicAuthPaths.some(path => window.location.pathname.startsWith(path))) {
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [navigate, logout]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />
      <RouteDataRefresher />
      <main className="flex-1 min-w-0 w-full">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/cart" element={<CartPage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Buyer protected */}
            <Route path="/checkout"       element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="/orders"         element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            <Route path="/orders/:id"     element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            <Route path="/wishlist"       element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
            <Route path="/profile"        element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/notifications"  element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/chat"           element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

            {/* Seller */}
            <Route path="/seller/dashboard" element={<ProtectedRoute role="seller"><SellerDashboard /></ProtectedRoute>} />
            <Route path="/seller/products"  element={<ProtectedRoute role="seller"><SellerProducts /></ProtectedRoute>} />
            <Route path="/seller/orders"    element={<ProtectedRoute role="seller"><SellerOrders /></ProtectedRoute>} />
            <Route path="/seller/analytics" element={<ProtectedRoute role="seller"><SellerAnalytics /></ProtectedRoute>} />
            <Route path="/seller/reviews"   element={<ProtectedRoute role="seller"><SellerReviews /></ProtectedRoute>} />
            <Route path="/seller/settings"  element={<ProtectedRoute role="seller"><SellerSettings /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin"   element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/*" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() { return <LanguageProvider><AppInner /></LanguageProvider>; }

