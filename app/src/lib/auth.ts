import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, query } from "./db";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "sid";
const DAYS = 30;

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  tax_rate_bps: number;
  gateway_fee_bps: number;
  ad_tax_bps: number;
  default_product_cost_cents: number;
  default_shipping_cents: number;
  onboarding_utms_copied: boolean;
}

export async function startSession(userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + DAYS * 864e5);
  await query("insert into sessions (id, user_id, expires_at) values ($1, $2, $3)", [
    sha256(token),
    userId,
    expires,
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query("delete from sessions where id = $1", [sha256(token)]);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return one<User>(
    `select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id
     where s.id = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
}

// Toda página e action logada passa por aqui: o workspace vem da sessão, nunca do cliente.
export async function requireWorkspace(): Promise<{ user: User; ws: Workspace }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ws = await one<Workspace>(
    `select id, name, timezone, currency, tax_rate_bps, gateway_fee_bps, ad_tax_bps,
            default_product_cost_cents::int as default_product_cost_cents,
            default_shipping_cents::int as default_shipping_cents, onboarding_utms_copied
     from workspaces where owner_id = $1 order by created_at limit 1`,
    [user.id],
  );
  if (!ws) redirect("/login");
  return { user, ws };
}
