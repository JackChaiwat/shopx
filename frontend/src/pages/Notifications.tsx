import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Bell, Check, MessageCircle, PackageCheck, WalletCards } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/useQueries";
import { EmptyState, Spinner } from "@/components/ui";
import { formatRelativeTime } from "@/utils";
import type { Notification } from "@/types";
import api from "@/services/api";
import toast from "react-hot-toast";

const TYPE_COLORS: Record<string, string> = {
  order: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  payment: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300",
  product: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
  review: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300",
  chat: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300",
  promotion: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
  system: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Orders", value: "order" },
  { label: "Payments", value: "payment" },
  { label: "Messages", value: "chat" },
];

type NotificationRow = Notification & {
  ids: string[];
  count: number;
  latestCreatedAt: string;
};

function typeIcon(type: string) {
  if (type === "order") return <PackageCheck size={16} />;
  if (type === "payment") return <WalletCards size={16} />;
  if (type === "chat") return <MessageCircle size={16} />;
  return <Bell size={16} />;
}

function getMetaString(n: Notification, key: string) {
  const value = n.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function groupNotifications(notifications: Notification[]): NotificationRow[] {
  const groups = new Map<string, NotificationRow>();
  const rows: NotificationRow[] = [];

  for (const n of notifications) {
    if (n.type !== "chat") {
      rows.push({ ...n, ids: [n.id], count: 1, latestCreatedAt: n.created_at });
      continue;
    }

    const roomId = getMetaString(n, "room_id") || n.action_url || n.id;
    const key = `chat:${roomId}`;
    const senderName = getMetaString(n, "sender_name") || n.title || "Message";
    const existing = groups.get(key);

    if (!existing) {
      const row: NotificationRow = {
        ...n,
        title: senderName,
        body: n.is_read ? "No unread messages" : "1 new message",
        action_url: n.action_url || (roomId ? `/chat?room_id=${roomId}` : "/chat"),
        ids: [n.id],
        count: n.is_read ? 0 : 1,
        latestCreatedAt: n.created_at,
      };
      groups.set(key, row);
      rows.push(row);
      continue;
    }

    existing.ids.push(n.id);
    if (!n.is_read) existing.count += 1;
    existing.is_read = existing.is_read && n.is_read;
    if (new Date(n.created_at).getTime() > new Date(existing.latestCreatedAt).getTime()) {
      existing.latestCreatedAt = n.created_at;
      existing.created_at = n.created_at;
      existing.body = n.body;
    }
    existing.body = existing.count > 0 ? `${existing.count} new message${existing.count > 1 ? "s" : ""}` : "No unread messages";
  }

  return rows.sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
}

export default function Notifications() {
  const { data: notifications = [], isLoading } = useNotifications();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");

  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);

  const markRead = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.post(`/notifications/${id}/read`)));
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
      toast.success("All notifications marked as read");
    } catch {}
  };

  const unread = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications = grouped.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter) return n.type === filter;
    return true;
  });

  const openNotification = async (n: NotificationRow) => {
    if (!n.is_read) await markRead(n.ids);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <>
      <Helmet><title>Notifications - ShopX</title></Helmet>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">Orders, payments, and message inbox updates.</p>
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="btn btn-secondary btn-sm flex items-center gap-1.5">
              <Check size={14} /> Mark all read
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${filter === item.value ? "bg-primary-500 text-white border-primary-500" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
        ) : !filteredNotifications.length ? (
          <EmptyState
            icon={<Bell size={48} />}
            title="No notifications"
            description="You're all caught up! We'll notify you of important updates here."
          />
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((n) => (
              <button
                key={n.type === "chat" ? `${n.type}-${getMetaString(n, "room_id") || n.id}` : n.id}
                onClick={() => openNotification(n)}
                className={`w-full card p-4 text-left flex items-start gap-3 hover:shadow-md transition-shadow ${!n.is_read ? "border-l-4 border-primary-500" : ""}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm ${TYPE_COLORS[n.type] || TYPE_COLORS.system}`}>
                  {typeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${!n.is_read ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}`}>
                      {n.title}
                    </p>
                    {n.type === "chat" && n.count > 0 && (
                      <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        {n.count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {n.type === "chat" ? (n.count > 0 ? `${n.count} new message${n.count > 1 ? "s" : ""}` : "No unread messages") : n.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-400">{formatRelativeTime(n.latestCreatedAt)}</p>
                    {n.action_url && <span className="text-xs text-primary-500 font-medium">Open</span>}
                  </div>
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
