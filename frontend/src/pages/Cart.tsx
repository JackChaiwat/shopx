import { useState } from "react";
// Cart page
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { EmptyState } from "@/components/ui";
import { formatPrice } from "@/utils";

export default function Cart() {
  const { cart, updateItem, removeItem } = useCartStore();
  const [updatingItems, setUpdatingItems] = useState<Record<string, boolean>>({});
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const canUseProtectedApi = isAuthenticated && user?.is_email_verified && user.status === "active";

  if (!isAuthenticated) return (
    <div className="max-w-3xl mx-auto w-full px-4 py-16">
      <EmptyState
        icon={<ShoppingBag size={48} />}
        title="Your cart is empty"
        description="Login to view your cart"
        action={<Link to="/login" className="btn btn-primary">Login</Link>}
      />
    </div>
  );

  if (!canUseProtectedApi) return (
    <div className="max-w-3xl mx-auto w-full px-4 py-16">
      <EmptyState
        icon={<ShoppingBag size={48} />}
        title="Verify your email"
        description="Verify your email before viewing your cart"
        action={<Link to={`/verify-email?email=${encodeURIComponent(user?.email || "")}`} className="btn btn-primary">Verify Email</Link>}
      />
    </div>
  );

  const items = cart?.items ?? [];

  const runItemAction = async (itemId: string, action: () => Promise<void>) => {
    if (updatingItems[itemId]) return;
    setUpdatingItems((current) => ({ ...current, [itemId]: true }));
    try {
      await action();
    } finally {
      setUpdatingItems((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    }
  };


  return (
    <>
      <Helmet><title>Cart - ShopX</title></Helmet>
      <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <h1 className="text-2xl font-bold mb-6">Shopping Cart ({items.length} items)</h1>

        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={48} />}
            title="Your cart is empty"
            description="Discover millions of products waiting for you"
            action={<Link to="/" className="btn btn-primary">Start Shopping</Link>}
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="card p-4 flex items-start gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {item.product_image ? (
                      <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={24} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">{item.product_name}</p>
                    {item.variant_name && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.variant_name}</p>
                    )}
                    <p className="text-primary-600 font-bold mt-1">{formatPrice(item.unit_price)}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                        <button onClick={() => runItemAction(item.id, () => updateItem(item.id, item.quantity - 1))} disabled={!!updatingItems[item.id]} className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-l-lg disabled:opacity-40">
                          <Minus size={12} />
                        </button>
                        <span className="px-3 py-1 border-x border-gray-200 dark:border-gray-700">{item.quantity}</span>
                        <button onClick={() => runItemAction(item.id, () => updateItem(item.id, item.quantity + 1))} disabled={!!updatingItems[item.id] || item.quantity >= item.stock_quantity} className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-r-lg disabled:opacity-40">
                          <Plus size={12} />
                        </button>
                      </div>
                      <button onClick={() => runItemAction(item.id, () => removeItem(item.id))} disabled={!!updatingItems[item.id]} className="text-red-400 hover:text-red-600 p-1 disabled:opacity-40">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatPrice(item.subtotal)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="card p-5 h-fit sticky top-20">
              <h2 className="font-bold text-lg mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal ({items.length} items)</span>
                  <span className="font-medium">{formatPrice(cart?.total ?? "0")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span className="text-green-600 font-medium">Calculated at checkout</span>
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mb-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary-600">{formatPrice(cart?.total ?? "0")}</span>
                </div>
              </div>
              <button onClick={() => navigate("/checkout")} className="btn btn-primary w-full btn-lg">
                Proceed to Checkout
              </button>
              <Link to="/" className="btn btn-secondary w-full mt-2 btn-sm">
                Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
