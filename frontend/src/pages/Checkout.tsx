import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { CreditCard, QrCode, Wallet, ChevronLeft, CheckCircle, Clock, Package, MapPin, LocateFixed } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCheckout } from "@/hooks/useQueries";
import { Input, Spinner, Modal } from "@/components/ui";
import MapPinPicker from "@/components/MapPinPicker";
import { formatPrice } from "@/utils";
import api from "@/services/api";
import toast from "react-hot-toast";

const ADDRESS_LABEL_HOME = "\u0e1a\u0e49\u0e32\u0e19";
const ADDRESS_LABEL_WORK = "\u0e17\u0e35\u0e48\u0e17\u0e33\u0e07\u0e32\u0e19";
const ADDRESS_LABEL_DORM = "\u0e2b\u0e2d";
const ADDRESS_LABEL_CONDO = "\u0e04\u0e2d\u0e19\u0e42\u0e14";
const ADDRESS_LABEL_OTHER = "\u0e2d\u0e37\u0e48\u0e19\u0e46";
const ADDRESS_LABEL_OPTIONS = [ADDRESS_LABEL_HOME, ADDRESS_LABEL_WORK, ADDRESS_LABEL_DORM, ADDRESS_LABEL_CONDO, ADDRESS_LABEL_OTHER];

const parseMapCoordinates = (value?: string | null) => {
  if (!value) return null;
  const text = decodeURIComponent(value);
  const match = text.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;
  return { lat: match[1], lng: match[2] };
};

const buildMapQuery = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(", ");

const TEXT_ADDRESS_TYPE = "\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48";
const TEXT_CUSTOM_ADDRESS_LABEL = "\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48";
const TEXT_CUSTOM_ADDRESS_PLACEHOLDER = "\u0e40\u0e0a\u0e48\u0e19 \u0e1a\u0e49\u0e32\u0e19\u0e41\u0e21\u0e48 / \u0e42\u0e01\u0e14\u0e31\u0e07 / \u0e23\u0e49\u0e32\u0e19";
const TEXT_MAP_ADDRESS_LABEL = "\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e25\u0e34\u0e07\u0e01\u0e4c Google Maps";
const TEXT_MAP_ADDRESS_PLACEHOLDER = "\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e16\u0e32\u0e19\u0e17\u0e35\u0e48 / \u0e27\u0e32\u0e07\u0e25\u0e34\u0e07\u0e01\u0e4c Google Maps / \u0e27\u0e32\u0e07\u0e1e\u0e34\u0e01\u0e31\u0e14";
const TEXT_USE_MAP_TEXT = "\u0e43\u0e0a\u0e49\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e19\u0e35\u0e49\u0e01\u0e31\u0e1a\u0e41\u0e1c\u0e19\u0e17\u0e35\u0e48";


interface CheckoutForm {
  map_query: string;
  address_label: string;
  address_label_other: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  save_as_default: boolean;
  payment_method: "stripe" | "promptpay" | "wallet";
}

interface ShippingEstimate {
  total_shipping_fee: string;
  shipments: Array<{ shop_id: string; shop_name: string; distance_km: string | null; shipping_fee: string; origin: string }>;
}

interface SavedAddress {

  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  latitude?: string | null;
  longitude?: string | null;
}

