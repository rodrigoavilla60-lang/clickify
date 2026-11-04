import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { one, query } from "@/lib/db";
import { meta } from "@/lib/meta";
import { syncWorkspace } from "@/lib/sync";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const back = (msg?: string) =>
    NextResponse.redirect(new URL(msg ? `/contas?erro=${encodeURIComponent(msg)}` : "/contas", req.url));

  const jar = await cookies();
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (!state || state !== jar.get("meta_state")?.value) return back("a autorização expirou, tente de novo");
  jar.delete("meta_state");
  if (!code) return back(req.nextUrl.searchParams.get("error_description") ?? "autorização cancelada");

  const ws = await one<{ id: string }>("select id from workspaces where owner_id = $1 order by created_at limit 1", [user.id]);
  if (!ws) return back("workspace não encontrado");

  try {
    const provider = meta();
    const redirectUri = new URL("/api/meta/callback", req.url).toString();
    const { token, expiresAt } = await provider.exchangeCode(code, redirectUri);
    const accounts = await provider.listAdAccounts(token);
    const enc = encrypt(token);
    for (const a of accounts)
      await query(
        `insert into ad_accounts (workspace_id, provider, external_id, name, currency, timezone, access_token_enc, token_expires_at, enabled)
         values ($1, 'meta', $2, $3, $4, $5, $6, $7, $8)
         on conflict (workspace_id, provider, external_id) do update set
           name = excluded.name, currency = excluded.currency, timezone = excluded.timezone,
           access_token_enc = excluded.access_token_enc, token_expires_at = excluded.token_expires_at, updated_at = now()`,
        // Só a primeira conta já vem ativa; as outras o usuário liga na lista.
        [ws.id, a.externalId, a.name, a.currency, a.timezone, enc, expiresAt, accounts.indexOf(a) === 0],
      );
    await syncWorkspace(ws.id, 30);
  } catch (e) {
    return back((e as Error).message);
  }
  return back();
}
