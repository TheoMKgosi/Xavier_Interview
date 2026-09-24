import { createHash, createHmac } from "node:crypto";

export interface KbDocument {
  name: string;
  content: string;
}

export interface KnowledgeBase {
  documents: KbDocument[];
  handoverInstructions: string | null;
  source: "s3" | "env";
}

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const TTL_MS = 5 * 60 * 1000;

let cache: { kb: KnowledgeBase; fetchedAt: number } | null = null;

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function config(): { endpoint: string; bucket: string; accessKey: string; secretKey: string; region: string; prefix: string } | null {
  const endpoint = process.env.KB_ENDPOINT;
  const bucket = process.env.KB_BUCKET;
  const accessKey = process.env.KB_ACCESS_KEY;
  const secretKey = process.env.KB_SECRET_KEY;
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    bucket,
    accessKey,
    secretKey,
    region: process.env.KB_REGION ?? "us-east-1",
    prefix: process.env.KB_PREFIX ?? "",
  };
}

async function s3Request(cfg: ReturnType<typeof config>, path: string, query: string): Promise<string> {
  const url = new URL(cfg!.endpoint);
  const host = url.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const payloadHash = EMPTY_SHA256;

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `GET\n${path}\n${query}\n${canonicalHeaders}\n\n${signedHeaders}\n${payloadHash}`;

  const scope = `${dateStamp}/${cfg!.region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmacSha256(`AWS4${cfg!.secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, cfg!.region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg!.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestUrl = new URL(cfg!.endpoint);
  requestUrl.pathname = path;
  requestUrl.search = query;

  const res = await fetch(requestUrl, {
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization,
    },
  });
  if (!res.ok) {
    throw new Error(`KB request failed: ${res.status} ${res.statusText} for ${path}`);
  }
  return res.text();
}

function keyPath(cfg: ReturnType<typeof config>, key: string): string {
  return `/${cfg!.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function listKeys(cfg: ReturnType<typeof config>): Promise<string[]> {
  const query = new URLSearchParams({ "list-type": "2", prefix: cfg!.prefix }).toString();
  const xml = await s3Request(cfg, `/${cfg!.bucket}`, query);
  const keys: string[] = [];
  for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
    keys.push(match[1]);
  }
  return keys;
}

async function getObject(cfg: ReturnType<typeof config>, key: string): Promise<string> {
  return s3Request(cfg, keyPath(cfg, key), "");
}

function keysFromEnv(): string[] {
  return (process.env.KB_FILES ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export async function loadKnowledgeBase(force = false): Promise<KnowledgeBase> {
  if (!force && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.kb;
  }

  const cfg = config();
  if (!cfg) {
    const kb: KnowledgeBase = { documents: [], handoverInstructions: null, source: "env" };
    cache = { kb, fetchedAt: Date.now() };
    return kb;
  }

  const envKeys = keysFromEnv();
  const keys = envKeys.length ? envKeys : await listKeys(cfg);

  const documents: KbDocument[] = [];
  for (const key of keys) {
    if (!key.endsWith(".md") && !key.endsWith(".txt")) continue;
    try {
      const content = await getObject(cfg, key);
      const name = key.split("/").pop() ?? key;
      documents.push({ name, content });
    } catch (error) {
      console.error(`[kb] failed to load ${key}:`, error);
    }
  }

  const handoverDoc = documents.find((doc) => /handover|handoff/i.test(doc.name));
  const kb: KnowledgeBase = {
    documents,
    handoverInstructions: handoverDoc?.content ?? null,
    source: "s3",
  };
  cache = { kb, fetchedAt: Date.now() };
  return kb;
}