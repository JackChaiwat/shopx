import { useState, useEffect } from "react";
  import { Link, useNavigate, useLocation } from "react-router-dom";
  import {
    ShoppingCart, Bell, Search, Menu, X, Sun, Moon, User, LogOut,
    Store, LayoutDashboard, Heart, Package, BarChart2, Star,
    Settings, ShoppingBag, ChevronDown, Globe2,
  } from "lucide-react";
  import { useAuthStore } from "@/store/authStore";
  import { useCartStore } from "@/store/cartStore";
  import { useCategories, useUnreadCount } from "@/hooks/useQueries";
  import { cn } from "@/utils";
  import { useLanguage } from "@/i18n";

  export default function Navbar() {
    const { user, isAuthenticated, logout } = useAuthStore();
    const { cart } = useCartStore();
    const { data: unreadCount = 0 } = useUnreadCount();
    const { data: categories = [] } = useCategories();
    const { language, toggleLanguage, t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchQ, setSearchQ] = useState("");
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
      const [dark, setDark] = useState(() => {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return document.documentElement.classList.contains("dark");
    });

    useEffect(() => { setProfileOpen(false); setMobileOpen(false); }, [location.pathname]);

    useEffect(() => {
      if (dark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }, [dark]);

    const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQ.trim()) navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`);
    };

    const handleLogout = async () => {
      await logout();
      navigate("/");
    };

    const cartCount = cart?.item_count ?? 0;
    const isSeller = user?.role === "seller" || user?.role === "admin" || user?.role === "super_admin";
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    const isLoginPage = location.pathname === "/login";
    const isRegisterPage = location.pathname === "/register";
    const activeCategoryId = new URLSearchParams(location.search).get("category_id");
    const navCategories = Array.isArray(categories)
      ? categories
          .filter((cat: any) => !cat.parent_id)
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      : [];

    const isSellerSection = location.pathname.startsWith("/seller");
    const isAdminSection = location.pathname.startsWith("/admin");

    const sellerLinks = [
      { to: "/seller/dashboard", icon: <LayoutDashboard size={14} />, label: t("seller.dashboard") },
      { to: "/seller/products",  icon: <Package size={14} />,         label: t("seller.products") },
      { to: "/seller/orders",    icon: <ShoppingBag size={14} />,     label: t("seller.orders") },
      { to: "/seller/analytics", icon: <BarChart2 size={14} />,       label: t("seller.analytics") },
      { to: "/seller/reviews",   icon: <Star size={14} />,            label: t("seller.reviews") },
      { to: "/seller/settings",  icon: <Settings size={14} />,        label: t("seller.settings") },
    ];

    return (
      <>
        <nav className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
            <div className="flex h-14 min-w-0 items-center gap-2 sm:gap-3">
              {/* Logo */}
              <Link to="/" className="shrink-0 text-lg font-bold tracking-tight text-primary-600 dark:text-primary-400 sm:text-xl">
                ShopX
              </Link>

              {/* Search */}
              <form onSubmit={handleSearch} className="mx-1 hidden max-w-2xl flex-1 sm:flex">
                <div className="relative w-full">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    placeholder={t("nav.search")}
                    className="input pl-9 py-1.5 text-sm" />
                </div>
              </form>

              {/* Right actions */}
              <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
                <button
                  onClick={() => setDark(!dark)}
                  aria-label={dark ? t("nav.lightMode") : t("nav.darkMode")}
                  title={dark ? t("nav.lightMode") : t("nav.darkMode")}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                  {dark ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                <button
                  type="button"
                  onClick={toggleLanguage}
                  title={language === "th" ? "English" : "ไทย"}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Globe2 size={16} />
                  <span>{language === "th" ? "TH" : "EN"}</span>
                </button>

                {/* Cart */}
                <Link to="/cart" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ShoppingCart size={19} className="text-gray-600 dark:text-gray-300" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>

                {isAuthenticated ? (
                  <>
                    {/* Notifications */}
                    <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <Bell size={19} className="text-gray-600 dark:text-gray-300" />
                      {Number(unreadCount) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                          {Number(unreadCount) > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Link>

                    {/* Profile dropdown */}
                    <div className="relative">
                      <button onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        {user?.avatar_url
                          ? <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                          : <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
                              {user?.full_name?.[0]?.toUpperCase() ?? "U"}
                            </div>}
                        <span className="hidden md:block text-sm font-medium max-w-[90px] truncate">
                          {user?.full_name?.split(" ")[0] ?? user?.email}
                        </span>
                        <ChevronDown size={13} className="hidden md:block text-gray-400" />
                      </button>

                      {profileOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                          <div className="absolute right-0 top-full z-20 mt-1 w-[min(90vw,14rem)] card py-1.5 shadow-xl animate-fade-in">
                            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                              <p className="text-sm font-semibold truncate">{user?.full_name}</p>
                              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block ${
                                isAdmin ? "bg-red-100 text-red-700" : isSeller ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                              }`}>{user?.role}</span>
                            </div>

                            <DropItem to="/profile" icon={<User size={14} />}>{t("nav.myProfile")}</DropItem>
                            <DropItem to="/orders" icon={<Package size={14} />}>{t("nav.myOrders")}</DropItem>
                            <DropItem to="/wishlist" icon={<Heart size={14} />}>{t("nav.wishlist")}</DropItem>

                            {isSeller && (
                              <>
                                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                                <div className="px-3 py-1">
                                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Seller</p>
                                </div>
                                <DropItem to="/seller/dashboard" icon={<Store size={14} />}>{t("seller.dashboard")}</DropItem>
                                <DropItem to="/seller/products" icon={<Package size={14} />}>{t("seller.products")}</DropItem>
                                <DropItem to="/seller/orders" icon={<ShoppingBag size={14} />}>{t("seller.orders")}</DropItem>
                                <DropItem to="/seller/analytics" icon={<BarChart2 size={14} />}>{t("seller.analytics")}</DropItem>
                              </>
                            )}

                            {isAdmin && (
                              <>
                                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                                <div className="px-3 py-1">
                                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Admin</p>
                                </div>
                                <DropItem to="/admin" icon={<LayoutDashboard size={14} />}>Admin Panel</DropItem>
                              </>
                            )}

                            <div className="border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
                              <button onClick={handleLogout}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <LogOut size={14} /> {t("nav.logout")}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Link to="/login" className={cn("btn btn-secondary btn-sm whitespace-nowrap px-3", isRegisterPage ? "inline-flex" : "hidden sm:inline-flex", isLoginPage && "sm:hidden")}>{t("nav.login")}</Link>
                    <Link to="/register" className={cn("btn btn-primary btn-sm whitespace-nowrap px-3", isRegisterPage && "hidden")}>{t("nav.signUp")}</Link>
                  </div>
                )}

                <button className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 sm:hidden"
                  onClick={() => setMobileOpen(!mobileOpen)}>
                  {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>

            {/* Mobile search */}
            <div className="pb-2 sm:hidden">
              <form onSubmit={handleSearch} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder={t("nav.searchMobile")} className="input min-h-11 pl-9 py-2 text-sm" />
              </form>
            </div>

            {mobileOpen && (
              <div data-mobile-menu="shopx" className="border-t border-gray-100 pb-3 pt-2 dark:border-gray-800 sm:hidden">
                {!isSellerSection && !isAdminSection && (
                  <div className="grid grid-cols-2 gap-1">
                    {navCategories.map((cat: any) => (
                      <Link key={cat.id || cat.slug || cat.name} to={"/search?category_id=" + encodeURIComponent(cat.id)}
                        className={cn(
                          "inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm transition-all active:scale-[0.99]",
                          activeCategoryId === cat.id
                            ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/25"
                            : "border-primary-500/30 bg-white text-primary-700 shadow-primary-500/10 hover:border-primary-500 hover:bg-primary-500 hover:text-white hover:shadow-md dark:border-primary-500/40 dark:bg-gray-800 dark:text-primary-200 dark:hover:bg-primary-500 dark:hover:text-white"
                        )}>
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}

                {!isAuthenticated && (
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                    {!isLoginPage && <Link to="/login" className="btn btn-secondary btn-sm w-full">Login</Link>}
                    {!isRegisterPage && <Link to="/register" className="btn btn-primary btn-sm w-full">Sign Up</Link>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Category bar — hidden on seller/admin sections */}
          {!isSellerSection && !isAdminSection && (
            <div className="hidden border-t border-primary-500/20 bg-gray-50/80 shadow-sm dark:bg-gray-900/95 sm:block">
              <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
                <div className="flex gap-2.5 overflow-x-auto py-3 text-sm scrollbar-hide">
                  {navCategories.map((cat: any) => (
                    <Link key={cat.id || cat.slug || cat.name} to={"/search?category_id=" + encodeURIComponent(cat.id)}
                      className={cn(
                        "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg border px-4 py-2 font-semibold shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0",
                        activeCategoryId === cat.id
                          ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/25"
                          : "border-primary-500/25 bg-primary-500/10 text-primary-700 hover:border-primary-500 hover:bg-primary-500 hover:text-white dark:border-primary-500/35 dark:bg-primary-500/10 dark:text-primary-200 dark:hover:bg-primary-500 dark:hover:text-white"
                      )}>
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Seller sub-nav */}
        {isSellerSection && isSeller && (
          <div className="bg-gray-900 text-white sticky top-14 z-30">
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {sellerLinks.map(link => (
                  <Link key={link.to} to={link.to}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                      location.pathname === link.to
                        ? "border-primary-400 text-primary-300"
                        : "border-transparent text-gray-300 hover:text-white hover:border-gray-500"
                    )}>
                    {link.icon} {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Admin sub-nav ถูกลบออกแล้ว — tab bar อยู่ใน Admin page component เอง */}
      </>
    );
  }

  function DropItem({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
      <Link to={to} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
        <span className="text-gray-400">{icon}</span>
        {children}
      </Link>
    );
  }