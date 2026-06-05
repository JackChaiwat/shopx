import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronRight, MessageCircle, Package, ReceiptText, X } from "lucide-react";
import { useOrders } from "@/hooks/useQueries";
import { EmptyState, Spinner } from "@/components/ui";
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/utils";
import type { Order, OrderStatus } from "@/types";
import api from "@/services/api";
import toast from "react-hot-toast";

const STATUSES: { label: string; value: OrderStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const MONTHS = [
  { label: "All months", value: "" },
  { label: "January", value: "1" },
  { label: "February", value: "2" },
  { label: "March", value: "3" },
  { label: "April", value: "4" },
  { label: "May", value: "5" },
  { label: "June", value: "6" },
  { label: "July", value: "7" },
  { label: "August", value: "8" },
  { label: "September", value: "9" },
  { label: "October", value: "10" },
  { label: "November", value: "11" },
  { label: "December", value: "12" },
];

function orderMonthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function Orders() {
  const now = new Date();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("");

  const years = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(current - i));
  }, [now]);

  const params = {
    ...(status ? { status } : {}),
    ...(year ? { year: Number(year) } : {}),
    ...(month ? { month: Number(month) } : {}),
  };
  const { data: orders = [], isLoading } = useOrders(params);

  const summary = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.count += 1;
        acc.total += parseFloat(order.total_amount);
        acc.items += order.items?.length || 0;
        return acc;
      },
      { count: 0, total: 0, items: 0 }
    );
  }, [orders]);

  const groupedOrders = useMemo(() => {
    return orders.reduce<Record<string, Order[]>>((acc, order) => {
      const label = orderMonthLabel(order.created_at);
      acc[label] = acc[label] || [];
      acc[label].push(order);
      return acc;
    }, {});
  }, [orders]);

  const cancelOrder = async (order: Order) => {
    if (!window.confirm(`Cancel order #${order.order_number}?`)) return;
    try {
      await api.post(`/orders/${order.id}/cancel`, null, { params: { reason: "Cancelled by customer" } });
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to cancel order");
    }
  };

  return (
    <>
      <Helmet><title>My Orders - ShopX</title></Helmet>
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold">My Orders</h1>
            <p className="text-sm text-gray-500 mt-1">Browse your purchases by status, month, and year.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar size={16} />
            <span>{year || "All years"}{month ? ` / ${MONTHS.find(m => m.value === month)?.label}` : ""}</span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mb-5">
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
            <div className="p-4">
              <p className="text-xs text-gray-500">Orders</p>
              <p className="text-xl font-bold">{summary.count}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500">Items</p>
              <p className="text-xl font-bold">{summary.items}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500">Total spent</p>
              <p className="text-xl font-bold text-primary-600">{formatPrice(summary.total)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value as OrderStatus | "")}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                  status === s.value
                    ? "bg-primary-500 text-white border-primary-500"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <select value={year} onChange={e => { setYear(e.target.value); if (!e.target.value) setMonth(""); }} className="input text-sm">
              <option value="">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={month} onChange={e => setMonth(e.target.value)} disabled={!year} className="input text-sm">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
        ) : !orders.length ? (
          <EmptyState
            icon={<Package size={48} />}
            title="No orders found"
            description="Try another month, year, or status."
            action={<Link to="/" className="btn btn-primary">Start Shopping</Link>}
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([group, groupOrders]) => (
              <section key={group}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{group}</h2>
                  <span className="text-xs text-gray-400">{groupOrders.length} order{groupOrders.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                  {groupOrders.map((order, index) => (
                    <div
                      key={order.id}
                      className={`grid sm:grid-cols-[1fr_auto] gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${
                        index > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <ReceiptText size={15} className="text-gray-400" />
                          <p className="font-semibold text-sm">#{order.order_number}</p>
                          <span className={`badge ${ORDER_STATUS_COLORS[order.status]}`}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2 shrink-0">
                            {order.items?.slice(0, 3).map((item) => (
                              <div key={item.id} className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900">
                                {item.product_image_url ? (
                                  <img src={item.product_image_url} alt="" className="w-full h-full object-cover" />
                                ) : <Package size={16} className="m-auto mt-2 text-gray-300" />}
                              </div>
                            ))}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                              {order.items?.[0]?.product_name || "Order items"}
                              {(order.items?.length || 0) > 1 ? ` +${(order.items?.length || 0) - 1} more` : ""}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(order.created_at)} · {order.items?.length || 0} item{order.items?.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-end justify-between gap-2">
                        <span className="font-bold text-primary-600">{formatPrice(order.total_amount)}</span>
                        <div className="flex flex-wrap justify-end gap-2">
                          {order.status === "pending" && order.payment?.status !== "paid" && (
                            <button
                              type="button"
                              onClick={() => cancelOrder(order)}
                              className="btn btn-secondary btn-sm text-red-600 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-900 dark:hover:bg-red-900/20"
                            >
                              <X size={13} /> Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/chat?order_id=${order.id}`)}
                            className="btn btn-secondary btn-sm"
                          >
                            <MessageCircle size={13} /> Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="btn btn-secondary btn-sm"
                          >
                            Details <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
