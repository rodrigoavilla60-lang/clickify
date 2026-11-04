import { NextResponse, type NextRequest } from "next/server";
import { handleWebhook, MAX_BODY } from "@/lib/orders";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY)
    return NextResponse.json({ error: "corpo grande demais" }, { status: 413 });
  const raw = await req.text();
  const r = await handleWebhook(token, raw, req.headers, req.nextUrl);
  return NextResponse.json(r.body, { status: r.status });
}
