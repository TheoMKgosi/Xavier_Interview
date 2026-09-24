"use client";

import { useCallback, useEffect, useState } from "react";

interface Conversation {
  id: string;
  status: "active" | "awaiting_human" | "in_progress" | "closed";
  handoff_reason: string | null;
  customer_label: string;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<Conversation["status"], string> = {
  active: "bg-zinc-200 text-zinc-700",
  awaiting_human: "bg-amber-200 text-amber-900",
  in_progress: "bg-emerald-200 text-emerald-900",
  closed: "bg-zinc-300 text-zinc-600",
};

const STATUS_LABELS: Record<Conversation["status"], string> = {
  active: "Active",
  awaiting_human: "Needs human",
  in_progress: "With staff",
  closed: "Closed",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConversationsList({ initial }: { initial: Conversation[] }) {
  const [conversations, setConversations] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/staff/api/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      setConversations(data.conversations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const open = conversations.filter((c) => c.status !== "closed");
  const closed = conversations.filter((c) => c.status === "closed");

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Ongoing conversations</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {open.length} open · {conversations.filter((c) => c.status === "awaiting_human").length} waiting for a human
          </p>
        </div>
        <button
          className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {conversations.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-zinc-300">No conversations yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            When customers chat with Zola on the site, their conversations appear here.
          </p>
        </div>
      )}

      <table className="mt-8 w-full text-left">
        <thead>
          <tr className="border-b border-zinc-800 text-sm text-zinc-400">
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Last activity</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Handoff reason</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {open.map((c) => (
            <tr key={c.id} className="border-b border-zinc-800 hover:bg-zinc-900">
              <td className="px-3 py-3 font-medium text-zinc-200">{c.customer_label || "Guest"}</td>
              <td className="px-3 py-3 text-sm text-zinc-400">{formatDate(c.updated_at)}</td>
              <td className="px-3 py-3">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </td>
              <td className="max-w-56 truncate px-3 py-3 text-sm text-zinc-500">
                {c.handoff_reason || "—"}
              </td>
              <td className="px-3 py-3">
                <a
                  href={`/staff/conversations/${c.id}`}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {closed.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold text-zinc-300">Recently closed</h2>
          <table className="mt-4 w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-sm text-zinc-400">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Closed</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {closed.slice(0, 5).map((c) => (
                <tr key={c.id} className="border-b border-zinc-800">
                  <td className="px-3 py-3 font-medium text-zinc-200">{c.customer_label || "Guest"}</td>
                  <td className="px-3 py-3 text-sm text-zinc-400">{formatDate(c.updated_at)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={`/staff/conversations/${c.id}`}
                      className="text-sm font-medium text-zinc-400 underline-offset-2 hover:underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}