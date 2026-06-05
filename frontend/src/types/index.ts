// ── Auth ─────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "buyer" | "seller" | "admin" | "super_admin";
  status: "active" | "inactive" | "suspended" | "pending_verification";
  is_email_verified: boolean;
  wallet_balance?: string;
  created_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// ── Product ──────────────────────────────────────────────
export interface ProductImage {
  id: string;
  url: string;
  is_primary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  price: string;
  sale_price: string | null;
  stock_quantity: number;
  attributes: Record<string, string> | null;
  image_url: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description?: string;
  base_price: string;
  sale_price: string | null;
  stock_quantity: number;
  status: "draft" | "active" | "inactive" | "out_of_stock" | "deleted";
  rating: string;
  review_count: number;
  sold_count: number;
  primary_image: string | null;
  images: ProductImage[];
  variants?: ProductVariant[];
  shop_id: string;
  category_id: string | null;
  brand_id: string | null;
  tags: string[] | null;
  attributes?: Record<string, unknown>;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
}

// ── Shop ─────────────────────────────────────────────────
export interface Shop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: "pending" | "active" | "suspended" | "closed";
  rating: string;
  total_sales: number;
  follower_count: number;
  response_rate: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  verified_at: string | null;
  created_at: string;
}

// ── Cart ─────────────────────────────────────────────────
export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  shop_id: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
  stock_quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: string;
  item_count: number;
}

// ── Order ────────────────────────────────────────────────
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refund_requested"
  | "refunded";

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: string;
  total_price: string;
  product_image_url: string | null;
  review_id?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  invoice_number?: string | null;
  status: OrderStatus;
  subtotal: string;
  discount_amount: string;
  shipping_fee: string;
  tax_amount: string;
  total_amount: string;
  tracking_number: string | null;
  notes: string | null;
  shop_id: string;
  shipping_address_id?: string | null;
  shipping_address?: Address | null;
  buyer?: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  items?: OrderItem[];
  payment?: {
    id: string;
    method: string;
    status: string;
    amount: string;
    qr_code_url?: string | null;
    provider_payment_id?: string | null;
    paid_at?: string | null;
    expires_at?: string | null;
    is_expired?: boolean;
  };
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

// ── Review ───────────────────────────────────────────────
export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  image_urls: string[] | null;
  seller_reply: string | null;
  seller_replied_at: string | null;
  helpful_count: number;
  created_at: string;
}

// ── Notification ─────────────────────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  image_url: string | null;
  action_url: string | null;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ── Chat ─────────────────────────────────────────────────
export interface ChatRoom {
  id: string;
  shop_id: string;
  shop_name?: string | null;
  buyer_id?: string;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_unread_count: number;
  seller_unread_count: number;
  unread_count?: number;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Address ──────────────────────────────────────────────
export interface Address {
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
}

// ── Pagination ───────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}
