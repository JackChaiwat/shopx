import React from "react";
import { cn } from "@/utils";
import { ChevronLeft, ChevronRight, Loader2, Star, X } from "lucide-react";

// ── Spinner ──────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />;
}

// ── Skeleton ─────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card p-0 overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  );
}

// ── Rating Stars ─────────────────────────────────────────
export function StarRating({
  rating,
  max = 5,
  size = 16,
}: {
  rating: number;
  max?: number;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={cn(
            i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          )}
        />
      ))}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-gray-300 dark:text-gray-600 mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────
export function Badge({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info";
}) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// ── Modal ────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative card w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 animate-slide-up sm:p-6">
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="min-w-0 pr-3 text-base font-semibold sm:text-lg">{title}</h2>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {message && <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm">
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={variant === "danger" ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }
>(({ label, error, className, ...props }, ref) => (
  <div className="w-full">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    <input
      ref={ref}
      className={cn("input", error && "border-red-500 focus:ring-red-500", className)}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
));
Input.displayName = "Input";

// ── Select ────────────────────────────────────────────────
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }
>(({ label, error, className, children, ...props }, ref) => (
  <div className="w-full">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    <select
      ref={ref}
      className={cn("input", error && "border-red-500", className)}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
));
Select.displayName = "Select";

// ── Textarea ──────────────────────────────────────────────
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }
>(({ label, error, className, ...props }, ref) => (
  <div className="w-full">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    <textarea
      ref={ref}
      rows={4}
      className={cn("input resize-none", error && "border-red-500", className)}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
));
Textarea.displayName = "Textarea";

// ── Pagination ────────────────────────────────────────────
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="btn btn-secondary btn-sm"
      >
        ←
      </button>
      {Array.from({ length: Math.min(pages, 7) }).map((_, i) => {
        const p = i + 1;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "btn btn-sm",
              p === page ? "btn-primary" : "btn-secondary"
            )}
          >
            {p}
          </button>
        );
      })}
      {pages > 7 && <span className="px-2">…</span>}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className="btn btn-secondary btn-sm"
      >
        →
      </button>
    </div>
  );
}
