import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { STAFF_COOKIE_NAME, verifyStaffToken } from "@/lib/auth";
import {
  addMessage,
  getConversation,
  getMessages,
  updateConversationStatus,
} from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!verifyStaffToken(cookieStore.get(STAFF_COOKIE_NAME)?.value)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await getMessages(id);
  return Response.json({ conversation, messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!verifyStaffToken(cookieStore.get(STAFF_COOKIE_NAME)?.value)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  let body: { action?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "reply") {
    const content = body.content?.trim() ?? "";
    if (!content) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }
    if (conversation.status === "closed") {
      return Response.json({ error: "Conversation is closed" }, { status: 409 });
    }
    await addMessage(id, "staff", content);
    if (conversation.status === "awaiting_human") {
      await updateConversationStatus(id, "in_progress");
    }
  } else if (body.action === "resolve") {
    await updateConversationStatus(id, "closed");
  } else {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await getConversation(id);
  const messages = await getMessages(id);
  return Response.json({ conversation: updated, messages });
}