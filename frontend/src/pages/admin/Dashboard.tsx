import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Users, Store, Package, ShieldCheck, Activity, BarChart2,
  DollarSign, ShoppingBag, TrendingUp, AlertTriangle, Eye,
  CheckCircle, XCircle, Clock, Search, Filter, Download,
  ChevronLeft, ChevronRight, Star, Wallet, Ban, RefreshCw,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Spinner, EmptyState, Badge, Modal, Input, Select, Pagination } from "@/components/ui";
import { formatPrice, formatDate, formatRelativeTime, formatNumber } from "@/utils";
import api from "@/services/api";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────
type AdminTab = "overview" | "users" | "shops" | "products" | "orders" | "reviews" | "audit" | "finance";

const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: "overview",  label: "Overview",  icon: <BarChart2 size={15} /> },
  { key: "users",     label: "Users",     icon: <Users size={15} /> },
  { key: "shops",     label: "Shops",     icon: <Store size={15} /> },
  { key: "products",  label: "Products",  icon: <Package size={15} /> },
  { key: "orders",    label: "Orders",    icon: <ShoppingBag size={15} /> },
  { key: "reviews",   label: "Reviews",   icon: <Star size={15} /> },
  { key: "finance",   label: "Finance",   icon: <DollarSign size={15} /> },
  { key: "audit",     label: "Audit Log", icon: <Activity size={15} /> },
];

const COLORS = ["#ff9800", "#3f51b5", "#4caf50", "#f44336", "#9c27b0"];

