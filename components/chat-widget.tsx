"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "customer" | "bot";
  content: string;
}

const STORAGE_KEY = "kopano_conversation_id";

function loadConversationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveConversationId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore storage failures
  }
}

function clearConversationId() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || busy) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "customer", content }]);
    setBusy(true);

    try {
      const storedId = loadConversationId();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: storedId,
          message: content,
        }),
      });
      const data = await res.json();

      // If the stored conversation no longer exists (e.g. DB was reset),
      // clear it and start a fresh conversation.
      if (res.status === 404 && storedId) {
        clearConversationId();
        const retry = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });
        const retryData = await retry.json();
        if (!retry.ok) {
          throw new Error(retryData.error ?? "Something went wrong");
        }
        saveConversationId(retryData.conversationId);
        setMessages((prev) => [...prev, { role: "bot", content: retryData.reply }]);
        if (retryData.handoffReason) {
          setHandedOff(true);
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              content: "A member of our team is being connected to help you personally.",
            },
          ]);
        }
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      saveConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: "bot", content: data.reply }]);
      if (data.handoffReason) {
        setHandedOff(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            content: "A member of our team is being connected to help you personally.",
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[26rem] w-80 flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2 bg-emerald-600 px-4 py-3 text-white">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" />
            <div>
              <p className="text-sm font-semibold leading-5">Kopano Microfinance Assistant</p>
              <p className="text-xs leading-4 opacity-80">Usually replies instantly</p>
            </div>
            <button
              aria-label="Close chat"
              className="ml-auto text-lg leading-none"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <div className="mb-2 max-w-[85%] rounded-lg bg-zinc-100 px-3 py-2 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                Hi! I&apos;m Zola. Ask me about our loans, rates, eligibility, or how to apply.
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "customer"
                    ? "mb-2 ml-auto max-w-[85%] rounded-lg bg-emerald-100 px-3 py-2 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100"
                    : "mb-2 mr-auto max-w-[85%] rounded-lg bg-zinc-100 px-3 py-2 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                }
              >
                {msg.content}
              </div>
            ))}
            {busy && (
              <div className="mb-2 mr-auto max-w-[85%] rounded-lg bg-zinc-100 px-3 py-2 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                Zola is typing…
              </div>
            )}
            {handedOff && (
              <div className="mx-auto mb-2 rounded-lg bg-amber-100 px-3 py-1.5 text-center text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                Handed over to a human agent
              </div>
            )}
            {error && (
              <div className="mx-auto mb-2 rounded-lg bg-red-100 px-3 py-1.5 text-center text-xs text-red-900 dark:bg-red-900 dark:text-red-100">
                {error}
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-zinc-200 px-2 py-2 dark:border-zinc-700"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <input
              className="h-9 w-full flex-1 rounded-full border border-zinc-300 bg-white px-3 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              aria-label="Send message"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-50"
              disabled={busy || input.trim().length === 0}
            >
              ➤
            </button>
          </form>
        </div>
      )}

      <button
        aria-label={open ? "Close chat" : "Open chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        onClick={() => setOpen(!open)}
      >
        <svg
          aria-hidden="true"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M4 5.5C4.6 4.8 5.4 4.2 6 4 6 5 5 6 4 6 3.5 6 3 7 2.5 8 2.5 9 3 9 3.5 10 4 10 5 11 6 11 7 12 8 13 8.5 14 9 15 9 16 9.5 17 10 18 10 19 10 20 9.5 21 9 22 8 22 7 21 6 20 6 19 5 19 5 18 5.5 17 6 16 6 15 5.5 14 5 13 4 12 4 11 4 10 4.5 9 5 8 5 7 4.5 6 4 5.5 3.5 5 3.5 4.5 4 4.5 4 5.5" />
          <path d="M5.5 20h13v0" />
          <circle cx="4.5" cy="7.5" r="1.2" />
          <circle cx="8" cy="7.5" r="1.2" />
          <path d="M3.5 16c1 1.5 2.5 2.5 4 3.5 5.5 4.5 7 5 8 6.5 9 7.5 10 8.5 11.5 9 13 10 14 11.5 15 12.5 16 13.5 17.5 14 19 15 20 16.5 21 17.5 22 18.5 23 19.5" />
        </svg>
      </button>
    </div>
  );
}
