import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import type { Product, PaginatedResponse, Order, Notification, Review } from "@/types";

// ── Products ─────────────────────────────────────────────

export function useProducts(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const res = await api.get("/products", { params });
      return res.data.data as PaginatedResponse<Product>;
    },
  });
}

export function useProduct(id?: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await api.get(`/products/${id}`);
      return res.data.data as Product;
    },
    enabled: !!id,
  });
}

export function useProductBySlug(slug?: string) {
  return useQuery({
    queryKey: ["product-slug", slug],
    queryFn: async () => {
      const res = await api.get(`/products/slug/${slug}`);
      return res.data.data as Product;
    },
    enabled: !!slug,
  });
}

export function useInfiniteProducts(params: Record<string, unknown> = {}) {
  return useInfiniteQuery({
    queryKey: ["infinite-products", params],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get("/products", { params: { ...params, page: pageParam } });
      return res.data.data as PaginatedResponse<Product>;
    },
    getNextPageParam: (last: PaginatedResponse<Product>) =>
      last.page < last.pages ? last.page + 1 : undefined,
    initialPageParam: 1,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/categories");
      return res.data.data;
    },
    staleTime: Infinity,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const res = await api.get("/brands");
      return res.data.data;
    },
    staleTime: Infinity,
  });
}

export function useReviews(productId?: string) {
  return useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const res = await api.get("/reviews", { params: { product_id: productId } });
      return res.data.data as Review[];
    },
    enabled: !!productId,
  });
}

// ── Orders ───────────────────────────────────────────────

export function useOrders(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: async () => {
      const res = await api.get("/orders", { params });
      return res.data.data as Order[];
    },
  });
}

export function useOrder(id?: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const res = await api.get(`/orders/${id}`);
      return res.data.data as Order;
    },
    enabled: !!id,
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      shipping_address_id: string;
      voucher_code?: string;
      notes?: string;
      payment_method?: string;
    }) => {
      const res = await api.post("/orders/checkout", data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

// ── Notifications ────────────────────────────────────────

export function useNotifications() {
  const { isAuthenticated, user } = useAuthStore();
  const canUseProtectedApi = isAuthenticated && user?.is_email_verified && user.status === "active";
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications");
      return res.data.data as Notification[];
    },
    enabled: canUseProtectedApi,
    refetchInterval: canUseProtectedApi ? 30000 : false,
  });
}

export function useUnreadCount() {
  const { isAuthenticated, user } = useAuthStore();
  const canUseProtectedApi = isAuthenticated && user?.is_email_verified && user.status === "active";
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count");
      return res.data.data.count as number;
    },
    enabled: canUseProtectedApi,
    refetchInterval: canUseProtectedApi ? 30000 : false,
  });
}

// ── Wishlist ─────────────────────────────────────────────

export function useWishlist() {
  return useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await api.get("/wishlist");
      return res.data.data;
    },
  });
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, inWishlist }: { productId: string; inWishlist: boolean }) => {
      if (inWishlist) {
        await api.delete(`/wishlist/${productId}`);
      } else {
        await api.post(`/wishlist/${productId}`);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
}

// ── Shop ─────────────────────────────────────────────────

export function useShop(id?: string) {
  return useQuery({
    queryKey: ["shop", id],
    queryFn: async () => {
      const res = await api.get(`/shops/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useMyShop() {
  return useQuery({
    queryKey: ["my-shop"],
    queryFn: async () => {
      const res = await api.get("/shops/my");
      return res.data.data;
    },
    retry: false,
  });
}

// ── Search ───────────────────────────────────────────────

export function useSearch(query: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["search", query, params],
    queryFn: async () => {
      const res = await api.get("/search", { params: { q: query, ...params } });
      return res.data.data;
    },
    enabled: query.length > 0,
  });
}
// ── Seller Analytics ─────────────────────────────────────

export function useSellerAnalytics(period = "30d") {
  return useQuery({
    queryKey: ["seller-analytics-overview", period],
    queryFn: async () => {
      const res = await api.get(`/shops/my/analytics/overview?period=${period}`);
      return res.data.data;
    },
    enabled: !!localStorage.getItem("access_token"),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSellerProductAnalytics() {
  return useQuery({
    queryKey: ["seller-product-analytics"],
    queryFn: async () => {
      const res = await api.get("/shops/my/analytics/products");
      return res.data.data;
    },
    enabled: !!localStorage.getItem("access_token"),
    staleTime: 1000 * 60 * 5,
  });
}

// ── Admin Analytics ──────────────────────────────────────

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await api.get("/admin/stats");
      return res.data.data;
    },
    refetchInterval: 60000,
    staleTime: 1000 * 30,
  });
}

export function useAdminRevenue(period = "30d") {
  return useQuery({
    queryKey: ["admin-revenue", period],
    queryFn: async () => {
      const res = await api.get(`/admin/analytics/revenue?period=${period}`);
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
