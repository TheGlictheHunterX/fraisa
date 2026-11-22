"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getMessagesAction, sendMessageAction, type MessageView } from "@/lib/actions";

export default function ChatRoom({
  chatId,
  title,
  subtitle,
  expiresAt,
  backHref,
}: {
  chatId: string;
  title: string;
  subtitle: string;
  expiresAt: string;
  backHref: string;
}) {
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  const deadline = new Date(expiresAt).getTime();
  const remainingMs = Math.max(0, deadline - now);
  const hoursLeft = Math.floor(remainingMs / 3_600_000);
  const minutesLeft = Math.floor((remainingMs % 3_600_000) / 60_000);
  const expired = remainingMs === 0;

  const load = useCallback(async () => {
    const result = await getMessagesAction(chatId);
    if (result.ok) setMessages(result.messages);
    else setError(result.error ?? "Could not load messages");
  }, [chatId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.set("content", content);
    const result = await sendMessageAction(chatId, formData);
    if (!result.ok) {
      setError(result.error ?? "Could not send message");
    } else {
      setContent("");
      await load();
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={backHref} className="text-sm font-medium text-brand-600 hover:underline">← Back</Link>
      <div className="card mt-3 flex h-[70vh] flex-col p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h1 className="font-bold">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle} · updates every 3 seconds</p>
          <p className={`mt-1 text-xs font-medium ${expired ? "text-red-600" : "text-amber-600"}`}>
            {expired
              ? "This chat has expired and is being deleted from the database."
              : `Auto-deletes in ${hoursLeft}h ${minutesLeft}m (24h after the shift was accepted)`}
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400">No messages yet. Say hello 👋</p>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${message.mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {!message.mine && <p className="text-xs font-semibold opacity-70">{message.senderName}</p>}
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                <p className={`mt-1 text-[10px] ${message.mine ? "text-brand-100" : "text-slate-400"}`}>
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {error && <p className="px-5 pb-1 text-sm text-red-600">{error}</p>}
        <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-200 p-4">
          <input
            className="input"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a message…"
            maxLength={2000}
          />
          <button className="btn-primary" type="submit" disabled={loading || expired || !content.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
