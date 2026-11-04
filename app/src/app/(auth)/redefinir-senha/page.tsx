import { ButtonLink, Card } from "@/components/ui";
import { one } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { ResetForm } from "../password-forms";

export const metadata = { title: "Criar senha nova", referrer: "no-referrer" };

// Fora do arquivo de actions de propósito: lá viraria uma função chamável pelo navegador.
async function resetTokenValid(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  return !!(await one("select 1 from password_resets where token_hash = $1 and used_at is null and expires_at > now()", [sha256(token)]));
}

export default async function RedefinirSenha({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = await resetTokenValid(token);
  return (
    <Card>
      <h1 className="mb-1 text-lg font-semibold">Criar senha nova</h1>
      {valid ? (
        <>
          <p className="mb-6 text-sm text-muted">Depois de salvar, você já entra na conta e os outros aparelhos são desconectados.</p>
          <ResetForm token={token} />
        </>
      ) : (
        <>
          <p className="mb-6 text-sm text-muted">Esse link expirou ou já foi usado. Por segurança, cada link vale por 1 hora e uma vez só.</p>
          <ButtonLink href="/esqueci-senha" className="w-full">Pedir outro link</ButtonLink>
        </>
      )}
    </Card>
  );
}
