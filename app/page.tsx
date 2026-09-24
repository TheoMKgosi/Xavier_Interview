import ChatWidget from "@/components/chat-widget";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-full bg-white font-sans dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">
              L
            </span>
            Kopano Microfinance
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-400">
            <a href="#loans" className="hover:text-zinc-900">Loans</a>
            <a href="#how-it-works" className="hover:text-zinc-900">How it works</a>
            <a href="#faq" className="hover:text-zinc-900">FAQ</a>
          </nav>
          <Link
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            href="/staff"
          >
            Staff
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Small loans. Big possibilities.
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 md:text-5xl">
              Fast, fair micro-loans when you need them most.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-zinc-600">
              Borrow from $100 to $5,000 with transparent terms, no hidden fees, and
              approvals in minutes — not weeks.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#loans"
                className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Apply in minutes
              </a>
              <a
                href="#how-it-works"
                className="rounded-full border border-zinc-300 px-6 py-3 font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                See how it works
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold text-zinc-500">Example offer</div>
            <div className="mt-3 text-5xl font-bold text-emerald-700">$2,500</div>
            <div className="text-sm text-zinc-500">One-time micro-loan</div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-2xl font-semibold">9.9%</div>
                <div className="text-zinc-500">Flat rate p.a.</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">12 mo</div>
                <div className="text-zinc-500">Repayment term</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">$218</div>
                <div className="text-zinc-500">Monthly payment</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">0</div>
                <div className="text-zinc-500">Hidden fees</div>
              </div>
            </div>
          </div>
        </section>

        <section id="loans" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold tracking-tight">Loans built for you</h2>
          <p className="mt-2 text-zinc-600">Pick the size that fits your moment.</p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                title: "Starter Loan",
                amount: "$100 – $1,000",
                terms: "3–6 month terms",
                note: "For unexpected bills and first purchases.",
              },
              {
                title: "Growth Loan",
                amount: "$1,000 – $2,500",
                terms: "6–12 month terms",
                note: "For small business stock, tools, or repairs.",
              },
              {
                title: "Flex Loan",
                amount: "$2,500 – $5,000",
                terms: "12–24 month terms",
                note: "Bigger goals, repayments that fit your income.",
              },
            ].map((loan) => (
              <div
                key={loan.title}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h3 className="text-lg font-semibold">{loan.title}</h3>
                <div className="mt-2 text-2xl font-bold text-emerald-700">{loan.amount}</div>
                <div className="mt-1 text-sm text-zinc-500">{loan.terms}</div>
                <p className="mt-3 text-sm text-zinc-600">{loan.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { step: "1", title: "Tell us your story", body: "Answer a few quick questions about what you need the loan for." },
              { step: "2", title: "Get an instant decision", body: "Our model reviews your application in minutes and shows your offer." },
              { step: "3", title: "Receive your funds", body: "Accept your offer and get money sent straight to your account." },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl bg-zinc-50 p-6 dark:bg-zinc-900">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold tracking-tight">Questions?</h2>
          <p className="mt-2 text-zinc-600">
            Ask our assistant Zola anything using the chat bubble, or check a few
            common questions below.
          </p>
          <div className="mt-8 space-y-4">
            {[
              { q: "How fast can I get my money?", a: "Most approved applicants receive funds the same business day." },
              { q: "Do you check credit history?", a: "We look at overall affordability rather than a hard credit score." },
              { q: "Are there any hidden fees?", a: "No. The rate you see at application is the rate you pay." },
              { q: "Can I repay early?", a: "Yes — you can repay early with no penalty, saving on interest." },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="font-semibold">{item.q}</div>
                <p className="mt-1 text-sm text-zinc-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} Kopano Microfinance. Demo application.</p>
      </footer>

      <ChatWidget />
    </div>
  );
}
