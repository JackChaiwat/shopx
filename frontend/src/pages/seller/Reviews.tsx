import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, MessageSquare, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";
import { useMyShop } from "@/hooks/useQueries";
import { ConfirmDialog, Spinner, EmptyState, Pagination } from "@/components/ui";
import { formatRelativeTime } from "@/utils";
import api from "@/services/api";
import toast from "react-hot-toast";

type ConfirmState = {
  title: string;
  message?: string;
  confirmText?: string;
  variant?: "primary" | "danger";
  onConfirm: () => Promise<void> | void;
};

export default function SellerReviews() {
  const { data: shop } = useMyShop();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["seller-reviews", page],
    queryFn: async () => {
      const r = await api.get("/shops/my/analytics/reviews", { params: { page, limit: 15 } });
      return r.data.data;
    },
    enabled: !!shop,
  });

  const submitReply = async (reviewId: string, mode: "create" | "update" = "create") => {
    const reply = replyTexts[reviewId]?.trim();
    if (!reply) return;
    setSubmitting(true);
    try {
      if (mode === "update") await api.patch(`/reviews/${reviewId}/seller-reply`, { reply });
      else await api.post(`/reviews/${reviewId}/seller-reply`, { reply });
      toast.success(mode === "update" ? "Reply updated" : "Reply posted");
      qc.invalidateQueries({ queryKey: ["seller-reviews"] });
      setReplyingId(null);
      setEditingReplyId(null);
      setReplyTexts(prev => { const n = { ...prev }; delete n[reviewId]; return n; });
    } catch { toast.error("Failed to post reply"); }
    finally { setSubmitting(false); }
  };

  const startEditReply = (reviewId: string, currentReply: string) => {
    setEditingReplyId(reviewId);
    setReplyingId(null);
    setReplyTexts(prev => ({ ...prev, [reviewId]: currentReply }));
  };

  const deleteReply = (reviewId: string) => {
    setConfirmDialog({
      title: "Delete reply",
      message: "Delete your reply? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/reviews/${reviewId}/seller-reply`);
          toast.success("Reply deleted");
          qc.invalidateQueries({ queryKey: ["seller-reviews"] });
        } catch { toast.error("Failed to delete reply"); }
      },
    });
  };

  const setReviewStatus = (reviewId: string, status: "approved" | "rejected") => {
    setConfirmDialog({
      title: status === "rejected" ? "Hide review" : "Restore review",
      message: status === "rejected" ? "Hide this review from customers?" : "Restore this review?",
      confirmText: status === "rejected" ? "Hide" : "Restore",
      variant: status === "rejected" ? "danger" : "primary",
      onConfirm: async () => {
        try {
          await api.patch(`/reviews/${reviewId}/status`, { status });
          toast.success(status === "rejected" ? "Review hidden" : "Review restored");
          qc.invalidateQueries({ queryKey: ["seller-reviews"] });
        } catch { toast.error("Failed to update review"); }
      },
    });
  };

  const ratingDist = data?.rating_distribution || {};
  const totalReviews = Object.values(ratingDist).reduce((s: number, v: any) => s + v, 0);
  const avgRating = totalReviews > 0
    ? Object.entries(ratingDist).reduce((s, [k, v]) => s + Number(k) * Number(v), 0) / Number(totalReviews)
    : 0;

  return (
    <>
      <Helmet><title>Customer Reviews — Seller</title></Helmet>
      <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <h1 className="text-2xl font-bold mb-6">Customer Reviews</h1>

        {/* Rating summary */}
        {totalReviews > 0 && (
          <div className="card p-5 mb-6 flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <p className="text-5xl font-bold text-primary-600">{avgRating.toFixed(1)}</p>
              <div className="flex justify-center mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{totalReviews} reviews</p>
            </div>
            <div className="flex-1 min-w-48 space-y-1.5">
              {[5, 4, 3, 2, 1].map(r => {
                const count = ratingDist[String(r)] || 0;
                const pct = totalReviews > 0 ? (count / Number(totalReviews)) * 100 : 0;
                return (
                  <div key={r} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right">{r}</span>
                    <Star size={10} className="fill-yellow-400 text-yellow-400 shrink-0" />
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-gray-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-primary-500" /></div>
        ) : !data?.items?.length ? (
          <EmptyState icon={<Star size={48} />} title="No reviews yet"
            description="Customer reviews will appear here once you start receiving orders." />
        ) : (
          <div className="space-y-4">
            {data.items.map((r: any) => (
              <div key={r.id} className={`card p-5 ${!r.seller_reply ? "border-l-4 border-yellow-400" : ""} ${r.status === "rejected" ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13} className={i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{formatRelativeTime(r.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === "rejected" && (
                      <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                        Hidden
                      </span>
                    )}
                    {!r.seller_reply && r.status !== "rejected" && (
                      <span className="text-xs bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                        Awaiting reply
                      </span>
                    )}
                  </div>
                </div>

                {r.product_name && <p className="text-xs text-gray-400 mb-1">Product: {r.product_name}</p>}
                {r.title && <p className="font-medium text-sm mb-1">{r.title}</p>}
                <p className="text-sm text-gray-600 dark:text-gray-400">{r.content}</p>

                {r.image_urls?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {r.image_urls.map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover border" />
                    ))}
                  </div>
                )}

                {/* Existing reply */}
                {r.seller_reply && (
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare size={12} className="text-blue-500" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Your reply</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{r.seller_reply}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => startEditReply(r.id, r.seller_reply)}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                        <Pencil size={11} /> Edit reply
                      </button>
                      <button onClick={() => deleteReply(r.id)}
                        className="text-xs text-red-500 hover:underline flex items-center gap-1">
                        <Trash2 size={11} /> Delete reply
                      </button>
                    </div>
                  </div>
                )}

                {editingReplyId === r.id && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={replyTexts[r.id] || ""}
                      onChange={e => setReplyTexts(prev => ({ ...prev, [r.id]: e.target.value }))}
                      rows={3}
                      className="input resize-none text-sm w-full"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingReplyId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                      <button
                        disabled={!replyTexts[r.id]?.trim() || submitting}
                        onClick={() => submitReply(r.id, "update")}
                        className="btn btn-primary btn-sm">
                        {submitting ? <span className="animate-pulse">Saving...</span> : "Save Reply"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Reply form */}
                {!r.seller_reply && r.status !== "rejected" && (
                  <>
                    {replyingId === r.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyTexts[r.id] || ""}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Write a helpful reply to this customer..."
                          rows={3}
                          className="input resize-none text-sm w-full"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setReplyingId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                          <button
                            disabled={!replyTexts[r.id]?.trim() || submitting}
                            onClick={() => submitReply(r.id)}
                            className="btn btn-primary btn-sm">
                            {submitting ? <span className="animate-pulse">Posting...</span> : "Post Reply"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingId(r.id)}
                        className="mt-3 text-xs text-primary-600 hover:underline flex items-center gap-1">
                        <MessageSquare size={12} /> Reply to this review
                      </button>
                    )}
                  </>
                )}

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                  {r.status === "rejected" ? (
                    <button onClick={() => setReviewStatus(r.id, "approved")}
                      className="btn btn-secondary btn-sm">
                      <RotateCcw size={13} /> Restore Review
                    </button>
                  ) : (
                    <button onClick={() => setReviewStatus(r.id, "rejected")}
                      className="btn btn-secondary btn-sm text-red-500">
                      <EyeOff size={13} /> Hide Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Pagination page={page} pages={Math.ceil((data?.total || 0) / 15)} onChange={setPage} />
        </div>
        <ConfirmDialog
          open={!!confirmDialog}
          title={confirmDialog?.title || ""}
          message={confirmDialog?.message}
          confirmText={confirmDialog?.confirmText}
          variant={confirmDialog?.variant}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            const action = confirmDialog?.onConfirm;
            setConfirmDialog(null);
            void action?.();
          }}
        />
      </div>
    </>
  );
}
