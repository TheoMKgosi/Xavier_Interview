import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface KbDocument {
  name: string;
  content: string;
}

export interface KnowledgeBase {
  documents: KbDocument[];
  handoverInstructions: string | null;
  source: "local";
}

const KB_DIR = process.env.KB_DIR ?? "knowledge-base";

let cache: { kb: KnowledgeBase; fetchedAt: number } | null = null;

function ensurePdfShim() {
  if (typeof (globalThis as Record<string, unknown>).DOMMatrix !== "undefined") return;
  class DOMMatrix {
    private m: number[];
    constructor(m?: number[]) {
      this.m = m ?? [1, 0, 0, 1, 0, 0];
    }
    static fromString() {
      return new DOMMatrix();
    }
    static fromFloat32Array() {
      return new DOMMatrix();
    }
    static fromFloat64Array() {
      return new DOMMatrix();
    }
    static fromMatrix() {
      return new DOMMatrix();
    }
    multiply() {
      return this;
    }
    translate() {
      return this;
    }
    scale() {
      return this;
    }
    rotate() {
      return this;
    }
    inverse() {
      return this;
    }
    transformPoint(p: { x?: number; y?: number }) {
      return { x: p?.x ?? 0, y: p?.y ?? 0 };
    }
    get a() {
      return this.m[0];
    }
    get b() {
      return this.m[1];
    }
    get c() {
      return this.m[2];
    }
    get d() {
      return this.m[3];
    }
    get e() {
      return this.m[4];
    }
    get f() {
      return this.m[5];
    }
  }
  class DOMPoint {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    static fromPoint() {
      return new DOMPoint();
    }
  }
  const g = globalThis as Record<string, unknown>;
  g.DOMMatrix = DOMMatrix;
  g.DOMPoint = DOMPoint;
  g.DOMTransform = DOMMatrix;
}

async function extractPdf(data: Buffer): Promise<string> {
  ensurePdfShim();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  const pages = result.pages as { text?: string }[] | undefined;
  return pages ? pages.map((p) => p.text ?? "").join("\n") : "";
}

async function extractDocx(data: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: data });
  return result.value;
}

async function extractFile(name: string): Promise<string | null> {
  const lower = name.toLowerCase();
  const data = await readFile(join(KB_DIR, name));
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return data.toString("utf-8");
  }
  if (lower.endsWith(".docx")) {
    return extractDocx(data);
  }
  if (lower.endsWith(".pdf")) {
    return extractPdf(data);
  }
  return null;
}

function findHandoverDoc(documents: KbDocument[]): KbDocument | null {
  const configured = process.env.KB_HANDOVER_FILE;
  if (configured) {
    const match = documents.find((doc) => doc.name === configured);
    if (match) return match;
  }
  const byName = documents.find((doc) => /handover|handoff|escalat/i.test(doc.name));
  if (byName) return byName;
  return documents.find((doc) => /transfer the conversation to a human agent/i.test(doc.content)) ?? null;
}

export async function loadKnowledgeBase(force = false): Promise<KnowledgeBase> {
  if (!force && cache) {
    return cache.kb;
  }

  const documents: KbDocument[] = [];
  try {
    const entries = await readdir(KB_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      try {
        const content = await extractFile(entry.name);
        if (content !== null) {
          documents.push({ name: entry.name, content });
        }
      } catch (error) {
        console.error(`[kb] failed to extract ${entry.name}:`, error);
      }
    }
  } catch {
    // knowledge-base/ folder missing or unreadable — proceed with no docs
  }

  const handoverDoc = findHandoverDoc(documents);
  const kb: KnowledgeBase = {
    documents,
    handoverInstructions: handoverDoc ? handoverDoc.content : null,
    source: "local",
  };
  cache = { kb, fetchedAt: Date.now() };
  return kb;
}