// ── Stat Card ────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, alert }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; alert?: boolean;
}) {
  return (
    <div className={`card p-5 ${alert ? "border-l-4 border-orange-400" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [period, setPeriod] = useState("30d");

  // Users state
  const [userPage, setUserPage] = useState(1);
  const [userQ, setUserQ] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [userRole, setUserRole] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [walletModal, setWalletModal] = useState<any>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("");

  // Shops state
  const [shopPage, setShopPage] = useState(1);
  const [shopQ, setShopQ] = useState("");
  const [shopStatus, setShopStatus] = useState("");

  // Products state
  const [prodPage, setProdPage] = useState(1);
  const [prodQ, setProdQ] = useState("");
  const [prodStatus, setProdStatus] = useState("");

  // Orders state
  const [orderPage, setOrderPage] = useState(1);
  const [orderQ, setOrderQ] = useState("");
  const [orderStatus, setOrderStatus] = useState("");

  // Reviews state
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewStatus, setReviewStatus] = useState("pending");

  // Audit state
  const [auditPage, setAuditPage] = useState(1);

  const qc = useQueryClient();

  // ── Queries ────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => { const r = await api.get("/admin/stats"); return r.data.data; },
    refetchInterval: 60000,
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue", period],
    queryFn: async () => { const r = await api.get(`/admin/analytics/revenue?period=${period}`); return r.data.data; },
    enabled: tab === "overview" || tab === "finance",
  });

  const { data: userAnalytics } = useQuery({
    queryKey: ["admin-user-analytics", period],
    queryFn: async () => { const r = await api.get(`/admin/analytics/users?period=${period}`); return r.data.data; },
    enabled: tab === "overview",
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", userPage, userQ, userStatus, userRole],
    queryFn: async () => {
      const r = await api.get("/admin/users", { params: { page: userPage, limit: 20, q: userQ || undefined, status: userStatus || undefined, role: userRole || undefined } });
      return r.data.data;
    },
    enabled: tab === "users",
  });

  const { data: shopsData, isLoading: shopsLoading } = useQuery({
    queryKey: ["admin-shops", shopPage, shopQ, shopStatus],
    queryFn: async () => {
      const r = await api.get("/admin/shops", { params: { page: shopPage, limit: 20, q: shopQ || undefined, status: shopStatus || undefined } });
      return r.data.data;
    },
    enabled: tab === "shops",
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-products", prodPage, prodQ, prodStatus],
    queryFn: async () => {
      const r = await api.get("/admin/products", { params: { page: prodPage, limit: 20, q: prodQ || undefined, status: prodStatus || undefined } });
      return r.data.data;
    },
    enabled: tab === "products",
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-orders", orderPage, orderQ, orderStatus],
    queryFn: async () => {
      const r = await api.get("/admin/orders", { params: { page: orderPage, limit: 20, q: orderQ || undefined, status: orderStatus || undefined } });
      return r.data.data;
    },
    enabled: tab === "orders",
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["admin-reviews", reviewPage, reviewStatus],
    queryFn: async () => {
      const r = await api.get("/admin/reviews", { params: { page: reviewPage, limit: 20, status: reviewStatus || undefined } });
      return r.data.data;
    },
    enabled: tab === "reviews",
  });

  const { data: auditData } = useQuery({
    queryKey: ["admin-audit", auditPage],
    queryFn: async () => { const r = await api.get(`/admin/audit-logs?page=${auditPage}&limit=50`); return r.data.data; },
    enabled: tab === "audit",
  });

  const { data: billingSummary } = useQuery({
    queryKey: ["admin-billing-summary", period],
    queryFn: async () => { const r = await api.get("/admin/billing/summary", { params: { period } }); return r.data.data; },
    enabled: tab === "finance",
  });

  const { data: billingTransactions } = useQuery({
    queryKey: ["admin-billing-transactions", period],
    queryFn: async () => { const r = await api.get("/admin/billing/transactions", { params: { page: 1, limit: 10 } }); return r.data.data; },
    enabled: tab === "finance",
  });

  const { data: billingPayouts } = useQuery({
    queryKey: ["admin-billing-payouts", period],
    queryFn: async () => { const r = await api.get("/admin/billing/payouts", { params: { period } }); return r.data.data; },
    enabled: tab === "finance",
  });

  // ── Mutations ──────────────────────────────────────────
  const updateUser = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/users/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User updated"); },
  });

  const bulkUserAction = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: string }) =>
      api.post("/admin/users/bulk-action", { user_ids: ids, action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setSelectedUsers([]); toast.success("Bulk action applied"); },
  });

  const updateShop = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.patch(`/admin/shops/${id}/status`, { status, reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-shops"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success("Shop updated"); },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/products/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Product updated"); },
  });

  const moderateReview = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/reviews/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reviews"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success("Review moderated"); },
  });

  const walletTopup = useMutation({
    mutationFn: async ({ userId, amount, note }: { userId: string; amount: number; note: string }) =>
      api.post("/admin/wallet/topup", { user_id: userId, amount, note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setWalletModal(null); setWalletAmount(""); setWalletNote(""); toast.success("Wallet topped up"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message || "Failed"),
  });

  // ── Helpers ────────────────────────────────────────────
  const toggleUser = (id: string) => setSelectedUsers(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const exportBillingCsv = () => {
    window.open(`/api/v1/admin/billing/export.csv?period=${period}`, "_blank");
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "badge-success", inactive: "badge-warning", suspended: "badge-danger",
      pending: "badge-warning", pending_verification: "badge-warning",
      closed: "badge-danger", draft: "badge-warning", approved: "badge-success",
      rejected: "badge-danger", confirmed: "badge-info", shipped: "badge-info",
      delivered: "badge-success", cancelled: "badge-danger", paid: "badge-success",
      failed: "badge-danger",
    };
    return <span className={`badge ${map[status] || "badge-info"}`}>{status}</span>;
  };

  return (
    <>
      <Helmet><title>Admin Dashboard - ShopX</title></Helmet>
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <ShieldCheck size={20} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Platform management & analytics</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select value={period} onChange={e => setPeriod(e.target.value)}
              className="input py-1.5 text-sm w-28">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button onClick={() => qc.invalidateQueries()} className="btn btn-secondary btn-sm">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t.key ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.icon} {t.label}
              {t.key === "shops" && stats?.pending_shop_approvals > 0 && (
                <span className="bg-orange-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{stats.pending_shop_approvals}</span>
              )}
              {t.key === "reviews" && stats?.pending_reviews > 0 && (
                <span className="bg-yellow-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{stats.pending_reviews}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard icon={<DollarSign size={20} className="text-green-600" />} label="Revenue (Month)" value={formatPrice(stats?.revenue_this_month || 0)} color="bg-green-100" />
              <StatCard icon={<ShoppingBag size={20} className="text-blue-600" />} label="Orders Today" value={stats?.orders_today ?? "—"} color="bg-blue-100" />
              <StatCard icon={<Users size={20} className="text-purple-600" />} label="Total Users" value={formatNumber(stats?.total_users || 0)} sub={`+${stats?.new_users_this_month || 0} this month`} color="bg-purple-100" />
              <StatCard icon={<Store size={20} className="text-orange-600" />} label="Pending Shops" value={stats?.pending_shop_approvals ?? 0} alert={(stats?.pending_shop_approvals || 0) > 0} color="bg-orange-100" />
              <StatCard icon={<Star size={20} className="text-yellow-500" />} label="Pending Reviews" value={stats?.pending_reviews ?? 0} alert={(stats?.pending_reviews || 0) > 0} color="bg-yellow-100" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Revenue chart */}
              <div className="lg:col-span-2 card p-5">
                <h2 className="font-bold mb-4">Revenue ({period})</h2>
                {revenue?.daily?.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={revenue.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => formatPrice(v)} labelFormatter={l => `Date: ${l}`} />
                      <Line type="monotone" dataKey="revenue" stroke="#ff9800" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No revenue data yet</div>}
              </div>

              {/* Top shops */}
              <div className="card p-5">
                <h2 className="font-bold mb-4">Top Shops by Revenue</h2>
                <div className="space-y-3">
                  {revenue?.top_shops?.length ? revenue.top_shops.slice(0, 5).map((s: any, i: number) => (
                    <div key={s.shop_id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">#{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.orders} orders</p>
                      </div>
                      <span className="text-sm font-bold text-primary-600">{formatPrice(s.revenue)}</span>
                    </div>
                  )) : <p className="text-sm text-gray-400">No data yet</p>}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Order status breakdown */}
              <div className="card p-5">
                <h2 className="font-bold mb-4">Order Status Breakdown</h2>
                {revenue?.order_status && Object.keys(revenue.order_status).length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(revenue.order_status).map(([status, count]: [string, any]) => (
                      <div key={status} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500 capitalize">{status.replace("_", " ")}</p>
                        <p className="text-xl font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">No orders yet</p>}
              </div>

              {/* User registrations */}
              <div className="card p-5">
                <h2 className="font-bold mb-4">New Registrations</h2>
                {userAnalytics?.daily_registrations?.length ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={userAnalytics.daily_registrations}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3f51b5" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-gray-400">No registration data</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ────────────────────────────────────── */}
        {tab === "users" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={userQ} onChange={e => { setUserQ(e.target.value); setUserPage(1); }}
                  placeholder="Search email or name..." className="input pl-9 text-sm py-1.5" />
              </div>
              <select value={userRole} onChange={e => { setUserRole(e.target.value); setUserPage(1); }} className="input text-sm py-1.5 w-32">
                <option value="">All Roles</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
              </select>
              <select value={userStatus} onChange={e => { setUserStatus(e.target.value); setUserPage(1); }} className="input text-sm py-1.5 w-36">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending_verification">Pending</option>
              </select>
              {selectedUsers.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => bulkUserAction.mutate({ ids: selectedUsers, action: "suspend" })}
                    className="btn btn-danger btn-sm"><Ban size={13} /> Suspend {selectedUsers.length}</button>
                  <button onClick={() => bulkUserAction.mutate({ ids: selectedUsers, action: "activate" })}
                    className="btn btn-secondary btn-sm"><CheckCircle size={13} /> Activate</button>
                </div>
              )}
            </div>

            <div className="card overflow-x-auto">
              {usersLoading ? <div className="flex justify-center py-12"><Spinner className="w-7 h-7 text-primary-400" /></div> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-3 text-left w-8">
                        <input type="checkbox" onChange={e => setSelectedUsers(e.target.checked ? usersData?.items?.map((u: any) => u.id) || [] : [])} />
                      </th>
                      <th className="text-left px-4 py-3 font-medium">User</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Role</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Wallet</th>
                      <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {usersData?.items?.map((u: any) => (
                      <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggleUser(u.id)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              : <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold">{u.full_name?.[0] || u.email[0].toUpperCase()}</div>}
                            <div>
                              <p className="font-medium">{u.full_name || "—"}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">{statusBadge(u.role)}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-sm font-medium">{formatPrice(u.wallet_balance || 0)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3">{statusBadge(u.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setWalletModal(u)} title="Adjust wallet" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600">
                              <Wallet size={14} />
                            </button>
                            {u.status === "active"
                              ? <button onClick={() => updateUser.mutate({ id: u.id, status: "suspended" })} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Suspend"><Ban size={14} /></button>
                              : <button onClick={() => updateUser.mutate({ id: u.id, status: "active" })} className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600" title="Activate"><CheckCircle size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Pagination page={userPage} pages={usersData?.pages || 1} onChange={setUserPage} />

            {/* Wallet modal */}
            <Modal open={!!walletModal} onClose={() => setWalletModal(null)} title={`Adjust Wallet — ${walletModal?.full_name || walletModal?.email}`}>
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Current balance: <strong>{formatPrice(walletModal?.wallet_balance || 0)}</strong></p>
                <Input label="Amount (positive = add, negative = deduct)" type="number" step="0.01"
                  value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="e.g. 100 or -50" />
                <Input label="Note / Reason" value={walletNote} onChange={e => setWalletNote(e.target.value)} placeholder="e.g. Promotional credit" />
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setWalletModal(null)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button disabled={!walletAmount || !walletNote || walletTopup.isPending}
                    onClick={() => walletTopup.mutate({ userId: walletModal.id, amount: parseFloat(walletAmount), note: walletNote })}
                    className="btn btn-primary btn-sm">
                    {walletTopup.isPending ? <Spinner className="w-4 h-4" /> : "Apply"}
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        )}

        {/* ── SHOPS ────────────────────────────────────── */}
        {tab === "shops" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={shopQ} onChange={e => { setShopQ(e.target.value); setShopPage(1); }}
                  placeholder="Search shop name..." className="input pl-9 text-sm py-1.5" />
              </div>
              <select value={shopStatus} onChange={e => { setShopStatus(e.target.value); setShopPage(1); }} className="input text-sm py-1.5 w-36">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {shopsData?.items?.filter((s: any) => s.status === "pending").length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-orange-500 shrink-0" />
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  <strong>{shopsData.items.filter((s: any) => s.status === "pending").length}</strong> shops waiting for approval
                </p>
              </div>
            )}

            <div className="card overflow-x-auto">
              {shopsLoading ? <div className="flex justify-center py-12"><Spinner className="w-7 h-7 text-primary-400" /></div> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Shop</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Owner</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Sales</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Rating</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {shopsData?.items?.map((s: any) => (
                      <tr key={s.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/30 ${s.status === "pending" ? "bg-orange-50/30 dark:bg-orange-900/10" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-gray-400">{formatDate(s.created_at)}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500">{s.owner_email}</td>
                        <td className="px-4 py-3 hidden md:table-cell">{s.total_sales.toLocaleString()}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                            <span>{parseFloat(s.rating).toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{statusBadge(s.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {s.status === "pending" && <>
                              <button onClick={() => updateShop.mutate({ id: s.id, status: "active" })}
                                className="btn btn-sm text-xs bg-green-500 text-white hover:bg-green-600 px-2 py-1">Approve</button>
                              <button onClick={() => updateShop.mutate({ id: s.id, status: "closed", reason: "Not approved" })}
                                className="btn btn-sm btn-danger text-xs px-2 py-1">Reject</button>
                            </>}
                            {s.status === "active" && (
                              <button onClick={() => updateShop.mutate({ id: s.id, status: "suspended" })}
                                className="text-xs text-red-500 hover:underline px-2">Suspend</button>
                            )}
                            {s.status === "suspended" && (
                              <button onClick={() => updateShop.mutate({ id: s.id, status: "active" })}
                                className="text-xs text-green-500 hover:underline px-2">Reinstate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Pagination page={shopPage} pages={shopsData?.pages || 1} onChange={setShopPage} />
          </div>
        )}

        {/* ── PRODUCTS ─────────────────────────────────── */}
        {tab === "products" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={prodQ} onChange={e => { setProdQ(e.target.value); setProdPage(1); }}
                  placeholder="Search products..." className="input pl-9 text-sm py-1.5" />
              </div>
              <select value={prodStatus} onChange={e => { setProdStatus(e.target.value); setProdPage(1); }} className="input text-sm py-1.5 w-36">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="card overflow-x-auto">
              {productsLoading ? <div className="flex justify-center py-12"><Spinner className="w-7 h-7 text-primary-400" /></div> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Product</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Shop</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Price</th>
                      <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Stock / Sold</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {productsData?.items?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <p className="font-medium line-clamp-1">{p.name}</p>
                          <p className="text-xs text-gray-400">{formatDate(p.created_at)}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500">{p.shop_name}</td>
                        <td className="px-4 py-3 hidden md:table-cell font-medium">{formatPrice(p.base_price)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">{p.stock_quantity} / {p.sold_count}</td>
                        <td className="px-4 py-3">{statusBadge(p.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {p.status !== "active" && (
                              <button onClick={() => updateProduct.mutate({ id: p.id, status: "active" })} className="text-xs text-green-500 hover:underline">Activate</button>
                            )}
                            {p.status === "active" && (
                              <button onClick={() => updateProduct.mutate({ id: p.id, status: "inactive" })} className="text-xs text-red-500 hover:underline">Deactivate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Pagination page={prodPage} pages={productsData?.pages || 1} onChange={setProdPage} />
          </div>
        )}

        {/* ── ORDERS ───────────────────────────────────── */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={orderQ} onChange={e => { setOrderQ(e.target.value); setOrderPage(1); }}
                  placeholder="Order number..." className="input pl-9 text-sm py-1.5" />
              </div>
              <select value={orderStatus} onChange={e => { setOrderStatus(e.target.value); setOrderPage(1); }} className="input text-sm py-1.5 w-36">
                <option value="">All Status</option>
                {["pending","confirmed","processing","shipped","delivered","cancelled","refunded"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="card overflow-x-auto">
              {ordersLoading ? <div className="flex justify-center py-12"><Spinner className="w-7 h-7 text-primary-400" /></div> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Order</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Amount</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Payment</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {ordersData?.items?.map((o: any) => (
                      <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <p className="font-mono font-medium text-xs">#{o.order_number}</p>
                          <p className="text-xs text-gray-400">Shop {o.shop_id.slice(0,8)}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell font-medium">{formatPrice(o.total_amount)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">{o.payment_status ? statusBadge(o.payment_status) : "—"}</td>
                        <td className="px-4 py-3">{statusBadge(o.status)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Pagination page={orderPage} pages={ordersData?.pages || 1} onChange={setOrderPage} />
          </div>
        )}

        {/* ── REVIEWS ──────────────────────────────────── */}
        {tab === "reviews" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {["pending", "approved", "rejected", ""].map(s => (
                <button key={s} onClick={() => { setReviewStatus(s); setReviewPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${reviewStatus === s ? "bg-primary-500 text-white border-primary-500" : "border-gray-200 text-gray-600"}`}>
                  {s || "All"}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {reviewsLoading ? <div className="flex justify-center py-12"><Spinner className="w-7 h-7 text-primary-400" /></div>
                : reviewsData?.items?.length === 0 ? <EmptyState title="No reviews found" />
                : reviewsData?.items?.map((r: any) => (
                  <div key={r.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex">
                            {Array.from({length: 5}).map((_, i) => (
                              <Star key={i} size={12} className={i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                            ))}
                          </div>
                          {statusBadge(r.status)}
                          <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                        </div>
                        {r.title && <p className="font-medium text-sm">{r.title}</p>}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{r.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {r.status !== "approved" && (
                          <button onClick={() => moderateReview.mutate({ id: r.id, status: "approved" })}
                            className="btn btn-sm text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1">Approve</button>
                        )}
                        {r.status !== "rejected" && (
                          <button onClick={() => moderateReview.mutate({ id: r.id, status: "rejected" })}
                            className="btn btn-sm btn-danger text-xs px-2 py-1">Reject</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <Pagination page={reviewPage} pages={Math.ceil((reviewsData?.total || 0) / 20)} onChange={setReviewPage} />
          </div>
        )}

        {/* ── FINANCE ──────────────────────────────────── */}
        {tab === "finance" && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard icon={<DollarSign size={20} className="text-green-600"/>} label="Total Revenue (Period)" value={formatPrice(revenue?.total_revenue || 0)} color="bg-green-100" />
              <StatCard icon={<TrendingUp size={20} className="text-blue-600"/>} label="Transactions" value={revenue?.daily?.reduce((s: number, d: any) => s + d.transactions, 0) || 0} color="bg-blue-100" />
              <StatCard icon={<ShoppingBag size={20} className="text-purple-600"/>} label="Total Orders" value={stats?.total_orders || 0} color="bg-purple-100" />
            </div>
            <div className="card p-5">
              <h2 className="font-bold mb-4">Revenue Over Time</h2>
              {revenue?.daily?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenue.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => formatPrice(v)} />
                    <Bar dataKey="revenue" fill="#ff9800" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 py-8 text-center">No payment data yet</p>}
            </div>
          </div>
        )}

        {/* ── AUDIT ────────────────────────────────────── */}
        {tab === "audit" && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Resource</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Details</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Admin</th>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {auditData?.items?.map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{l.action}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs">
                      <span className="badge badge-info">{l.resource_type}</span>
                      {l.resource_id && <span className="text-gray-400 ml-1">{l.resource_id.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                      {l.new_values ? JSON.stringify(l.new_values).slice(0, 60) : "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                      {l.user_id?.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatRelativeTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <Pagination page={auditPage} pages={Math.ceil((auditData?.total || 0) / 50)} onChange={setAuditPage} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
