"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE_NAME, signStaffToken } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const passcode = String(formData.get("passcode") ?? "");

  const expected = process.env.STAFF_PASSCODE;
  const valid = expected && passcode === expected;

  if (!valid) {
    redirect("/staff/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE_NAME, signStaffToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/staff",
    maxAge: 60 * 60 * 8,
  });

  redirect("/staff");
}