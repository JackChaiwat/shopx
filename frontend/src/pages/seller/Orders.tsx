import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle, Eye, MapPin, MessageCircle, Package, Phone, Printer, ReceiptText, Save, Search, User } from "lucide-react";
import { useMyShop } from "@/hooks/useQueries";
import { EmptyState, Spinner, Modal } from "@/components/ui";
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/utils";
import type { Order, OrderStatus } from "@/types";
import api from "@/services/api";
import toast from "react-hot-toast";

const STATUSES: { key: OrderStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
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


function getInvoiceNumber(order: any) {
  if (order.invoice_number) return order.invoice_number;
  const created = new Date(order.created_at);
  const ym = Number.isNaN(created.getTime())
    ? ""
    : `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, "0")}`;
  return `INV-${ym}-${String(order.order_number || order.id).replace(/[^A-Za-z0-9]/g, "").slice(-8)}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printOrderInvoice(order: any, mode: "customer" | "seller" = "customer") {
  const address = order.shipping_address;
  const addressLine = address
    ? [address.address_line1, address.address_line2, address.city, address.state, address.postal_code, address.country].filter(Boolean).join(", ")
    : "-";
  const rows = (order.items || []).map((item: any) => `
    <tr>
      <td>
        <strong>${escapeHtml(item.product_name)}</strong>
        <div class="muted">${escapeHtml(item.sku || "No SKU")}${item.variant_name ? " ? " + escapeHtml(item.variant_name) : ""}</div>
      </td>
      <td class="right">${escapeHtml(item.quantity)}</td>
      <td class="right">${escapeHtml(formatPrice(item.unit_price))}</td>
      <td class="right">${escapeHtml(formatPrice(item.total_price))}</td>
    </tr>
  `).join("");
  const win = window.open("", "_blank", "width=900,height=720");
  if (!win) return;
  win.document.write(`<!doctype html>
  <html>
    <head>
      <title>${escapeHtml(getInvoiceNumber(order))}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 32px; background: #fff; }
        .page { max-width: 820px; margin: 0 auto; }
        .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 18px; }
        h1 { margin: 0; font-size: 28px; }
        h2 { margin: 0 0 8px; font-size: 15px; }
        .brand { color: #ff8a00; font-weight: 800; font-size: 22px; }
        .muted { color: #6b7280; font-size: 12px; line-height: 1.5; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
        .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { text-align: left; font-size: 12px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 10px 8px; }
        td { border-bottom: 1px solid #f3f4f6; padding: 12px 8px; vertical-align: top; }
        .right { text-align: right; }
        .totals { margin-left: auto; width: 320px; margin-top: 18px; }
        .line { display: flex; justify-content: space-between; padding: 7px 0; }
        .total { font-size: 18px; font-weight: 800; border-top: 2px solid #111827; margin-top: 8px; padding-top: 10px; }
        .footer { margin-top: 28px; color: #6b7280; font-size: 12px; }
        @media print { body { padding: 0; } button { display: none; } }
      </style>
    </head>
    <body>
      <div class="page">
        <button onclick="window.print()" style="float:right;margin-bottom:16px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer">Print / Save PDF</button>
        <div class="top">
          <div>
            <div class="brand">ShopX</div>
            <div class="muted">${mode === "seller" ? "Seller invoice and packing bill" : "Customer receipt"}</div>
          </div>
          <div class="right">
            <h1>Invoice</h1>
            <div class="muted">${escapeHtml(getInvoiceNumber(order))}</div>
            <div class="muted">Order #${escapeHtml(order.order_number)}</div>
            <div class="muted">${escapeHtml(formatDate(order.created_at))}</div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <h2>Customer</h2>
            <div>${escapeHtml(order.buyer?.full_name || address?.recipient_name || "-")}</div>
            <div class="muted">${escapeHtml(order.buyer?.email || "-")}</div>
            <div class="muted">${escapeHtml(address?.phone || order.buyer?.phone || "-")}</div>
          </div>
          <div class="box">
            <h2>Ship to</h2>
            <div>${escapeHtml(address?.recipient_name || "-")}</div>
            <div class="muted">${escapeHtml(addressLine)}</div>
          </div>
        </div>

        <table>
          <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="line"><span>Subtotal</span><span>${escapeHtml(formatPrice(order.subtotal))}</span></div>
          <div class="line"><span>Shipping</span><span>${escapeHtml(formatPrice(order.shipping_fee))}</span></div>
          <div class="line"><span>Tax</span><span>${escapeHtml(formatPrice(order.tax_amount))}</span></div>
          <div class="line"><span>Discount</span><span>-${escapeHtml(formatPrice(order.discount_amount))}</span></div>
          <div class="line total"><span>Total</span><span>${escapeHtml(formatPrice(order.total_amount))}</span></div>
        </div>

        <div class="footer">
          Status: ${escapeHtml(order.status)}${order.tracking_number ? " ? Tracking: " + escapeHtml(order.tracking_number) : ""}<br/>
          This document was generated automatically from the order record.
        </div>
      </div>
      <script>setTimeout(() => window.print(), 300)</script>
    </body>
  </html>`);
  win.document.close();
}

const SELLER_TRANSITIONS: Record<string, { label: string; next: OrderStatus; style: string }[]> = {
  pending: [{ label: "Confirm", next: "confirmed", style: "bg-blue-500 text-white hover:bg-blue-600" }],
  confirmed: [{ label: "Process", next: "processing", style: "bg-indigo-500 text-white hover:bg-indigo-600" }],
  processing: [{ label: "Ship", next: "shipped", style: "bg-purple-500 text-white hover:bg-purple-600" }],
  shipped: [{ label: "Deliver", next: "delivered", style: "bg-green-500 text-white hover:bg-green-600" }],
};

function monthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function SellerOrders() {
  const { data: shop } = useMyShop();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = new Date();

  const [filterStatus, setFilterStatus] = useState<OrderStatus | "">("");
  const [searchQ, setSearchQ] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [statusInput, setStatusInput] = useState<OrderStatus>("pending");
  const [cancelReason, setCancelReason] = useState("");
  const [updating, setUpdating] = useState(false);

  const years = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(current - i));
  }, [now]);

  const { data: ordersData = [], isLoading } = useQuery({
    queryKey: ["seller-orders", filterStatus, searchQ, year, month],
    queryFn: async () => {
      const r = await api.get("/orders/seller/orders", {
        params: {
          limit: 50,
          status: filterStatus || undefined,
          q: searchQ || undefined,
          year: year ? Number(year) : undefined,
          month: month ? Number(month) : undefined,
        },
      });
      return r.data.data as Order[];
    },
    enabled: !!shop,
  });

  const orders = Array.isArray(ordersData) ? ordersData : [];
  const statusCounts = orders.reduce((acc: Record<string, number>, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const summary = orders.reduce(
    (acc, order) => {
      acc.orders += 1;
      acc.items += order.items?.length || 0;
      acc.revenue += parseFloat(order.total_amount);
      return acc;
    },
    { orders: 0, items: 0, revenue: 0 }
  );
  const groupedOrders = orders.reduce<Record<string, Order[]>>((acc, order) => {
    const label = monthLabel(order.created_at);
    acc[label] = acc[label] || [];
    acc[label].push(order);
    return acc;
  }, {});

  const formatAddress = (order: Order) => {
    const addr = order.shipping_address;
    if (!addr) return "No shipping address";
    return [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code, addr.country]
      .filter(Boolean)
      .join(", ");
  };

  const openOrderModal = (order: Order, nextStatus?: OrderStatus) => {
    setSelectedOrder(order);
    setTrackingInput(order.tracking_number || "");
    setStatusInput(nextStatus || order.status);
    setCancelReason("");
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdating(true);
    try {
      await api.patch(`/orders/seller/orders/${orderId}/status`, {
        status,
        tracking_number: trackingInput,
        cancel_reason: cancelReason || undefined,
      });
      toast.success("Order status updated");
      qc.invalidateQueries({ queryKey: ["seller-orders"] });
      setSelectedOrder(null);
      setTrackingInput("");
      setCancelReason("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to update");
    } finally {
      setUpdating(false);
    }
  };

  const verifyTransfer = async (order: Order) => {
    if (!window.confirm(`Confirm PromptPay transfer for order #${order.order_number}?`)) return;
    try {
      await api.post(`/payments/seller/orders/${order.id}/verify-transfer`, { note: "Verified by seller" });
      toast.success("Payment verified and order confirmed");
      qc.invalidateQueries({ queryKey: ["seller-orders"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to verify payment");
    }
  };

  return (
    <>
      <Helmet><title>Orders - Seller Dashboard</title></Helmet>
      <div className="max-w-[1300px] mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Customer Orders</h1>
            <p className="text-sm text-gray-500 mt-1">Manage orders by status, month, and year.</p>
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
              <p className="text-xl font-bold">{summary.orders}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500">Items</p>
              <p className="text-xl font-bold">{summary.items}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="text-xl font-bold text-primary-600">{formatPrice(summary.revenue)}</p>
            </div>
          </div>
        </div>

        {statusCounts.pending > 0 && !filterStatus && (
          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg flex items-center gap-2">
            <Package size={16} className="text-orange-500 shrink-0" />
            <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
              {statusCounts.pending} order{statusCounts.pending > 1 ? "s" : ""} waiting for confirmation
            </p>
            <button onClick={() => setFilterStatus("pending")} className="ml-auto text-xs text-orange-600 font-medium underline">
              Show pending
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-5">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUSES.map(t => (
              <button key={t.key} onClick={() => setFilterStatus(t.key)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                  filterStatus === t.key
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                }`}>
                {t.label}
                {t.key && statusCounts[t.key] > 0 && <span className="ml-1 text-xs opacity-70">({statusCounts[t.key]})</span>}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-[minmax(180px,320px)_140px_170px] gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search order number..." className="input pl-9 text-sm" />
            </div>
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
          <EmptyState icon={<Package size={48} />} title="No orders found"
            description="Try another month, year, status, or order number." />
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([group, groupOrders]) => (
              <section key={group}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{group}</h2>
                  <span className="text-xs text-gray-400">{groupOrders.length} order{groupOrders.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                  {groupOrders.map((order, index) => {
                    const payment = order.payment;
                    const canVerifyTransfer = payment?.method === "promptpay" && ["pending", "processing"].includes(payment.status);
                    return (
                    <div key={order.id} className={`p-4 ${index > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}>
                      <div className="grid lg:grid-cols-[1.2fr_1.4fr_auto] gap-4 items-start">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <ReceiptText size={15} className="text-gray-400" />
                            <span className="font-mono font-semibold text-sm">#{order.order_number}</span>
                            <span className={`badge ${ORDER_STATUS_COLORS[order.status]}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                          </div>
                          <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                          <p className="text-sm font-bold text-primary-600 mt-2">{formatPrice(order.total_amount)}</p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="text-gray-400 mb-1 flex items-center gap-1"><User size={12} /> Customer</p>
                            <p className="font-medium truncate">{order.buyer?.full_name || order.shipping_address?.recipient_name || "-"}</p>
                            <p className="text-gray-500 truncate">{order.buyer?.email || "-"}</p>
                            <p className="text-gray-500 truncate">{order.shipping_address?.phone || order.buyer?.phone || "-"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-400 mb-1 flex items-center gap-1"><MapPin size={12} /> Delivery</p>
                            <p className="font-medium truncate">{order.shipping_address?.recipient_name || "-"}</p>
                            <p className="text-gray-500 line-clamp-2">{formatAddress(order)}</p>
                          </div>
                        </div>

                        <div className="flex lg:flex-col items-center lg:items-end gap-2">
                          {SELLER_TRANSITIONS[order.status]?.map(action => (
                            <button key={action.next}
                              onClick={() => openOrderModal(order, action.next)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${action.style}`}>
                              {action.label}
                            </button>
                          ))}
                          {canVerifyTransfer && (
                            <button onClick={() => verifyTransfer(order)} className="btn btn-primary btn-sm">
                              <CheckCircle size={13} /> Verify Transfer
                            </button>
                          )}
                          <button onClick={() => navigate(`/chat?order_id=${order.id}`)} className="btn btn-secondary btn-sm">
                            <MessageCircle size={13} /> Chat
                          </button>
                          <button onClick={() => printOrderInvoice(order, "seller")} className="btn btn-secondary btn-sm">
                            <Printer size={13} /> Print Invoice
                          </button>
                          <button onClick={() => openOrderModal(order)} className="btn btn-secondary btn-sm">
                            <Eye size={13} /> Details
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="flex -space-x-2 shrink-0">
                          {order.items?.slice(0, 3).map(item => (
                            <div key={item.id} className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900">
                              {item.product_image_url ? <img src={item.product_image_url} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="m-auto mt-2 text-gray-300" />}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {order.items?.[0]?.product_name || "Order items"}
                          {(order.items?.length || 0) > 1 ? ` +${(order.items?.length || 0) - 1} more` : ""}
                          {order.tracking_number ? ` ? Tracking ${order.tracking_number}` : ""}
                          {order.notes ? ` ? Note: ${order.notes}` : ""}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {selectedOrder && (
          <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)}
            title={`Order #${selectedOrder.order_number}`}>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Order Summary</p>
                    <p className="text-xs text-gray-500">Invoice No. {getInvoiceNumber(selectedOrder)}</p>
                    <p className="text-xs text-gray-500">Total: {formatPrice(selectedOrder.total_amount)}</p>
                    <p className="text-xs text-gray-500">Placed: {formatDate(selectedOrder.created_at)}</p>
                  </div>
                  <span className={`badge ${ORDER_STATUS_COLORS[selectedOrder.status]}`}>{ORDER_STATUS_LABELS[selectedOrder.status]}</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                  <p className="font-medium mb-2 flex items-center gap-1.5"><User size={14} /> Customer</p>
                  <p>{selectedOrder.buyer?.full_name || selectedOrder.shipping_address?.recipient_name || "-"}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{selectedOrder.buyer?.email || "-"}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{selectedOrder.shipping_address?.phone || selectedOrder.buyer?.phone || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                  <p className="font-medium mb-2 flex items-center gap-1.5"><MapPin size={14} /> Delivery</p>
                  <p>{selectedOrder.shipping_address?.recipient_name || "-"}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{formatAddress(selectedOrder)}</p>
                </div>
              </div>

              {selectedOrder.payment && (
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Payment Status</p>
                      <p className="text-xs text-gray-500">
                        {selectedOrder.payment.method.toUpperCase()} / {selectedOrder.payment.status}
                        {selectedOrder.payment.paid_at ? ` / Paid ${formatDate(selectedOrder.payment.paid_at)}` : ""}
                      </p>
                    </div>
                    {selectedOrder.payment.method === "promptpay" && ["pending", "processing"].includes(selectedOrder.payment.status) && (
                      <button onClick={() => verifyTransfer(selectedOrder)} className="btn btn-primary btn-sm">
                        <CheckCircle size={14} /> Verify Transfer
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                  <p className="text-sm font-medium mb-1">Customer Note</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Items</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {selectedOrder.items?.map(item => (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0">
                        {item.product_image_url ? <img src={item.product_image_url} alt="" className="w-full h-full object-cover" /> : <Package size={16} className="m-auto mt-3 text-gray-300" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">{item.sku || "No SKU"} {item.variant_name ? `? ${item.variant_name}` : ""}</p>
                      </div>
                      <p className="text-xs text-gray-500">x {item.quantity}</p>
                      <p className="font-medium">{formatPrice(item.total_price)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Order Status</label>
                <select value={statusInput} onChange={e => setStatusInput(e.target.value as OrderStatus)} className="input text-sm">
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {["processing", "shipped", "delivered"].includes(statusInput) && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tracking Number <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
                    placeholder="e.g. TH123456789" className="input text-sm" />
                </div>
              )}

              {statusInput === "cancelled" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Cancel Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                    rows={3} placeholder="Reason for cancelling this order" className="input text-sm resize-none" />
                </div>
              )}

              <div className="flex gap-2">
                <button disabled={updating}
                  onClick={() => updateStatus(selectedOrder.id, statusInput)}
                  className="btn btn-primary btn-sm flex-1">
                  {updating ? <Spinner className="w-4 h-4 mx-auto" /> : <><Save size={14} /> Save Changes</>}
                </button>
                <button type="button" onClick={() => printOrderInvoice(selectedOrder, "seller")} className="btn btn-secondary btn-sm">
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setSelectedOrder(null)} className="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

