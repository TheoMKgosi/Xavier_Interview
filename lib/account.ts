import { randomInt } from "node:crypto";
import {
  clearConversationOtp,
  findLoansByCredentials,
  getLoanContactHistory,
  getLoanPayments,
  normalizePhone,
  setConversationOtp,
  setConversationVerified,
} from "@/lib/db";
import type { Conversation, Loan } from "@/lib/db";

const OTP_TTL_SECONDS = 300;

function generateOtp(): string {
  const n = randomInt(100000, 1000000);
  return String(n);
}

/** Format a phone for display, e.g. "... 084 258". */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? `... ${digits.slice(-6)}` : phone;
}

export interface OtpResult {
  ok: boolean;
  message: string;
  otp?: string;
  customerName?: string;
  loans: Loan[];
}

/** Send an OTP for the customer matching last4 + phone. */
export async function requestOtp(
  conversation: Conversation,
  last4: string,
  phone: string,
): Promise<OtpResult> {
  const matches = await findLoansByCredentials(last4, phone);
  if (matches.length === 0) {
    return {
      ok: false,
      message: "No account found matching those details. Please double-check the last 4 digits of your Omang/ID and your phone number.",
      loans: [],
    };
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
  await setConversationOtp(conversation.id, otp, expiresAt, phone, last4);

  const customerName = matches[0].borrowerName;
  return {
    ok: true,
    message: `We've sent a 6-digit code to ${maskPhone(phone)}. Please enter it to continue.`,
    otp,
    customerName,
    loans: matches.map((m) => m.loan),
  };
}

export interface VerifyResult {
  ok: boolean;
  message: string;
  customerName?: string;
  loans?: Loan[];
}

/** Verify a submitted OTP against the one stored on the conversation. */
export async function verifyOtp(conversation: Conversation, code: string): Promise<VerifyResult> {
  const expected = conversation.verify_otp;
  const expiresAt = conversation.verify_otp_expires_at;
  const codeClean = code.trim();

  if (!expected || !expiresAt) {
    return { ok: false, message: "No verification code is pending. Please start again by providing your details." };
  }

  if (new Date(expiresAt).getTime() < Date.now()) {
    await clearConversationOtp(conversation.id);
    return { ok: false, message: "That code has expired. Please request a new one." };
  }

  if (codeClean !== expected) {
    return { ok: false, message: "That code is incorrect. Please try again." };
  }

  await clearConversationOtp(conversation.id);
  await setConversationVerified(conversation.id);

  const loans = await findLoansByCredentials(
    conversation.verify_last4 ?? "",
    conversation.verify_phone ?? "",
  );

  return {
    ok: true,
    message: "Your identity has been verified.",
    customerName: loans[0]?.borrowerName,
    loans: loans.map((m) => m.loan),
  };
}

export interface AccountSummary {
  customerName: string;
  phone: string;
  loans: (Loan & { payments: Awaited<ReturnType<typeof getLoanPayments>>; contact: Awaited<ReturnType<typeof getLoanContactHistory>> })[];
}

/** Fetch the full account snapshot for a verified conversation. */
export async function getAccountSummary(conversation: Conversation): Promise<AccountSummary | null> {
  if (conversation.verify_step !== "verified") return null;

  const matches = await findLoansByCredentials(
    conversation.verify_last4 ?? "",
    conversation.verify_phone ?? "",
  );
  if (matches.length === 0) return null;

  const loans = await Promise.all(
    matches.map(async (m) => {
      const payments = await getLoanPayments(m.loan.loan_id);
      const contact = await getLoanContactHistory(m.loan.loan_id);
      return { ...m.loan, payments, contact };
    }),
  );

  return {
    customerName: matches[0].borrowerName,
    phone: conversation.verify_phone ?? matches[0].loan.phone,
    loans,
  };
}

function formatPula(value: number | null): string {
  if (value === null || value === undefined) return "P 0.00";
  return `P ${value.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Predefined message asking the customer to enter the OTP. */
export function buildOtpPrompt(phone: string): string {
  return `We've sent a 6-digit code to your registered phone (${maskPhone(phone)}). Please enter it to continue.`;
}

/** Predefined message asking for the credentials needed to verify an account. */
export function buildCredentialPrompt(): string {
  return "To access your account, please provide the last 4 digits of your Omang/ID and your registered phone number.";
}

/** Predefined, DB-backed reply showing all loans for a verified customer. */
export function buildAccountReply(summary: AccountSummary | null): string {
  if (!summary) {
    return "I'm sorry, I couldn't find your account records. Please try again or ask to speak with a human agent.";
  }

  const lines = summary.loans.map((loan) => {
    const parts = [
      `${loan.loan_id} (${loan.product ?? "Loan"})`,
    ];
    const balance = loan.outstanding_balance_bwp;
    parts.push(loan.status ? `status: ${loan.status.toLowerCase()}` : "");
    parts.push(`outstanding: ${formatPula(balance)}`);
    if (loan.monthly_instalment_bwp !== null && loan.monthly_instalment_bwp > 0) {
      parts.push(`next payment: ${formatPula(loan.monthly_instalment_bwp)}`);
    }
    const due = formatDate(loan.next_due_date);
    parts.push(due ? `due ${due}` : "");
    if (loan.arrears_bwp && loan.arrears_bwp > 0) {
      parts.push(`arrears: ${formatPula(loan.arrears_bwp)}`);
    }
    const summary = parts.filter(Boolean).join(" · ");
    return `• ${summary}`;
  });

  return `Thanks, ${summary.customerName}. Here are your loans:\n${lines.join("\n")}\n\nIs there anything else I can help you with?`;
}

/** Predefined message used after a customer's identity is verified via OTP. */
export function buildVerifiedText(customerName: string): string {
  return `Great ${customerName} — your identity has been verified. One moment while I pull up your account details.`;
}

export { normalizePhone };