import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { STAFF_COOKIE_NAME, verifyStaffToken } from "@/lib/auth";

export default async function StaffProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (!verifyStaffToken(token)) {
    redirect("/staff/login");
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-950 font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2 font-bold text-zinc-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">
              L
            </span>
            LendingKind Console
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium text-zinc-300">
            <a href="/staff" className="rounded-full px-4 py-1.5 transition-colors hover:bg-zinc-800">
              Conversations
            </a>
            <Link href="/" className="rounded-full px-4 py-1.5 transition-colors hover:bg-zinc-800">
              Customer site
            </Link>
            <a
              href="/staff/logout"
              className="rounded-full border border-zinc-700 px-4 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800"
            >
              Sign out
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}