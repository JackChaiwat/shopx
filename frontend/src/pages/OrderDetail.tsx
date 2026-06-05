import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Package, ChevronLeft, CheckCircle, Clock, QrCode,
  CreditCard, Wallet, RefreshCw, Copy, Check, Star, MapPin, Pencil, Save, X, Phone, User, ReceiptText, Printer, MessageCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrder } from "@/hooks/useQueries";
import { Spinner, EmptyState } from "@/components/ui";
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/utils";
import api from "@/services/api";
import toast from "react-hot-toast";
import type { Address } from "@/types";

// ── Status stepper ───────────────────────────────────────

function getInvoiceNumber(order: any) {
  if (order.invoice_number) return order.invoice_number;
  const created = new Date(order.created_at);
  const ym = Number.isNaN(created.getTime())
    ? ""
    : `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, "0")}`;
  return `INV-${ym}-${String(order.order_number || order.id).replace(/[^A-Za-z0-9]/g, "").slice(-8)}`;
}

function escapeInvoiceHtml(value: unknown) {
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
        <strong>${escapeInvoiceHtml(item.product_name)}</strong>
        <div class="muted">${escapeInvoiceHtml(item.sku || "No SKU")}${item.variant_name ? " - " + escapeInvoiceHtml(item.variant_name) : ""}</div>
      </td>
      <td class="right">${escapeInvoiceHtml(item.quantity)}</td>
      <td class="right">${escapeInvoiceHtml(formatPrice(item.unit_price))}</td>
      <td class="right">${escapeInvoiceHtml(formatPrice(item.total_price))}</td>
    </tr>
  `).join("");
  const win = window.open("", "_blank", "width=900,height=720");
  if (!win) return;
  win.document.write(`<!doctype html>
  <html>
    <head>
      <title>${escapeInvoiceHtml(getInvoiceNumber(order))}</title>
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
            <div class="muted">${escapeInvoiceHtml(getInvoiceNumber(order))}</div>
            <div class="muted">Order #${escapeInvoiceHtml(order.order_number)}</div>
            <div class="muted">${escapeInvoiceHtml(formatDate(order.created_at))}</div>
          </div>
        </div>
        <div class="grid">
          <div class="box">
            <h2>Customer</h2>
            <div>${escapeInvoiceHtml(order.buyer?.full_name || address?.recipient_name || "-")}</div>
            <div class="muted">${escapeInvoiceHtml(order.buyer?.email || "-")}</div>
            <div class="muted">${escapeInvoiceHtml(address?.phone || order.buyer?.phone || "-")}</div>
          </div>
          <div class="box">
            <h2>Ship to</h2>
            <div>${escapeInvoiceHtml(address?.recipient_name || "-")}</div>
            <div class="muted">${escapeInvoiceHtml(addressLine)}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div class="line"><span>Subtotal</span><span>${escapeInvoiceHtml(formatPrice(order.subtotal))}</span></div>
          <div class="line"><span>Shipping</span><span>${escapeInvoiceHtml(formatPrice(order.shipping_fee))}</span></div>
          <div class="line"><span>Tax</span><span>${escapeInvoiceHtml(formatPrice(order.tax_amount))}</span></div>
          <div class="line"><span>Discount</span><span>-${escapeInvoiceHtml(formatPrice(order.discount_amount))}</span></div>
          <div class="line total"><span>Total</span><span>${escapeInvoiceHtml(formatPrice(order.total_amount))}</span></div>
        </div>
        <div class="footer">
          Status: ${escapeInvoiceHtml(order.status)}${order.tracking_number ? " - Tracking: " + escapeInvoiceHtml(order.tracking_number) : ""}<br/>
          This document was generated automatically from the order record.
        </div>
      </div>
      <script>setTimeout(() => window.print(), 300)</script>
    </body>
  </html>`);
  win.document.close();
}

const STATUS_STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

function StatusStepper({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  const isCancelled = ["cancelled", "refunded", "refund_requested"].includes(status);
  return (
    <div className="flex items-start">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all ${
              isCancelled ? "border-gray-200 text-gray-300 bg-white" :
              i < currentIdx ? "bg-primary-500 border-primary-500 text-white" :
              i === currentIdx ? "bg-white border-primary-500 text-primary-600" :
              "bg-white border-gray-200 text-gray-300"
            }`}>
              {i < currentIdx && !isCancelled ? <CheckCircle size={15} /> : i + 1}
            </div>
            <span className="text-[10px] capitalize text-gray-500 mt-1 whitespace-nowrap">{step}</span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < currentIdx && !isCancelled ? "bg-primary-400" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── PromptPay QR Section ─────────────────────────────────
