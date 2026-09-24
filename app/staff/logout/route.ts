import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_COOKIE_NAME);
  redirect("/staff/login");
}