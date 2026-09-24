"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "customer" | "bot" | "staff" | "system";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  status: "active" | "awaiting_human" | "in_progress" | "closed";
  handoff_reason: string | null;
  customer_label: string;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function authorLabel(role: ChatMessage["role"]): string {
  switch (role) {
    case "customer":
      return "Customer";
    case "bot":
      return "Zola (bot)";
    case "staff":
      return "Staff";
    case "system":
      return "System";
  }
}

function authorStyle(role: ChatMessage["role"]): string {
  switch (role) {
    case "customer":
      return "bg-zinc-100 text-zinc-800";
    case "bot":
      return "bg-emerald-50 text-emerald-900 border border-emerald-200";
    case "staff":
      return "bg-sky-50 text-sky-950 border border-sky-200";
    case "system":
      return "bg-amber-100 text-amber-900";
  }
}

export default function StaffChat({
  conversationId,
  initialConversation,
  initialMessages,
}: {
  conversationId: string;
  initialConversation: Conversation;
  initialMessages: ChatMessage[];
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/staff/api/conversations/${conversationId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    }
  }, [conversationId]);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, conversation]);

  async function sendReply() {
    const content = input.trim();
    if (!content || busy || conversation.status === "closed") return;
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/staff/api/conversations/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/staff/api/conversations/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve");
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = {
    active: "Active",
    awaiting_human: "Needs human",
    in_progress: "With staff",
    closed: "Closed",
  }[conversation.status];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h1 className="text-lg font-semibold text-zinc-50">Conversation</h1>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Customer</dt>
            <dd className="mt-0.5 font-medium text-zinc-200">
              {conversation.customer_label || "Guest"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd className="mt-0.5">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  conversation.status === "awaiting_human"
                    ? "bg-amber-200 text-amber-900"
                    : conversation.status === "closed"
                      ? "bg-zinc-300 text-zinc-600"
                      : "bg-emerald-200 text-emerald-900"
                }`}
              >
                {statusLabel}
              </span>
            </dd>
          </div>
          {conversation.handoff_reason && (
            <div>
              <dt className="text-zinc-500">Handoff reason</dt>
              <dd className="mt-0.5 text-zinc-300">{conversation.handoff_reason}</dd>
            </div>
          )}
        </dl>

        {conversation.status !== "closed" ? (
          <button
            className="mt-6 w-full rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
            onClick={() => void resolve()}
          >
            Resolve conversation
          </button>
        ) : (
          <p className="mt-6 rounded-xl bg-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-400">
            This conversation is closed.
          </p>
        )}
      </div>

      <div className="flex h-[36rem] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 lg:col-span-2">
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col">
              <div
                className={`rounded-xl px-3 py-2 text-sm ${authorStyle(msg.role)}`}
              >
                <span className="text-xs font-semibold opacity-80">{authorLabel(msg.role)}</span>
                <p className="mt-1 whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="mt-0.5 text-right text-[0.7rem] text-zinc-500">
                {formatTime(msg.created_at)}
              </span>
            </div>
          ))}
          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t border-zinc-700 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void sendReply();
          }}
        >
          <input
            className="h-11 w-full flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500 disabled:opacity-60"
            placeholder="Reply to the customer…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={conversation.status === "closed"}
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            disabled={busy || conversation.status === "closed" || input.trim().length === 0}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}