// ── QR Code payment modal ────────────────────────────────
function PromptPayModal({
  qrUrl,
  amount,
  orderId,
  orderNumber,
  onConfirmed,
}: {
  qrUrl: string;
  amount: string;
  orderId: string;
  orderNumber: string;
  onConfirmed: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 min

  // Countdown
  useState(() => {
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  });

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await api.get(`/payments?order_id=${orderId}`);
      const payments = res.data.data;
      const payment = Array.isArray(payments) ? payments[0] : payments;
      if (payment?.status === "paid") {
        toast.success("Payment confirmed!");
        onConfirmed();
      } else {
        toast("Payment not confirmed yet. Please scan and pay.", { icon: "⏳" });
      }
    } catch {
      toast.error("Could not check payment status");
    } finally {
      setChecking(false);
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <QrCode size={24} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Scan to Pay</h2>
          <p className="text-sm text-gray-500 mt-1">Order #{orderNumber}</p>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-2xl p-4 mb-4 border-2 border-gray-100 flex flex-col items-center">
          <img
            src={qrUrl}
            alt="PromptPay QR Code"
            className="w-52 h-52 object-contain"
          />
          <p className="text-2xl font-bold text-primary-600 mt-3">{formatPrice(amount)}</p>
          <p className="text-xs text-gray-400 mt-1">Scan with your banking app</p>
        </div>

        {/* Timer */}
        <div className={`flex items-center justify-center gap-2 text-sm mb-4 ${timeLeft < 120 ? "text-red-500" : "text-gray-500"}`}>
          <Clock size={14} />
          <span>Expires in {mins}:{secs.toString().padStart(2, "0")}</span>
        </div>

        {/* Supported banks */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-400 mb-2">Supported: SCB, KBank, Bangkok Bank, Krungthai, TMB, and all Thai banks</p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="btn btn-primary w-full"
          >
            {checking ? <Spinner className="w-4 h-4" /> : <><CheckCircle size={16} /> I've Paid — Check Status</>}
          </button>
          <Link
            to={`/orders/${orderId}`}
            className="btn btn-secondary w-full text-sm"
          >
            View Order Details
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center mt-3">
          Payment will auto-confirm via webhook. You can also check manually above.
        </p>
      </div>
    </div>
  );
}

// ── Stripe card form ─────────────────────────────────────
function StripeModal({
  orderId,
  orderNumber,
  amount,
  clientSecret,
  onConfirmed,
  onClose,
}: {
  orderId: string;
  orderNumber: string;
  amount: string;
  clientSecret: string;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={`Pay for Order #${orderNumber}`}>
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-primary-600">{formatPrice(amount)}</p>
          <p className="text-sm text-gray-500 mt-1">Order #{orderNumber}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">Stripe Integration</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            In production, embed the Stripe Payment Element here using the client secret:<br />
            <code className="bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded text-xs break-all">{clientSecret.slice(0, 30)}...</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <Link to={`/orders/${orderId}`} className="btn btn-primary flex-1">View Order</Link>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Checkout ────────────────────────────────────────
export default function Checkout() {
  const { cart, fetchCart } = useCartStore();
  const { mutateAsync: checkout, isPending } = useCheckout();
  const navigate = useNavigate();

  // Payment result state
  const [qrModal, setQrModal] = useState<{
    qrUrl: string; amount: string; orderId: string; orderNumber: string;
  } | null>(null);
  const [stripeModal, setStripeModal] = useState<{
    clientSecret: string; amount: string; orderId: string; orderNumber: string;
  } | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [shippingEstimate, setShippingEstimate] = useState<ShippingEstimate | null>(null);
  const [estimatingShipping, setEstimatingShipping] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CheckoutForm>({
    defaultValues: { payment_method: "promptpay", save_as_default: false, address_label: ADDRESS_LABEL_HOME },
  });

  const paymentMethod = watch("payment_method");
  const saveAsDefault = watch("save_as_default");
  const addressLabel = watch("address_label") || ADDRESS_LABEL_HOME;
  const items = cart?.items ?? [];
  const latitude = watch("latitude");
  const longitude = watch("longitude");
  const mapQuery = watch("map_query");
  const addressLine1 = watch("address_line1");
  const city = watch("city");
  const state = watch("state");
  const postalCode = watch("postal_code");
  const subtotal = parseFloat(cart?.total ?? "0");
  const shippingFee = parseFloat(shippingEstimate?.total_shipping_fee ?? "0");
  const tax = subtotal * 0.07;
  const estimatedTotal = subtotal + shippingFee + tax;

  useEffect(() => {
    let alive = true;
    api
      .get("/users/me/addresses")
      .then((res) => {
        const list = Array.isArray(res.data.data) ? res.data.data : [];
        if (!alive) return;
        setAddresses(list);
        const defaultAddress = list.find((addr: SavedAddress) => addr.is_default) || list[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          setShowAddressForm(false);
        } else {
          setShowAddressForm(true);
        }
      })
      .catch(() => setShowAddressForm(true))
      .finally(() => alive && setLoadingAddresses(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedAddressId) {
      setShippingEstimate(null);
      return;
    }
    let alive = true;
    setEstimatingShipping(true);
    api
      .get("/orders/shipping-estimate", { params: { shipping_address_id: selectedAddressId } })
      .then((res) => {
        if (alive) setShippingEstimate(res.data.data);
      })
      .catch(() => {
        if (alive) setShippingEstimate(null);
      })
      .finally(() => {
        if (alive) setEstimatingShipping(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedAddressId]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("This browser does not support location access");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue("latitude", position.coords.latitude.toFixed(7), { shouldDirty: true });
        setValue("longitude", position.coords.longitude.toFixed(7), { shouldDirty: true });
        toast.success("Location added to shipping address");
      },
      () => toast.error("Could not get your location. Please allow location access or enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const useMapTextForPin = () => {
    const text = mapQuery || buildMapQuery(addressLine1, city, state, postalCode, "Thailand");
    const coords = parseMapCoordinates(text);
    if (coords) {
      setValue("latitude", coords.lat, { shouldDirty: true });
      setValue("longitude", coords.lng, { shouldDirty: true });
      toast.success("Map pin added from Google Maps text");
      return;
    }
    toast("Paste a Google Maps link or coordinates first.", { id: "map-pin-hint" });
  };

  const onSubmit = async (data: CheckoutForm) => {
    try {
      // 1. Use saved address or create a new one
      let addressId = selectedAddressId;
      if (showAddressForm || !addressId) {
        const addrRes = await api.post("/users/me/addresses", {
          label: data.address_label === ADDRESS_LABEL_OTHER ? (data.address_label_other?.trim() || ADDRESS_LABEL_OTHER) : (data.address_label || ADDRESS_LABEL_HOME),
          recipient_name: data.recipient_name,
          phone: data.phone,
          address_line1: data.address_line1,
          address_line2: data.address_line2 || null,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          country: "TH",
          latitude: data.latitude ? Number(data.latitude) : null,
          longitude: data.longitude ? Number(data.longitude) : null,
          is_default: saveAsDefault || addresses.length === 0,
        });
        addressId = addrRes.data.data.id;
      }

      if (!addressId) {
        throw new Error("Please select or add a shipping address");
      }

      // 2. Create order(s)
      const orderResult = await checkout({ shipping_address_id: addressId });
      const firstOrder = orderResult.orders?.[0];
      if (!firstOrder) throw new Error("No order created");

      await fetchCart();

      // 3. Create payment
      const payRes = await api.post("/payments", {
        order_id: firstOrder.id,
        method: data.payment_method,
      });
      const payment = payRes.data.data;

      // 4. Handle payment method
      if (data.payment_method === "promptpay" && payment.qr_code_url) {
        setQrModal({
          qrUrl: payment.qr_code_url,
          amount: payment.amount,
          orderId: firstOrder.id,
          orderNumber: firstOrder.order_number,
        });
        return;
      }

      if (data.payment_method === "stripe" && payment.provider_payment_id) {
        setStripeModal({
          clientSecret: payment.provider_payment_id,
          amount: payment.amount,
          orderId: firstOrder.id,
          orderNumber: firstOrder.order_number,
        });
        return;
      }

      // Wallet or already paid
      toast.success("Order placed successfully!");
      navigate(`/orders/${firstOrder.id}`);

    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Checkout failed");
    }
  };

  return (
    <>
      <Helmet><title>Checkout - ShopX</title></Helmet>

      {/* QR Modal */}
      {qrModal && (
        <PromptPayModal
          {...qrModal}
          onConfirmed={() => {
            setQrModal(null);
            navigate(`/orders/${qrModal.orderId}`);
          }}
        />
      )}

      {/* Stripe Modal */}
      {stripeModal && (
        <StripeModal
          {...stripeModal}
          onConfirmed={() => { setStripeModal(null); navigate(`/orders/${stripeModal.orderId}`); }}
          onClose={() => setStripeModal(null)}
        />
      )}

      <div className="max-w-5xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <Link to="/cart" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-5">
          <ChevronLeft size={16} /> Back to Cart
        </Link>
        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">

              {/* Shipping */}
              <div className="card p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 font-bold"><Package size={18} /> Shipping Address</h2>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm whitespace-nowrap"
                      onClick={() => {
                        setShowAddressForm((value) => !value);
                        if (!showAddressForm) setSelectedAddressId("");
                      }}
                    >
                      {showAddressForm ? "Use saved address" : "Add new address"}
                    </button>
                  )}
                </div>

                {loadingAddresses ? (
                  <div className="flex min-h-24 items-center justify-center">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : (
                  <>
                    {addresses.length > 0 && !showAddressForm && (
                      <div className="space-y-3">
                        {addresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`block cursor-pointer rounded-lg border p-4 transition-colors ${selectedAddressId === addr.id ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-200 hover:border-primary-300 dark:border-gray-700"}`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="shipping_address"
                                className="mt-1"
                                checked={selectedAddressId === addr.id}
                                onChange={() => setSelectedAddressId(addr.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">{addr.recipient_name}</span>
                                  <span className="text-sm text-gray-500">{addr.phone}</span>
                                  {addr.is_default && <span className="badge badge-success">Default</span>}
                                  <span className="badge badge-info">{addr.label}</span>
                                </div>
                                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                  {[addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join(", ")}
                                </p>
                                {addr.latitude && addr.longitude && (
                                  <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline" href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`} target="_blank" rel="noreferrer">
                                    <MapPin size={13} /> View pin in Google Maps
                                  </a>
                                )}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {(showAddressForm || addresses.length === 0) && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{TEXT_ADDRESS_TYPE} *</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {ADDRESS_LABEL_OPTIONS.map((option) => (
                              <label
                                key={option}
                                className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${addressLabel === option ? "border-primary-500 bg-primary-500 text-white" : "border-gray-300 bg-gray-50 text-gray-700 hover:border-primary-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"}`}
                              >
                                <input type="radio" value={option} {...register("address_label", { required: true })} className="sr-only" />
                                {option}
                              </label>
                            ))}
                          </div>
                          {addressLabel === ADDRESS_LABEL_OTHER && (
                            <div className="mt-3">
                              <Input label="à¸Šà¸·à¹ˆà¸­à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ" placeholder="à¹€à¸Šà¹ˆà¸™ à¸šà¹‰à¸²à¸™à¹à¸¡à¹ˆ / à¹‚à¸à¸”à¸±à¸‡ / à¸£à¹‰à¸²à¸™" {...register("address_label_other", { required: addressLabel === ADDRESS_LABEL_OTHER })} />
                            </div>
                          )}
                        </div>
                        <Input label="Full Name *"
                          {...register("recipient_name", { required: showAddressForm || addresses.length === 0 ? "Required" : false })}
                          error={errors.recipient_name?.message} />
                        <Input label="Phone *"
                          {...register("phone", { required: showAddressForm || addresses.length === 0 ? "Required" : false })}
                          error={errors.phone?.message}
                          placeholder="+66..." />
                        <div className="sm:col-span-2">
                          <Input label="Address *"
                            {...register("address_line1", { required: showAddressForm || addresses.length === 0 ? "Required" : false })}
                            error={errors.address_line1?.message}
                            placeholder="House no., Street, Soi..." />
                        </div>
                        <div className="sm:col-span-2">
                          <Input label="Address line 2"
                            {...register("address_line2")}
                            placeholder="Building, floor, room, landmark (optional)" />
                        </div>
                        <Input label="City / District *"
                          {...register("city", { required: showAddressForm || addresses.length === 0 ? "Required" : false })}
                          error={errors.city?.message} />
                        <Input label="Province *"
                          {...register("state", { required: showAddressForm || addresses.length === 0 ? "Required" : false })}
                          error={errors.state?.message} />
                        <Input label="Postal Code *"
                          {...register("postal_code", { required: showAddressForm || addresses.length === 0 ? "Required" : false })}
                          error={errors.postal_code?.message} />
                        <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-2">
                              <MapPin size={18} className="mt-0.5 shrink-0 text-primary-500" />
                              <div>
                                <p className="font-semibold">Google Maps delivery pin</p>
                                <p className="text-xs text-gray-500">Drag the map until the pin is on the delivery point, or use current location. This pin is used to calculate shipping.</p>
                              </div>
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm whitespace-nowrap" onClick={useCurrentLocation}>
                              Current location
                            </button>
                          </div>
                          <div className="mb-3">
                            <Input label={TEXT_MAP_ADDRESS_LABEL} {...register("map_query")} placeholder={TEXT_MAP_ADDRESS_PLACEHOLDER} />
                            <div className="mt-3">
                              <MapPinPicker
                                latitude={latitude}
                                longitude={longitude}
                                onChange={(lat, lng) => {
                                  setValue("latitude", lat, { shouldDirty: true });
                                  setValue("longitude", lng, { shouldDirty: true });
                                }}
                              />
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={useMapTextForPin}>
                              <MapPin size={15} /> Use coordinates from link
                      </button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input label="Latitude" type="number" step="any" {...register("latitude")} placeholder="13.7563000" readOnly />
                            <Input label="Longitude" type="number" step="any" {...register("longitude")} placeholder="100.5018000" readOnly />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 sm:col-span-2">
                          <input type="checkbox" {...register("save_as_default")} />
                          Save this as my default shipping address
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Payment method */}
              <div className="card p-5">
                <h2 className="font-bold mb-4 flex items-center gap-2"><CreditCard size={18} /> Payment Method</h2>
                <div className="space-y-3">
                  {[
                    {
                      value: "promptpay",
                      label: "PromptPay QR Code",
                      icon: <QrCode size={22} />,
                      desc: "Scan with any Thai banking app — instant confirmation",
                      badge: "Recommended",
                      badgeColor: "bg-green-100 text-green-700",
                    },
                    {
                      value: "stripe",
                      label: "Credit / Debit Card",
                      icon: <CreditCard size={22} />,
                      desc: "Visa, Mastercard, JCB — secured by Stripe",
                      badge: null,
                      badgeColor: "",
                    },
                    {
                      value: "wallet",
                      label: "ShopX Wallet",
                      icon: <Wallet size={22} />,
                      desc: "Use your wallet balance — instant",
                      badge: null,
                      badgeColor: "",
                    },
                  ].map((pm) => (
                    <label
                      key={pm.value}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        paymentMethod === pm.value
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <input type="radio" value={pm.value} {...register("payment_method")} className="sr-only" />
                      <div className={`mt-0.5 ${paymentMethod === pm.value ? "text-primary-600" : "text-gray-400"}`}>
                        {pm.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{pm.label}</p>
                          {pm.badge && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${pm.badgeColor}`}>
                              {pm.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{pm.desc}</p>
                      </div>
                      {paymentMethod === pm.value && (
                        <CheckCircle size={18} className="text-primary-500 mt-0.5 shrink-0" />
                      )}
                    </label>
                  ))}
                </div>

                {/* PromptPay info box */}
                {paymentMethod === "promptpay" && (
                  <div className="mt-3 bg-green-50 dark:bg-green-900/20 rounded-xl p-3 flex items-start gap-2">
                    <QrCode size={16} className="text-green-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-green-700 dark:text-green-400">
                      A QR code will appear after you place your order. Open your banking app → PromptPay → Scan QR to pay.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order summary */}
            <div className="card p-5 h-fit sticky top-20">
              <h2 className="font-bold mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {item.product_image
                        ? <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-gray-100" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-1">{item.product_name}</p>
                      {item.variant_name && <p className="text-xs text-gray-400">{item.variant_name}</p>}
                      <p className="text-xs text-gray-500">× {item.quantity}</p>
                    </div>
                    <span className="text-xs font-medium shrink-0">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mb-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{formatPrice(cart?.total ?? "0")}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span className="text-primary-600">{estimatingShipping ? "Calculating..." : selectedAddressId ? formatPrice(shippingFee.toFixed(2)) : "Select address"}</span>
                </div>
                {shippingEstimate?.shipments?.length ? (
                  <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-900/50">
                    {shippingEstimate.shipments.map((shipment) => (
                      <div key={shipment.shop_id} className="flex justify-between gap-2">
                        <span className="truncate">{shipment.shop_name}{shipment.distance_km ? ` - ${shipment.distance_km} km` : ""}</span>
                        <span className="font-medium">{formatPrice(shipment.shipping_fee)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex justify-between text-gray-500">
                  <span>Tax (7%)</span>
                  <span>{formatPrice(tax.toFixed(2))}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-gray-100 dark:border-gray-800 pt-2">
                  <span>Total</span>
                  <span className="text-primary-600">
                    {formatPrice(estimatedTotal.toFixed(2))}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || items.length === 0}
                className="btn btn-primary w-full btn-lg"
              >
                {isPending
                  ? <Spinner className="w-5 h-5" />
                  : paymentMethod === "promptpay"
                    ? <><QrCode size={18} /> Place Order & Get QR</>
                    : "Place Order"
                }
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                By placing your order, you agree to ShopX's Terms of Service
              </p>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
