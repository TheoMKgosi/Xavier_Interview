import StaffChat from "@/components/staff/staff-chat";
import { getConversation, getMessages } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function StaffConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const messages = await getMessages(id);

  const initialConversation = {
    id: conversation.id,
    status: conversation.status,
    handoff_reason: conversation.handoff_reason,
    customer_label: conversation.customer_label,
  };
  const initialMessages = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at.toISOString(),
  }));

  return (
    <StaffChat
      conversationId={id}
      initialConversation={initialConversation}
      initialMessages={initialMessages}
    />
  );
}