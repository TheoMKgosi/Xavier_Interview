import type { NextRequest } from "next/server";
import {
  buildAccountReply,
  buildCredentialPrompt,
  buildOtpPrompt,
  getAccountSummary,
  requestOtp,
  verifyOtp,
} from "@/lib/account";
import { generateBotReply } from "@/lib/ai";
import {
  addMessage,
  clearConversationOtp,
  createConversation,
  getConversation,
  getMessages,
  setCustomerLabel,
  updateConversationStatus,
} from "@/lib/db";
import type { Conversation } from "@/lib/db";
import { loadKnowledgeBase } from "@/lib/knowledge-base";

const ACCOUNT_INTENT_KEYWORDS = [
  "balance",
  "outstanding",
  "next payment",
  "instalment",
  "arrears",
  "owe",
  "owed",
  "due",
  "statement",
  "payoff",
  "settlement",
  "how much do i still owe",
];

const CODE_PATTERN = /^\s*\d{6}\s*$/;

function isAccountIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return ACCOUNT_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

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

  const respond = async (
    conversationNow: Conversation,
    reply: string,
    needsHuman = false,
    handoffReason: string | null = null,
  ) => {
    await addMessage(conversationNow.id, "bot", reply);
    if (needsHuman) {
      await updateConversationStatus(conversationNow.id, "awaiting_human", handoffReason);
    }
    const updated = await getConversation(conversationNow.id);
    return Response.json({
      conversationId: conversationNow.id,
      status: updated?.status ?? conversationNow.status,
      handoffReason: needsHuman ? handoffReason : null,
      reply,
    });
  };

  // ── State 1: awaiting the OTP. Scripted, no AI. ──────────────────────────────
  if (conversation.verify_step === "awaiting_otp") {
    // If the message is a 6-digit code, treat it as the OTP.
    if (CODE_PATTERN.test(message)) {
      const result = await verifyOtp(conversation, message);
      if (!result.ok) {
        return respond(conversation, result.message);
      }

      const verified = (await getConversation(conversation.id)) ?? conversation;
      const summary = await getAccountSummary(verified);
      return respond(verified, buildAccountReply(summary));
    }

    // Not a code. Could be a brand-new account question while a previous OTP
    // is still pending (e.g. the widget resumed a conversation and the user
    // restarted). Drop the pending OTP and ask for the credentials again —
    // exactly what the user expects instead of a six-digit code prompt.
    console.log(`[chat] Non-code message while awaiting OTP for conversation ${conversation.id}; clearing OTP state`);
    await clearConversationOtp(conversation.id);
    conversation = (await getConversation(conversation.id)) ?? conversation;
    if (isAccountIntent(message)) {
      return respond(conversation, buildCredentialPrompt());
    }
  }

  // ── State 2: already verified. Answer account questions from the DB. ─────────
  if (conversation.verify_step === "verified" && isAccountIntent(message)) {
    const summary = await getAccountSummary(conversation);
    return respond(conversation, buildAccountReply(summary));
  }

  // ── State 3: normal turn. AI asks for credentials; the rest is scripted. ─────
  const history = (await getMessages(conversation.id)).map((m) => ({
    role: m.role as "customer" | "bot" | "staff",
    content: m.content,
  }));

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

  // The AI confirmed the customer supplied both credentials → scripted OTP step.
  if (decision.accountRequest) {
    const result = await requestOtp(conversation, decision.accountRequest.last4, decision.accountRequest.phone);

    if (!result.ok) {
      return respond(conversation, result.message);
    }

    // Demo build: no SMS gateway, so log the OTP to the server console.
    console.log(`[chat] OTP for conversation ${conversation.id}: ${result.otp}`);

    const awaiting = (await getConversation(conversation.id)) ?? conversation;
    const phone = awaiting.verify_phone ?? decision.accountRequest.phone;
    return respond(awaiting, buildOtpPrompt(phone));
  }

  return respond(conversation, decision.reply, decision.needsHuman, decision.handoffReason);
}