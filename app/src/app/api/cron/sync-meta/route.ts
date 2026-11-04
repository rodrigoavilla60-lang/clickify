import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { syncWorkspace } from "@/lib/sync";
import { purgeMatchData, retryFailed } from "@/lib/pixels";

// Vercel Cron chama com "Authorization: Bearer $CRON_SECRET".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(given, `Bearer ${secret}`))
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const r = await syncWorkspace(null);
  // Aproveita a rodada diária: reenvia o que o pixel não conseguiu mandar e apaga dados vencidos.
  const pixelRetries = await retryFailed(null);
  await purgeMatchData();
  return NextResponse.json({ ...r, pixelRetries });
}
