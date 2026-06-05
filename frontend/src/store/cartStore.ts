import { create } from "zustand";
import api from "@/services/api";
import type { Cart, CartItem } from "@/types";
import toast from "react-hot-toast";

interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, variantId?: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  isLoading: false,

  fetchCart: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      set({ isLoading: true });
      const res = await api.get("/cart");
      set({ cart: res.data.data });
    } catch {
      // silent
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (productId, variantId, quantity = 1) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("Please login to add items to cart");
      return;
    }
    try {
      await api.post("/cart/items", {
        product_id: productId,
        variant_id: variantId || null,
        quantity,
      });
      toast.success("Added to cart");
      await get().fetchCart();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || "Failed to add to cart";
      toast.error(msg);
    }
  },

  updateItem: async (itemId, quantity) => {
    try {
      await api.patch(`/cart/items/${itemId}`, { quantity });
      await get().fetchCart();
    } catch (err: any) {
      const status = err?.response?.status;
      toast.error(status === 429 ? "Please wait a moment before updating the cart again" : "Failed to update cart");
    }
  },

  removeItem: async (itemId) => {
    try {
      await api.delete(`/cart/items/${itemId}`);
      await get().fetchCart();
    } catch {
      toast.error("Failed to remove item");
    }
  },

  clearCart: async () => {
    try {
      await api.delete("/cart");
      set({ cart: null });
    } catch {
      toast.error("Failed to clear cart");
    }
  },
}));
