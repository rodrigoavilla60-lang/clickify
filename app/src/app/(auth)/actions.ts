"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { one, query } from "@/lib/db";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import { appUrl, resetEmail, sendEmail } from "@/lib/email";
import { endSession, requireWorkspace, startSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "local";
}

const SLOW_DOWN = "Muitas tentativas. Espere alguns minutos e tente de novo.";

export interface AuthState {
  errors?: Partial<Record<"name" | "email" | "password" | "form", string>>;
  values?: { name?: string; email?: string };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const errors: AuthState["errors"] = {};
  if (name.length < 2) errors.name = "Diga como podemos te chamar.";
  if (name.length > 80) errors.name = "Use até 80 caracteres.";
  if (!EMAIL.test(email)) errors.email = "Esse e-mail não parece válido.";
  if (password.length < 8) errors.password = "A senha precisa de pelo menos 8 caracteres.";
  if (Object.keys(errors).length) return { errors, values: { name, email } };
  if (!rateLimit(`register:${await clientIp()}`, 5, 60 * 60e3))
    return { errors: { form: SLOW_DOWN }, values: { name, email } };

  if (await one("select 1 from users where email = $1", [email]))
    return { errors: { email: "Já existe uma conta com esse e-mail. Entre por aqui." }, values: { name, email } };

  const [user] = await query<{ id: string }>(
    "insert into users (email, name, password_hash) values ($1, $2, $3) returning id",
    [email, name, hashPassword(password)],
  );
  await query("insert into workspaces (owner_id, name) values ($1, $2)", [user.id, "Minha operação"]);
  await startSession(user.id);
  redirect("/onboarding");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60e3) || !rateLimit(`login:${email}`, 8, 15 * 60e3))
    return { errors: { form: SLOW_DOWN }, values: { email } };
  const user = await one<{ id: string; password_hash: string }>(
    "select id, password_hash from users where email = $1",
    [email],
  );
  if (!user || !verifyPassword(password, user.password_hash))
    return { errors: { form: "E-mail ou senha não conferem." }, values: { email } };
  await startSession(user.id);
  redirect("/hoje");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function logoutEverywhere() {
  const { user } = await requireWorkspace();
  await query("delete from sessions where user_id = $1", [user.id]);
  await endSession();
  redirect("/login");
}

// Apaga de verdade: workspaces, contas, tokens, pedidos e eventos vão junto (on delete cascade).
export async function deleteAccount(form: FormData) {
  const { user } = await requireWorkspace();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== user.email) redirect("/configuracoes?excluir=erro");
  await query("delete from users where id = $1", [user.id]);
  await endSession();
  redirect("/register");
}

// ---------------- Recuperar e trocar senha ----------------
export interface ResetState { error?: string; ok?: string; email?: string }

const RESET_TTL_MIN = 60;

// Sempre a mesma resposta, exista a conta ou não: a tela não pode servir para descobrir e-mails cadastrados.
export async function requestPasswordReset(_: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Esse e-mail não parece válido.", email };
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, 10, 60 * 60e3) || !rateLimit(`reset:${email}`, 3, 60 * 60e3))
    return { error: SLOW_DOWN, email };
  const done: ResetState = { ok: `Se existir uma conta com ${email}, mandamos um link para criar uma senha nova. Confira a caixa de entrada e o spam. O link vale por 1 hora.` };
  const user = await one<{ id: string; name: string }>("select id, name from users where email = $1", [email]);
  if (!user) return done;
  const token = randomToken(32);
  await query("insert into password_resets (user_id, token_hash, expires_at) values ($1, $2, now() + make_interval(mins => $3))",
    [user.id, sha256(token), RESET_TTL_MIN]);
  const link = `${appUrl((await headers()).get("host"))}/redefinir-senha?token=${token}`;
  const sent = await sendEmail({ to: email, ...resetEmail(user.name, link) });
  if (!sent) return { error: "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.", email };
  return done;
}


export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa de pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As duas senhas não estão iguais." };
  if (!rateLimit(`reset-use:${await clientIp()}`, 20, 60 * 60e3)) return { error: SLOW_DOWN };
  // Marca como usado na mesma consulta que confere: dois cliques no link não trocam a senha duas vezes.
  const [row] = await query<{ user_id: string }>(
    `update password_resets set used_at = now()
     where token_hash = $1 and used_at is null and expires_at > now() returning user_id`,
    [sha256(token)],
  );
  if (!row) return { error: "Esse link expirou ou já foi usado. Peça um novo." };
  await query("update users set password_hash = $2 where id = $1", [row.user_id, hashPassword(password)]);
  // Senha nova derruba quem estivesse logado com a antiga e invalida outros links pedidos.
  await query("delete from sessions where user_id = $1", [row.user_id]);
  await query("update password_resets set used_at = now() where user_id = $1 and used_at is null", [row.user_id]);
  await startSession(row.user_id);
  redirect("/hoje");
}

export async function changePassword(_: ResetState, form: FormData): Promise<ResetState> {
  const { user } = await requireWorkspace();
  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!rateLimit(`change:${user.id}`, 8, 15 * 60e3)) return { error: SLOW_DOWN };
  const row = await one<{ password_hash: string }>("select password_hash from users where id = $1", [user.id]);
  if (!row || !verifyPassword(current, row.password_hash)) return { error: "A senha atual não confere." };
  if (password.length < 8) return { error: "A senha nova precisa de pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As duas senhas novas não estão iguais." };
  if (password === current) return { error: "A senha nova precisa ser diferente da atual." };
  await query("update users set password_hash = $2 where id = $1", [user.id, hashPassword(password)]);
  // Desconecta os outros aparelhos; este continua logado com uma sessão nova.
  await query("delete from sessions where user_id = $1", [user.id]);
  await startSession(user.id);
  return { ok: "Senha trocada. Os outros aparelhos foram desconectados." };
}