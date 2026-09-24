import OpenAI from "openai";
import type { KnowledgeBase } from "./knowledge-base";

export interface HistoryTurn {
  role: "customer" | "bot" | "staff";
  content: string;
}

export interface AccountRequest {
  last4: string;
  phone: string;
}

export interface BotDecision {
  reply: string;
  needsHuman: boolean;
  handoffReason: string | null;
  /** Set when the customer has supplied both credential parts. */
  accountRequest: AccountRequest | null;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "needs_human", "handoff_reason", "account_request"],
  properties: {
    reply: { type: "string" },
    needs_human: { type: "boolean" },
    handoff_reason: { type: "string" },
    account_request: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["last4", "phone"],
      properties: {
        last4: { type: "string" },
        phone: { type: "string" },
      },
    },
  },
} as const;

function buildSystemPrompt(kb: KnowledgeBase): string {
  const docBlock =
    kb.documents.length === 0
      ? "(no knowledge base documents loaded)"
      : kb.documents
          .map(
            (doc) =>
              `<document name="${doc.name}">\n${doc.content}\n</document>`,
          )
          .join("\n\n");

  const handoverBlock =
    kb.handoverInstructions
      ? `<handover_instructions>\n${kb.handoverInstructions}\n</handover_instructions>`
      : "(no explicit handover instructions provided; only hand over when the customer explicitly asks to speak with a human, is in distress, or requests something you cannot do)";

  return `You are Zola, the customer assistant for Kopano Microfinance, a licensed micro-lender operating in Botswana.

You help customers with loan products, eligibility, interest rates, repayment, payments, and their own accounts.

## Knowledge base
Answer questions using ONLY the documents below. If the answer is not in the documents, say you don't know and offer to connect them with a human.

${docBlock}

## Account details (outstanding balance, next payment, arrears, statements)
If a customer asks about THEIR OWN account figures, never invent amounts or balances. Account figures are fetched by the system directly from the database — you do not provide them.

The verification flow is handled by the system, not by you:
1. Ask the customer for the last 4 digits of their Omang/ID AND their registered phone number.
2. When the customer has provided BOTH the last 4 digits and a phone number in their message, set account_request to those exact values and reply briefly, e.g. confirming they will receive a one-time code. Leave account_request null if either part is missing.
3. The system will send the one-time code, verify it, and return their account figures. Do not attempt to answer with specific amounts.

If no matching account is found, the system will tell the customer to re-check their details.
If the customer refuses to verify, explain that account figures can only be shared with verified customers and offer to connect them to a human agent instead.

## Handover instructions
Follow these instructions to decide when the conversation must be handed over to a human staff member.

${handoverBlock}

## Rules
- Keep replies short, warm, and conversational. Never invent rates, terms, policies, or account figures.
- Set needs_human to true only when a handover instruction applies. Otherwise set it to false.
- When needs_human is true, tell the customer a support agent will take over shortly, and set handoff_reason to a short explanation for the staff member. Otherwise set handoff_reason to an empty string.`;
}

export async function generateBotReply(
  kb: KnowledgeBase,
  history: HistoryTurn[],
): Promise<BotDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey });

  const input = history.map((turn) => ({
    role: turn.role === "customer" ? "user" : "assistant",
    content: turn.content,
    type: "message",
  }));

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    instructions: buildSystemPrompt(kb),
    input: input as never,
    text: {
      format: {
        type: "json_schema",
        name: "bot_reply",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  const raw = response.output_text ?? "";

  let parsed: {
    reply?: unknown;
    needs_human?: unknown;
    handoff_reason?: unknown;
    account_request?: unknown;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    parsed = { reply: raw, needs_human: false, handoff_reason: "", account_request: null };
  }

  const reply = typeof parsed.reply === "string" ? parsed.reply : raw;
  const needsHuman = parsed.needs_human === true;
  const handoffReason =
    typeof parsed.handoff_reason === "string" && parsed.handoff_reason.trim().length > 0
      ? parsed.handoff_reason
      : null;

  let accountRequest: AccountRequest | null = null;
  if (
    parsed.account_request &&
    typeof parsed.account_request === "object" &&
    !Array.isArray(parsed.account_request)
  ) {
    const acc = parsed.account_request as Record<string, unknown>;
    const last4 = typeof acc.last4 === "string" ? acc.last4.trim() : "";
    const phone = typeof acc.phone === "string" ? acc.phone.trim() : "";
    if (last4.length > 0 && phone.length > 0) {
      accountRequest = { last4, phone };
    }
  }

  return { reply, needsHuman, handoffReason, accountRequest };
}