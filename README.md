# Kopano Microfinance — Customer Chatbot & Staff Desk

A Next.js 16 (App Router) app with two sides:

- **Customer chatbot** (`/`) — a floating chat widget that answers questions from a knowledge base and lets verified customers check their own loan balances.
- **Staff desk** (`/staff`) — a simple passcode-protected interface to watch and take over conversations the bot hands to a human.

| Page | URL | Description |
| --- | --- | --- |
| Landing page + chatbot | `/` | Customer-facing widget |
| Staff login | `/staff/login` | Single shared passcode |
| Staff inbox | `/staff` | List of active/flagged conversations |
| Staff chat | `/staff/conversations/[id]` | Read/send messages as a staff member |

---

## 1. Prerequisites

- **Node.js 22+** (the app runs under `node`; `better-sqlite3` needs a working native build)
- **Bun** (package manager — see `.packageManager` in `package.json`)
- An **OpenAI API key** for the chatbot

## 2. Install dependencies

```bash
bun install
```

## 3. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required settings in `.env`:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Local SQLite path, e.g. `data/app.db` (created automatically) |
| `OPENAI_API_KEY` | Your OpenAI key (`sk-...`) |
| `STAFF_PASSCODE` | Shared passcode for `/staff` (default `staff123` in dev) |
| `STAFF_COOKIE_SECRET` | Random secret used to sign the staff session cookie |

## 4. Set up the knowledge base

The chatbot only answers from documents in a local `knowledge-base/` folder. **This folder is not created for you — create it and add your documents.**

```bash
mkdir -p knowledge-base
```

Then drop your lender's documents into `knowledge-base/`. Supported formats:

- `.txt`, `.md` (plain text)
- `.pdf` (parsed via `pdf-parse`)
- `.docx` (parsed via `mammoth`)

Example files you might include: product catalogue, interest & penalty policy, repayment/how-to-pay guides, eligibility rules, FAQs, complaint procedure.

> **Handover rules** are read from a document that contains the phrase
> `Transfer the conversation to a human agent when` (or whose filename contains
> `handover` / `handoff`). To force a specific file, set `KB_HANDOVER_FILE` in
> `.env`, e.g. `KB_HANDOVER_FILE=customer-service-standards.docx`.

You can verify the knowledge base loads by checking the dev server log output for KB extraction errors.

## 5. Import the loan data

The database schema is applied automatically on first use. Seed it with the CSV loan, payment, and contact-history files:

```bash
node db/import-csv.ts
```

This reads `db/kopano_data.xlsx - Loans.csv`, `... - Payments.csv`, and
`... - Contact History.csv` and populates SQLite. Run it with `node` (not `bun`,
which currently crashes on this script). If you don't have the CSVs, the app still
runs — the chatbot just won't find any accounts.

## 6. Run the app

```bash
bun run dev        # http://localhost:3000
# or
bun run build && bun run start
```

Other useful commands:

```bash
bun run lint        # eslint
bun run typecheck   # tsc --noEmit
bun run db:migrate  # apply schema standalone
```

---

## How the balance-verification flow works

1. The customer asks about their account (e.g. "what is my outstanding balance") in the widget.
2. The chatbot asks for the **last 4 digits of their Omang/ID** and their **registered phone number**.
3. Once both parts are provided, the bot **does not** call the AI again. A scripted server step generates a **6-digit OTP**, stores it on the conversation, and replies with a predefined "enter the 6-digit code" message.
4. The customer enters the code; it is verified directly against the database.
5. The bot replies with a **predefined, DB-backed summary** listing **all** of the customer's loans (loan ID, product, outstanding balance, next payment and due date, arrears if any).

After verification, further account questions in the same chat are answered straight from the database — no AI is involved in account figures.

### Test accounts

Use these seeded borrowers to try the flow:

| Loan | Name | Last 4 | Phone | Product | Outstanding |
| --- | --- | --- | --- | --- | --- |
| KM-L-0001 | Amantle Modise | 4216 | +267 71 084 258 | Small Business Loan | P 18,238.97 |
| KM-L-0002 | Tumelo Rakgomo | 1598 | +267 71 699 280 | Salary Advance | P 1,150.02 |
| KM-L-0074 | Resego Koosimile | 2798 | +267 77 316 153 | Small Business Loan | P 42,788.61 |
| KM-L-0078 / KM-L-0079 | Masego Phiri | 7036 | +267 72 465 019 | two loans | P 4,600.00 / P 3,210.00 |

**There is no SMS gateway in this demo.** The OTP is printed to the **server console** — look for a line like:

```
[chat] OTP for conversation <id>: 874833
```

Enter that code in the widget to complete verification.

---

## Staff desk

1. Open `/staff/login` and enter `STAFF_PASSCODE` (default `staff123`).
2. `/staff` lists conversations, newest first, with status (`active`, `awaiting_human`, etc.).
3. Open a conversation to chat as a staff member. You can also **resolve** and close it; the customer sees the reply like a normal bot message.
4. `/staff/logout` clears the session cookie.

The chat API keeps the OTP state on the conversation row, so resuming a conversation (e.g. after a page reload) continues where it left off.

---

## Project layout

```
app/
  api/chat/route.ts          # customer chat endpoint (state machine)
  page.tsx                   # landing page + chat widget
  staff/                     # login, inbox, conversation view, staff APIs
components/
  chat-widget.tsx            # customer-facing widget
  staff/                     # staff desk components
lib/
  ai.ts                      # OpenAI responses + credential extraction
  account.ts                 # OTP + DB-backed account replies
  db.ts                      # SQLite layer + schema migration
  knowledge-base.ts          # knowledge-base/ document loading
db/
  schema.sql                 # SQLite schema reference
  import-csv.ts              # CSV seed script
data/
  app.db                     # SQLite database (created at runtime)
knowledge-base/              # your documents — create this folder
```
