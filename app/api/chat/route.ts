import type { NextRequest } from "next/server";
import { generateBotReply } from "@/lib/ai";
import {
  addMessage,
  createConversation,
  getConversation,
  getMessages,
  setCustomerLabel,
  updateConversationStatus,
} from "@/lib/db";
import { loadKnowledgeBase } from "@/lib/knowledge-base";

export async function POST(request: NextRequest) {
  let body: { conversationId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim() ?? "";
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const conversationId = body.conversationId ?? null;
  let conversation = conversationId ? await getConversation(conversationId) : null;

  if (conversationId && !conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (!conversation) {
    const label = message.slice(0, 40);
    conversation = await createConversation(label);
    await setCustomerLabel(conversation.id, label);
  }

  if (conversation.status === "closed") {
    return Response.json({ error: "Conversation is closed" }, { status: 409 });
  }

  await addMessage(conversation.id, "customer", message);

  const kb = await loadKnowledgeBase();
  const messages = await getMessages(conversation.id);
  const history = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "customer" | "bot" | "staff", content: m.content }));

  let decision;
  try {
    decision = await generateBotReply(kb, history);
  } catch (error) {
    console.error("[chat] OpenAI call failed:", error);
    return Response.json(
      { error: "The assistant is temporarily unavailable. Please try again shortly." },
      { status: 502 },
    );
  }

  await addMessage(conversation.id, "bot", decision.reply);

  if (decision.needsHuman) {
    await updateConversationStatus(conversation.id, "awaiting_human", decision.handoffReason);
  }

  const updated = await getConversation(conversation.id);

  return Response.json({
    conversationId: conversation.id,
    status: updated?.status ?? conversation.status,
    handoffReason: decision.needsHuman ? decision.handoffReason : null,
    reply: decision.reply,
  });
}