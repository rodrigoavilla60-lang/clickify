import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { recordBeacon, siteByKey } from "@/lib/track";

// Coletor do Clickify Tracking (script t.js). Público por necessidade — o navegador do
// visitante chama direto — então a autenticação é a chave pública do site (ck_...).
// Sem sessão, sem cookie do app: só valida a chave e grava.

const KNOWN_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "fbclid", "gclid", "gbraid", "wbraid", "ttclid", "msclkid",
] as const;

function cleanStr(v: unknown, max = 1000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function cleanAttr(v: unknown): Record<string, string | null> | null {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, string | null> = {};
  let any = false;
  for (const k of KNOWN_KEYS) {
    const s = cleanStr((v as Record<string, unknown>)[k], 500);
    out[k] = s;
    if (s) any = true;
  }
  return any ? out : null;
}

function cors(res: NextResponse): NextResponse {
  // O script pode rodar em domínio diferente (sem CNAME): libera o POST de qualquer origem.
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
  if (!rateLimit(`track:${ip}`, 180, 60_000))
    return cors(NextResponse.json({ ok: false, error: "muitas requisições" }, { status: 429 }));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return cors(NextResponse.json({ ok: false }, { status: 400 }));
  }
  const siteKey = cleanStr(body.site, 80);
  const vid = cleanStr(body.vid, 64);
  if (!siteKey || !siteKey.startsWith("ck_") || !vid)
    return cors(NextResponse.json({ ok: false }, { status: 400 }));

  const site = await siteByKey(siteKey);
  if (!site) return cors(NextResponse.json({ ok: false }, { status: 404 }));

  try {
    await recordBeacon(site.id, vid, cleanStr(body.url), cleanStr(body.ref), cleanAttr(body.attr));
  } catch (e) {
    console.error("track:", (e as Error).message);
    return cors(NextResponse.json({ ok: false }, { status: 500 }));
  }
  return cors(NextResponse.json({ ok: true }));
}
