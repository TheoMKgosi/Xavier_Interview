import OpenAI from "openai";
import type { KnowledgeBase } from "./knowledge-base";

export interface HistoryTurn {
  role: "customer" | "bot" | "staff";
  content: string;
}

export interface BotDecision {
  reply: string;
  needsHuman: boolean;
  handoffReason: string | null;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "needs_human", "handoff_reason"],
  properties: {
    reply: { type: "string" },
    needs_human: { type: "boolean" },
    handoff_reason: { type: "string" },
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

  return `You are Zola, the customer assistant for LendingKind, a micro-lender offering small, short-term loans.

You help customers with loan products, eligibility, interest rates, repayment, and the application process.

## Knowledge base
Answer questions using ONLY the documents below. If the answer is not in the documents, say you don't know and offer to connect them with a human.

${docBlock}

## Handover instructions
Follow these instructions to decide when the conversation must be handed over to a human staff member.

${handoverBlock}

## Rules
- Keep replies short, warm, and conversational. Never invent rates, terms, or policies.
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

  const input: { role: "user" | "assistant"; content: string }[] = history.map((turn) => ({
    role: turn.role === "customer" ? "user" : "assistant",
    content: turn.content,
  }));

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    instructions: buildSystemPrompt(kb),
    input,
    text: {
      format: {
        type: "json_schema",
        name: "bot_reply",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  let parsed: { reply?: unknown; needs_human?: unknown; handoff_reason?: unknown };
  try {
    parsed = JSON.parse(response.output_text) as typeof parsed;
  } catch {
    parsed = { reply: response.output_text, needs_human: false, handoff_reason: "" };
  }

  const reply = typeof parsed.reply === "string" ? parsed.reply : response.output_text;
  const needsHuman = parsed.needs_human === true;
  const handoffReason =
    typeof parsed.handoff_reason === "string" && parsed.handoff_reason.trim().length > 0
      ? parsed.handoff_reason
      : null;

  return { reply, needsHuman, handoffReason };
}