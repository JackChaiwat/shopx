import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2, TrendingUp, Eye, ShoppingCart, Star, Package,
  ArrowUpRight, ArrowDownRight, Users,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useMyShop } from "@/hooks/useQueries";
import { Spinner, EmptyState } from "@/components/ui";
import { formatPrice, formatNumber } from "@/utils";
import api from "@/services/api";

const COLORS = ["#ff9800", "#3f51b5", "#4caf50", "#f44336", "#9c27b0", "#00bcd4"];

function MetricCard({ icon, label, value, sub, change }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; change?: number;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-2">
        <div className="text-gray-400">{icon}</div>
        {change !== undefined && (
          <span className={`flex items-center text-xs font-semibold ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
            {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function SellerAnalytics() {
  const { data: shop } = useMyShop();
  const [period, setPeriod] = useState("30d");

  const { data: overview, isLoading } = useQuery({
    queryKey: ["seller-analytics-overview", period],
    queryFn: async () => { const r = await api.get(`/shops/my/analytics/overview?period=${period}`); return r.data.data; },
    enabled: !!shop,
  });

  const { data: products } = useQuery({
    queryKey: ["seller-product-analytics"],
    queryFn: async () => { const r = await api.get("/shops/my/analytics/products"); return r.data.data; },
    enabled: !!shop,
  });

  const { data: reviewAnalytics } = useQuery({
    queryKey: ["seller-reviews-analytics"],
    queryFn: async () => { const r = await api.get("/shops/my/analytics/reviews"); return r.data.data; },
    enabled: !!shop,
  });

  if (!shop) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-primary-500" /></div>;

  const ratingDist = reviewAnalytics?.rating_distribution || {};
  const ratingChartData = [5, 4, 3, 2, 1].map(r => ({
    rating: `${r} stars`, count: ratingDist[String(r)] || 0,
  }));

  const orderStatusData = Object.entries(overview?.order_status || {}).map(([k, v]) => ({
    name: k, value: Number(v),
  }));

  return (
    <>
      <Helmet><title>Analytics — Seller Dashboard</title></Helmet>
      <div className="max-w-[1300px] mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-sm text-gray-500">{shop.name}</p>
          </div>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="input text-sm py-1.5 w-32">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard icon={<TrendingUp size={20} />} label="Total Revenue" value={formatPrice(overview?.revenue || 0)} />
              <MetricCard icon={<ShoppingCart size={20} />} label="Total Orders"
                value={(Object.values(overview?.order_status || {}) as number[]).reduce((s, v) => s + v, 0)}
                sub={`${overview?.order_status?.pending || 0} pending`} />
              <MetricCard icon={<Package size={20} />} label="Active Products" value={overview?.active_products || 0} />
              <MetricCard icon={<Star size={20} />} label="Average Rating" value={overview?.avg_rating || "0.0"}
                sub={`${formatNumber(overview?.total_sales || 0)} total sales`} />
            </div>

            {/* Revenue + Orders chart */}
            <div className="card p-5">
              <h2 className="font-bold mb-4">Revenue Over Time</h2>
              {overview?.daily?.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={overview.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                    <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any, n: string) => n === "revenue" ? formatPrice(v) : v} />
                    <Legend />
                    <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#ff9800" strokeWidth={2.5} dot={false} name="Revenue (฿)" />
                    <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#3f51b5" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="Orders" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-gray-400 py-8 text-sm">No revenue data for this period</p>}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Order status pie */}
              <div className="card p-5">
                <h2 className="font-bold mb-4">Order Status Distribution</h2>
                {orderStatusData.length ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="60%" height={180}>
                      <PieChart>
                        <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                          dataKey="value" paddingAngle={3}>
                          {orderStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {orderStatusData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2 text-sm">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="capitalize text-gray-600 dark:text-gray-400">{d.name}</span>
                          <span className="font-semibold ml-auto">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-center text-gray-400 py-6 text-sm">No orders yet</p>}
              </div>

              {/* Rating distribution */}
              <div className="card p-5">
                <h2 className="font-bold mb-4">Rating Distribution</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ratingChartData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="rating" type="category" tick={{ fontSize: 12 }} width={30} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ff9800" radius={[0, 4, 4, 0]} name="Reviews" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Product performance table */}
            <div className="card p-5">
              <h2 className="font-bold mb-4">Product Performance</h2>
              {products?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 dark:border-gray-800">
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="pb-3 font-medium">Product</th>
                        <th className="pb-3 font-medium text-right">Views</th>
                        <th className="pb-3 font-medium text-right">Sold</th>
                        <th className="pb-3 font-medium text-right hidden sm:table-cell">Conversion</th>
                        <th className="pb-3 font-medium text-right hidden md:table-cell">Stock</th>
                        <th className="pb-3 font-medium text-right">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {products.map((p: any) => (
                        <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="py-3 font-medium line-clamp-1 max-w-xs">{p.name}</td>
                          <td className="py-3 text-right text-gray-600">{formatNumber(p.views)}</td>
                          <td className="py-3 text-right font-medium">{formatNumber(p.sold)}</td>
                          <td className="py-3 text-right hidden sm:table-cell">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              p.conversion >= 5 ? "bg-green-100 text-green-700" :
                              p.conversion >= 2 ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{p.conversion}%</span>
                          </td>
                          <td className="py-3 text-right hidden md:table-cell">
                            <span className={p.stock <= 5 ? "text-red-500 font-medium" : "text-gray-600"}>{p.stock}</span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="flex items-center justify-end gap-1">
                              <Star size={12} className="fill-yellow-400 text-yellow-400" />
                              <span>{p.rating}</span>
                              <span className="text-xs text-gray-400">({p.reviews})</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-center text-gray-400 py-6 text-sm">No product data yet</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
