import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { MessageCircle, Send, Image } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { EmptyState, Spinner } from "@/components/ui";
import { formatRelativeTime } from "@/utils";
import type { Message, ChatRoom } from "@/types";
import api from "@/services/api";
import toast from "react-hot-toast";

export default function Chat() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: async () => {
      const res = await api.get("/chat/rooms");
      return res.data.data as ChatRoom[];
    },
  });

  // Open a requested room from order/shop links.
  useEffect(() => {
    const roomId = searchParams.get("room_id");
    const orderId = searchParams.get("order_id");
    const shopId = searchParams.get("shop_id");
    if (roomId) {
      setActiveRoom(roomId);
      return;
    }
    if (!orderId && !shopId) return;
    (async () => {
      try {
        const res = orderId
          ? await api.post(`/chat/rooms/by-order/${orderId}`)
          : await api.post(`/chat/rooms/${shopId}`);
        setActiveRoom(res.data.data.id);
        qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      } catch {
        toast.error("Unable to open chat");
      }
    })();
  }, [searchParams, qc]);

  // Load messages when room changes
  useEffect(() => {
    if (!activeRoom) return;
    (async () => {
      const res = await api.get(`/chat/rooms/${activeRoom}/messages`);
      setMessages(res.data.data);
    })();
  }, [activeRoom]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket for real-time messages
  const { send } = useWebSocket(
    activeRoom ? `/chat/${activeRoom}` : "/notifications",
    {
      enabled: !!activeRoom,
      onMessage: (data) => {
        if (data.type === "new_message") {
          const msg = data.data as Message;
          setMessages((prev) => prev.some((item) => item.id === msg.id) ? prev : [...prev, msg]);
          qc.invalidateQueries({ queryKey: ["chat-rooms"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
        }
      },
    }
  );

  const sendMessage = async () => {
    if (!msgText.trim() || !activeRoom || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/chat/rooms/${activeRoom}/messages`, { content: msgText.trim() });
      const sent = res.data.data as Message;
      setMessages((prev) => prev.some((item) => item.id === sent.id) ? prev : [...prev, sent]);
      setMsgText("");
      qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
    } catch {
      toast.error("Failed to send message");
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <Helmet><title>Chat - ShopX</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold mb-4">Messages</h1>

        <div className="card overflow-hidden" style={{ height: "70vh" }}>
          <div className="flex h-full">
            {/* Sidebar - Room list */}
            <div className="w-64 border-r border-gray-100 dark:border-gray-800 flex flex-col">
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 font-medium text-sm">
                Conversations
              </div>
              <div className="flex-1 overflow-y-auto">
                {roomsLoading ? (
                  <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-primary-400" /></div>
                ) : !rooms?.length ? (
                  <div className="p-4 text-center text-sm text-gray-400">No conversations yet</div>
                ) : (
                  rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => setActiveRoom(room.id)}
                      className={`w-full p-3 flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-50 dark:border-gray-800/50 ${activeRoom === room.id ? "bg-primary-50 dark:bg-primary-900/20" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <MessageCircle size={16} className="text-primary-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{room.shop_name || room.buyer_name || `Shop ${room.shop_id.slice(0, 8)}`}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {room.last_message_at ? formatRelativeTime(room.last_message_at) : "No messages"}
                        </p>
                      </div>
                      {(room.unread_count || room.buyer_unread_count) > 0 && (
                        <span className="bg-primary-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                          {room.unread_count || room.buyer_unread_count}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col">
              {!activeRoom ? (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState
                    icon={<MessageCircle size={48} />}
                    title="Select a conversation"
                    description="Choose a conversation from the left to start chatting"
                  />
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-2xl text-sm ${
                            isOwn
                              ? "bg-primary-500 text-white rounded-br-sm"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
                          }`}>
                            {msg.image_url && (
                              <img src={msg.image_url} alt="" className="rounded-lg mb-1 max-w-full" />
                            )}
                            {msg.content && <p>{msg.content}</p>}
                            <p className={`text-[10px] mt-0.5 ${isOwn ? "text-primary-200" : "text-gray-400"}`}>
                              {formatRelativeTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex items-center gap-2">
                    <textarea
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Enter to send)"
                      rows={1}
                      className="input resize-none flex-1 py-2 text-sm"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!msgText.trim() || sending}
                      className="btn btn-primary p-2.5 rounded-xl disabled:opacity-40"
                    >
                      {sending ? <Spinner className="w-4 h-4" /> : <Send size={18} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
