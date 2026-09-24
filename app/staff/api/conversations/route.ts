import { cookies } from "next/headers";
import { STAFF_COOKIE_NAME, verifyStaffToken } from "@/lib/auth";
import { listConversations } from "@/lib/db";

export async function GET() {
  const cookieStore = await cookies();
  if (!verifyStaffToken(cookieStore.get(STAFF_COOKIE_NAME)?.value)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversations();
  return Response.json({ conversations });
}