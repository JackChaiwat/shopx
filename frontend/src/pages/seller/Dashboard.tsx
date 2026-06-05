import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, ShoppingBag, DollarSign, Star, TrendingUp, Plus, Store,
  Eye, MessageSquare, BarChart2, Settings, Bell, ArrowUpRight,
  ArrowDownRight, RefreshCw, ChevronRight, Users,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { useMyShop } from "@/hooks/useQueries";
import { Spinner, EmptyState } from "@/components/ui";
import { formatPrice, formatNumber, formatDate, formatRelativeTime } from "@/utils";
import api from "@/services/api";

// ── Stat Card ────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, trend }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; trend?: { value: number; label: string };
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend.value >= 0 ? "text-green-600" : "text-red-500"}`}>
            {trend.value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function SellerDashboard() {
  const { data: shop, isLoading: shopLoading } = useMyShop();
  const [period, setPeriod] = useState("30d");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["seller-analytics-overview", period],
    queryFn: async () => {
      const r = await api.get(`/shops/my/analytics/overview?period=${period}`);
      return r.data.data;
    },
    enabled: !!shop,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["seller-orders-recent"],
    queryFn: async () => {
      const r = await api.get("/orders/seller/orders", { params: { limit: 8 } });
      return r.data.data;
    },
    enabled: !!shop,
  });

  const { data: reviews } = useQuery({
    queryKey: ["seller-reviews-recent"],
    queryFn: async () => {
      const r = await api.get("/shops/my/analytics/reviews", { params: { limit: 5 } });
      return r.data.data;
    },
    enabled: !!shop,
  });

  if (shopLoading) return (
    <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-primary-500" /></div>
  );

  if (!shop) return (
    <div className="max-w-2xl mx-auto px-4 py-20">
      <EmptyState icon={<Store size={52} />} title="Open your shop"
        description="Start selling to millions of customers on ShopX today."
        action={<Link to="/seller/register" className="btn btn-primary btn-lg">Open Your Shop</Link>} />
    </div>
  );

  if (shop.status === "pending") return (
    <div className="max-w-2xl mx-auto px-4 py-20">
      <div className="card p-10 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell size={28} className="text-yellow-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Shop Under Review</h2>
        <p className="text-gray-500 max-w-sm mx-auto">Your shop is being reviewed by our team. You'll be notified once approved — usually within 24 hours.</p>
        <p className="text-sm font-medium text-yellow-600 mt-4 bg-yellow-50 inline-block px-3 py-1 rounded-full">Status: Pending Approval</p>
      </div>
    </div>
  );

  const pendingCount = recentOrders?.filter((o: any) => o.status === "pending").length || 0;
  const unreadReviews = reviews?.items?.filter((r: any) => !r.seller_reply).length || 0;

  return (
    <>
      <Helmet><title>Seller Dashboard — {shop.name}</title></Helmet>
      <div className="max-w-[1300px] mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {shop.logo_url
              ? <img src={shop.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover border" />
              : <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center"><Store size={22} className="text-primary-600" /></div>}
            <div>
              <h1 className="text-xl font-bold">{shop.name}</h1>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Star size={11} className="fill-yellow-400 text-yellow-400" />{parseFloat(shop.rating).toFixed(1)}</span>
                <span>{formatNumber(shop.total_sales)} sales</span>
                <span>{formatNumber(shop.follower_count)} followers</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${shop.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{shop.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={period} onChange={e => setPeriod(e.target.value)} className="input text-sm py-1.5 w-28">
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
            <Link to="/seller/products?action=new" className="btn btn-primary btn-sm"><Plus size={14} /> Add Product</Link>
          </div>
        </div>

        {/* Alert banners */}
        {pendingCount > 0 && (
          <div className="mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3 flex items-center justify-between">
            <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
              <Package size={16} className="inline mr-1" /> You have <strong>{pendingCount}</strong> pending order{pendingCount > 1 ? "s" : ""} to confirm
            </p>
            <Link to="/seller/orders?status=pending" className="text-xs font-medium text-orange-600 hover:underline flex items-center gap-1">
              View <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {/* Stats */}
        {analyticsLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({length: 4}).map((_, i) => <div key={i} className="card p-5 h-28 skeleton" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<DollarSign size={20} className="text-green-600" />}
              label="Revenue" value={formatPrice(analytics?.revenue || 0)} color="bg-green-100"
              sub={`Avg order: ${formatPrice(analytics?.avg_order_value || 0)}`} />
            <StatCard icon={<ShoppingBag size={20} className="text-blue-600" />}
              label="Orders" value={(Object.values(analytics?.order_status || {}) as number[]).reduce((s, v) => s + v, 0)}
              color="bg-blue-100"
              sub={`${analytics?.order_status?.pending || 0} pending`} />
            <StatCard icon={<Package size={20} className="text-purple-600" />}
              label="Active Products" value={analytics?.active_products || 0} color="bg-purple-100"
              sub={`${formatNumber(analytics?.total_sales || 0)} total sold`} />
            <StatCard icon={<Star size={20} className="text-yellow-500" />}
              label="Avg Rating" value={analytics?.avg_rating || "0.0"} color="bg-yellow-100"
              sub={`${formatNumber(shop.follower_count)} followers`} />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Revenue & Orders</h2>
              <Link to="/seller/analytics" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                Full report <ChevronRight size={12} />
              </Link>
            </div>
            {analytics?.daily?.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any, n: string) => n === "revenue" ? formatPrice(v) : v} />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#ff9800" strokeWidth={2} dot={false} name="revenue" />
                  <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#3f51b5" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="orders" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No sales data for this period yet
              </div>
            )}
          </div>

          {/* Top products */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Top Products</h2>
              <Link to="/seller/products" className="text-xs text-primary-600 hover:underline">View all</Link>
            </div>
            {analytics?.top_products?.length ? (
              <div className="space-y-3">
                {analytics.top_products.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300 w-4">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.sold} sold</p>
                    </div>
                    <span className="text-sm font-bold text-primary-600 shrink-0">{formatPrice(p.price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No products yet</p>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent orders */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Recent Orders</h2>
              <Link to="/seller/orders" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                All orders <ChevronRight size={12} />
              </Link>
            </div>
            {!recentOrders?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.slice(0, 6).map((order: any) => (
                  <Link key={order.id} to={`/orders/${order.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div>
                      <p className="text-sm font-medium font-mono">#{order.order_number}</p>
                      <p className="text-xs text-gray-400">{formatRelativeTime(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatPrice(order.total_amount)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        order.status === "delivered" ? "bg-green-100 text-green-700" :
                        order.status === "cancelled" ? "bg-red-100 text-red-700" :
                        order.status === "shipped" ? "bg-blue-100 text-blue-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{order.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent reviews */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">
                Customer Reviews
                {unreadReviews > 0 && (
                  <span className="ml-2 bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unreadReviews} need reply</span>
                )}
              </h2>
              <Link to="/seller/reviews" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                All reviews <ChevronRight size={12} />
              </Link>
            </div>
            {!reviews?.items?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviews.items.slice(0, 4).map((r: any) => (
                  <div key={r.id} className="border-b border-gray-50 dark:border-gray-800 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      {Array.from({length: 5}).map((_, i) => (
                        <Star key={i} size={11} className={i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                      ))}
                      <span className="text-xs text-gray-400 ml-1">{formatRelativeTime(r.created_at)}</span>
                      {!r.seller_reply && <span className="ml-auto text-xs text-orange-500 font-medium">Needs reply</span>}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
