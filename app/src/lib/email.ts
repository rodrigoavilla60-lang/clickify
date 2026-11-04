import "server-only";
import fs from "node:fs";
import path from "node:path";

// E-mail transacional pelo Resend (API HTTP, sem SDK). Sem RESEND_API_KEY:
// - em desenvolvimento e nos testes, o e-mail vai para uma pasta (EMAIL_OUTBOX) e o link aparece no terminal;
// - em produção, não envia e devolve false, para a tela avisar.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const env = (name: string) => (process.env[name] ?? "").trim();

// Remetente. Copiado de uma instrução, o valor costuma vir com crases ou aspas em volta, e o
// Resend recusa ("Invalid `from` field"): limpa antes de mandar.
export function fromAddress(): string {
  const raw = env("EMAIL_FROM").replace(/^[`'"\s]+|[`'"\s]+$/g, "");
  return /^([^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/.test(raw) ? raw : "Clickify <onboarding@resend.dev>";
}

export async function sendEmail(e: Email): Promise<boolean> {
  const key = env("RESEND_API_KEY");
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error("email: RESEND_API_KEY não configurada; e-mail não enviado");
      return false;
    }
    const dir = env("EMAIL_OUTBOX") || path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "outbox");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${Date.now()}-${e.to.replace(/[^a-z0-9@.]/gi, "_")}.json`), JSON.stringify(e, null, 2));
    console.log(`email (dev) para ${e.to}: ${e.subject}\n${e.text}`);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [e.to], subject: e.subject, text: e.text, html: e.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("email: Resend respondeu", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("email: falhou", (err as Error).message);
    return false;
  }
}

// Endereço público do app para links em e-mail. Nunca do cabeçalho Host em produção: alguém
// poderia pedir a recuperação com um Host falso e o link do e-mail apontaria para o site dele.
export function appUrl(devHost?: string | null): string {
  const fixed = env("APP_URL") || (env("VERCEL_PROJECT_PRODUCTION_URL") ? `https://${env("VERCEL_PROJECT_PRODUCTION_URL")}` : "");
  if (fixed) return fixed.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production" && devHost) return `http://${devHost}`;
  return "http://localhost:3000";
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetEmail(name: string, link: string): Omit<Email, "to"> {
  const first = name.split(" ")[0] || "olá";
  return {
    subject: "Redefinir sua senha do Clickify",
    text: `Oi, ${first}!\n\nRecebemos um pedido para redefinir a senha da sua conta no Clickify. Para criar uma senha nova, abra o link abaixo (vale por 1 hora e só uma vez):\n\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.\n\nClickify`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0e3533;max-width:480px">
<p>Oi, ${esc(first)}!</p>
<p>Recebemos um pedido para redefinir a senha da sua conta no Clickify.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#1ab796;color:#071413;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Criar senha nova</a></p>
<p style="color:#4f7a75;font-size:13px">O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
</div>`,
  };
}
