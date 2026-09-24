import ConversationsList from "@/components/staff/conversations-list";
import { listConversations } from "@/lib/db";

export default async function StaffConversationsPage() {
  const conversations = await listConversations();

  const initial = conversations.map((c) => ({
    ...c,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  }));

  return <ConversationsList initial={initial} />;
}