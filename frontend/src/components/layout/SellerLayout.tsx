import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingBag, BarChart2, Star,
  Settings, Store, ChevronRight, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { useMyShop } from "@/hooks/useQueries";
import { cn } from "@/utils";

const NAV_ITEMS = [
  { to: "/seller/dashboard", icon: <LayoutDashboard size={17} />, label: "Dashboard" },
  { to: "/seller/products",  icon: <Package size={17} />,         label: "Products" },
  { to: "/seller/orders",    icon: <ShoppingBag size={17} />,     label: "Orders" },
  { to: "/seller/analytics", icon: <BarChart2 size={17} />,       label: "Analytics" },
  { to: "/seller/reviews",   icon: <Star size={17} />,            label: "Reviews" },
  { to: "/seller/settings",  icon: <Settings size={17} />,        label: "Settings" },
];

export default function SellerLayout() {
  const { data: shop } = useMyShop();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-56px)] min-w-0">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-14 left-0 z-30 w-56 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-transform duration-200",
        "lg:translate-x-0 lg:static lg:inset-auto lg:h-auto",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        {/* Shop info */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {shop?.logo_url
              ? <img src={shop.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
              : <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center"><Store size={16} className="text-primary-600" /></div>}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{shop?.name || "My Shop"}</p>
              <p className="text-xs text-gray-400">Seller Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}>
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile toggle */}
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-3 top-16 z-40 rounded-lg p-2 shadow lg:hidden btn btn-secondary">
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Main content */}
      <main className="w-full min-w-0 flex-1 lg:ml-0">
        <Outlet />
      </main>
    </div>
  );
}