function PromptPaySection({
  qrUrl,
  amount,
  paymentStatus,
  onStatusCheck,
  expiresAt,
  onExpired,
}: {
  qrUrl: string;
  amount: string;
  paymentStatus: string;
  onStatusCheck: () => void;
  expiresAt?: string | null;
  onExpired: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [expiredNotified, setExpiredNotified] = useState(false);

  useEffect(() => {
    setQrFailed(false);
  }, [qrUrl]);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(null);
      return;
    }

    const updateRemaining = () => {
      const next = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0 && !expiredNotified) {
        setExpiredNotified(true);
        onExpired();
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, expiredNotified, onExpired]);

  const isExpired = remainingSeconds === 0 || paymentStatus === "cancelled";
  const countdownText = remainingSeconds === null
    ? null
    : `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  const checkPayment = async () => {
    setChecking(true);
    try {
      await onStatusCheck();
    } finally {
      setChecking(false);
    }
  };

  const copyAmount = () => {
    navigator.clipboard.writeText(parseFloat(amount).toFixed(2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (paymentStatus === "paid") {
    return (
      <div className="card p-5 mb-4 border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-green-700 dark:text-green-400">Payment Confirmed</p>
            <p className="text-sm text-green-600 dark:text-green-500">
              {formatPrice(amount)} received via PromptPay
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <QrCode size={20} className="text-primary-600" />
        <h2 className="font-bold">Scan to Pay with PromptPay</h2>
        <span className="ml-auto badge badge-warning flex items-center gap-1">
          <Clock size={11} /> {isExpired ? "Expired" : "Awaiting Payment"}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* QR Code */}
        <div className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-inner shrink-0">
          {qrFailed ? (
            <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center text-center text-sm text-red-500 px-4">
              QR code failed to load. Please refresh this order.
            </div>
          ) : (
            <img
              src={qrUrl}
              alt="PromptPay QR Code"
              className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
              onError={() => setQrFailed(true)}
            />
          )}
        </div>

        {/* Instructions */}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Amount to pay</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-primary-600">{formatPrice(amount)}</p>
              <button onClick={copyAmount} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" title="Copy amount">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            {countdownText && (
              <p className={`text-sm font-medium mt-2 ${isExpired ? "text-red-500" : "text-yellow-600"}`}>
                {isExpired ? "Payment time expired" : `Pay before ${countdownText}`}
              </p>
            )}
          </div>

          <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
              Open your banking app (K+ / SCB Easy / Krungthai NEXT / etc.)
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
              Tap <strong>Scan QR</strong> or <strong>PromptPay</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
              Scan this QR code and confirm the amount
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
              Tap below to confirm your payment
            </li>
          </ol>

          <button
            onClick={checkPayment}
            disabled={checking || isExpired}
            className="btn btn-primary w-full sm:w-auto"
          >
            {checking
              ? <><Spinner className="w-4 h-4" /> Checking...</>
              : <><RefreshCw size={15} /> {isExpired ? "Payment Expired" : "I've Paid — Confirm Payment"}</>
            }
          </button>

          <p className="text-xs text-gray-400">
            {isExpired
              ? "This order has been cancelled because payment was not completed in time."
              : "Payment auto-confirms within 1–2 minutes after transfer. If not, tap the button above."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Payment method icon ──────────────────────────────────
function PaymentMethodIcon({ method }: { method: string }) {
  if (method === "promptpay") return <QrCode size={15} className="text-green-600" />;
  if (method === "stripe") return <CreditCard size={15} className="text-blue-600" />;
  if (method === "wallet") return <Wallet size={15} className="text-purple-600" />;
  return null;
}

// ── Main OrderDetail ─────────────────────────────────────
export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, refetch } = useOrder(id);
  const qc = useQueryClient();
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => {
      const res = await api.get("/users/me/addresses");
      return res.data.data as Address[];
    },
    enabled: order?.status === "pending",
  });

  useEffect(() => {
    if (!order) return;
    setSelectedAddressId(order.shipping_address_id || "");
    setOrderNotes(order.notes || "");
  }, [order]);

  const handlePaymentStatusCheck = async () => {
    // Refetch order to get updated payment status
    await refetch();
    const updated = await api.get(`/orders/${id}`);
    const updatedPayment = updated.data.data?.payment;
    if (updatedPayment?.status === "paid") {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Payment confirmed! Your order is being processed");
    } else {
      toast("Payment not yet received. Please try again in a moment.", { icon: "⏳" });
    }
  };

  const openReview = (itemId: string) => {
    setReviewingItemId(itemId);
    setReviewRating(5);
    setReviewTitle("");
    setReviewContent("");
  };

  const submitReview = async (productId: string) => {
    if (!id) return;
    setSubmittingReview(true);
    try {
      await api.post("/reviews", {
        product_id: productId,
        order_id: id,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        content: reviewContent.trim() || undefined,
      });
      toast.success("Review submitted");
      setReviewingItemId(null);
      await refetch();
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const saveOrderDetails = async () => {
    if (!id) return;
    setSavingOrder(true);
    try {
      await api.patch(`/orders/${id}`, {
        shipping_address_id: selectedAddressId || undefined,
        notes: orderNotes,
      });
      toast.success("Order details updated");
      setEditingOrder(false);
      await refetch();
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to update order");
    } finally {
      setSavingOrder(false);
    }
  };

  const cancelOrder = async () => {
    if (!id || !window.confirm("Cancel this order? Stock will be returned if payment is not completed.")) return;
    try {
      await api.post(`/orders/${id}/cancel`, null, { params: { reason: "Cancelled by customer" } });
      toast.success("Order cancelled");
      await refetch();
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to cancel order");
    }
  };

  if (isLoading) return (
    <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
  );

  if (!order) return (
    <div className="max-w-3xl mx-auto w-full px-4 py-16">
      <EmptyState title="Order not found" description="This order doesn't exist or you don't have access." />
    </div>
  );

  const payment = order.payment;
  const isPromptPayPending = payment?.method === "promptpay" && payment?.status !== "paid" && !payment?.is_expired && payment?.qr_code_url;
  const isCancelled = ["cancelled", "refunded", "refund_requested"].includes(order.status);
  const canEditOrder = order.status === "pending";
  const shippingAddress = order.shipping_address;
  const addressLine = shippingAddress
    ? [shippingAddress.address_line1, shippingAddress.address_line2, shippingAddress.city, shippingAddress.state, shippingAddress.postal_code, shippingAddress.country]
      .filter(Boolean)
      .join(", ")
    : "No shipping address";
  const invoiceNumber = getInvoiceNumber(order);

  return (
    <>
      <Helmet><title>Order #{order.order_number} — ShopX</title></Helmet>
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        {/* Back */}
        <Link to="/orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-5 w-fit">
          <ChevronLeft size={16} /> Back to Orders
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">Order #{order.order_number}</h1>
            <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={() => printOrderInvoice(order, "customer")} className="btn btn-secondary btn-sm">
              <Printer size={13} /> Print Receipt
            </button>
            <span className={`badge text-sm px-3 py-1 ${ORDER_STATUS_COLORS[order.status]}`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
        </div>

        {/* PromptPay QR — shown when pending payment */}
        {isPromptPayPending && (
          <PromptPaySection
            qrUrl={payment.qr_code_url!}
            amount={payment.amount}
            paymentStatus={payment.status}
            onStatusCheck={handlePaymentStatusCheck}
            expiresAt={payment.expires_at}
            onExpired={() => {
              refetch();
              qc.invalidateQueries({ queryKey: ["orders"] });
            }}
          />
        )}

        {/* Status stepper */}
        {!isCancelled && (
          <div className="card p-5 mb-4">
            <StatusStepper status={order.status} />
            {order.tracking_number && (
              <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-sm">
                <span className="text-gray-500">Tracking:</span>
                <span className="font-mono font-medium">{order.tracking_number}</span>
              </div>
            )}
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="card p-4 mb-4 border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20">
            <p className="font-semibold text-red-700 dark:text-red-400 capitalize">{order.status.replace("_", " ")}</p>
            {order.notes && <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">{order.notes}</p>}
          </div>
        )}

        {/* Delivery details */}
        <div className="card p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-primary-600" />
              <h2 className="font-bold">Delivery Details</h2>
            </div>
            {canEditOrder && !editingOrder && (
              <button onClick={() => setEditingOrder(true)} className="btn btn-secondary btn-sm">
                <Pencil size={13} /> Edit
              </button>
            )}
          </div>

          {editingOrder ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Shipping Address</label>
                <select value={selectedAddressId} onChange={e => setSelectedAddressId(e.target.value)} className="input text-sm">
                  <option value="">Select an address</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label} - {addr.recipient_name}, {addr.address_line1}, {addr.city}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Order Notes</label>
                <textarea
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="input text-sm resize-none"
                  rows={3}
                  placeholder="Delivery notes or correction details"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingOrder(false)} className="btn btn-secondary btn-sm">
                  <X size={13} /> Cancel
                </button>
                <button type="button" onClick={saveOrderDetails} disabled={savingOrder || !selectedAddressId} className="btn btn-primary btn-sm">
                  {savingOrder ? <Spinner className="w-4 h-4" /> : <><Save size={13} /> Save Details</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <User size={15} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Recipient</p>
                    <p className="font-medium">{shippingAddress?.recipient_name || "-"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone size={15} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{shippingAddress?.phone || "-"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-gray-500">Address</p>
                  <p className="font-medium leading-relaxed">{addressLine}</p>
                </div>
                <div>
                  <p className="text-gray-500">Notes</p>
                  <p className="font-medium leading-relaxed">{order.notes || "-"}</p>
                </div>
              </div>
            </div>
          )}

          {canEditOrder && (
            <p className="text-xs text-gray-400 mt-3">
              You can edit delivery details while the order is pending.
            </p>
          )}
        </div>

        {/* Items */}
        <div className="card p-5 mb-4">
          <h2 className="font-bold mb-3">Items ({order.items?.length || 0})</h2>
          <div className="space-y-3">
            {order.items?.map((item) => (
              <div key={item.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-3 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border">
                    {item.product_image_url
                      ? <img src={item.product_image_url} alt="" className="w-full h-full object-cover" />
                      : <Package size={20} className="m-auto mt-3 text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.product_name}</p>
                    {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
                    {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">{formatPrice(item.unit_price)} x {item.quantity}</p>
                    {order.status === "delivered" && (
                      <div className="mt-2">
                        {item.review_id ? (
                          <span className="text-xs text-green-600 font-medium">Reviewed</span>
                        ) : (
                          <button onClick={() => openReview(item.id)} className="btn btn-secondary btn-sm">
                            <Star size={13} /> Write Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-primary-600 shrink-0">{formatPrice(item.total_price)}</p>
                </div>

                {reviewingItemId === item.id && (
                  <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Rating</p>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <button key={i} type="button" onClick={() => setReviewRating(i + 1)} className="p-0.5">
                            <Star size={20} className={i < reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      value={reviewTitle}
                      onChange={e => setReviewTitle(e.target.value)}
                      className="input text-sm"
                      placeholder="Review title"
                    />
                    <textarea
                      value={reviewContent}
                      onChange={e => setReviewContent(e.target.value)}
                      className="input text-sm resize-none"
                      rows={3}
                      placeholder="Share your experience with this product"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setReviewingItemId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                      <button onClick={() => submitReview(item.product_id)} disabled={submittingReview} className="btn btn-primary btn-sm">
                        {submittingReview ? <Spinner className="w-4 h-4" /> : "Submit Review"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Payment summary */}
        <div className="card p-5 mb-4">
          <h2 className="font-bold mb-3">Payment Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{formatPrice(order.shipping_fee)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax (7%)</span><span>{formatPrice(order.tax_amount)}</span></div>
            {parseFloat(order.discount_amount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100 dark:border-gray-800">
              <span>Total</span>
              <span className="text-primary-600">{formatPrice(order.total_amount)}</span>
            </div>
          </div>

          {/* Payment status */}
          {payment && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <PaymentMethodIcon method={payment.method} />
                <span className="text-sm capitalize font-medium">{payment.method}</span>
                <span className="text-gray-400">·</span>
                <span className={`text-sm font-semibold capitalize ${
                  payment.status === "paid" ? "text-green-600" :
                  ["failed", "cancelled"].includes(payment.status) ? "text-red-500" :
                  "text-yellow-600"
                }`}>
                  {payment.status}
                </span>
                {payment.paid_at && (
                  <span className="text-xs text-gray-400 ml-auto">{formatDate(payment.paid_at)}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {order.status === "pending" && !isPromptPayPending && (
          <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-500">Need to cancel this order?</p>
            <button
              onClick={async () => {
                try {
                  await api.post(`/orders/${order.id}/cancel`);
                  toast.success("Order cancelled");
                  refetch();
                } catch { toast.error("Cannot cancel at this stage"); }
              }}
              className="btn btn-danger btn-sm"
            >
              Cancel Order
            </button>
          </div>
        )}
      </div>
    </>
  );
}
