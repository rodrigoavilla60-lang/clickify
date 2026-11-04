import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { meta } from "@/lib/meta";

export async function GET(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.redirect(new URL("/login", req.url));
  const state = randomToken(16);
  (await cookies()).set("meta_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const redirectUri = new URL("/api/meta/callback", req.url).toString();
  return NextResponse.redirect(meta().authUrl(state, redirectUri));
}
