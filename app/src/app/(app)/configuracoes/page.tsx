import { requireWorkspace } from "@/lib/auth";
import { Card, Input, Label, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { deleteAccount, logoutEverywhere } from "../../(auth)/actions";
import { SettingsForm } from "./settings-form";
import { ChangePasswordForm } from "../../(auth)/password-forms";

export const metadata = { title: "Configurações" };

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ excluir?: string }> }) {
  const { user, ws } = await requireWorkspace();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Configurações" subtitle="Nome da operação, fuso dos relatórios e a sua conta." />
      <div className="grid max-w-xl gap-6">
        <Card>
          <SettingsForm ws={{ name: ws.name, timezone: ws.timezone }} />
        </Card>
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Trocar senha</h2>
          <ChangePasswordForm />
        </Card>
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Sessões</h2>
          <p className="text-sm text-muted">Esqueceu a conta aberta em outro computador? Isso desconecta todos, inclusive este.</p>
          <form action={logoutEverywhere}><SubmitButton variant="secondary">Sair de todos os dispositivos</SubmitButton></form>
        </Card>
        <Card className="space-y-3 border-danger">
          <h2 className="text-sm font-semibold text-danger">Excluir conta</h2>
          <p className="text-sm text-muted">Apaga a conta, as conexões com o Meta, os webhooks e todas as vendas. Não tem volta.</p>
          {sp.excluir === "erro" && <Notice tone="danger">O e-mail digitado não confere. Nada foi apagado.</Notice>}
          <form action={deleteAccount} className="space-y-3">
            <div>
              <Label htmlFor="confirm">Digite {user.email} para confirmar</Label>
              <Input id="confirm" name="confirm" autoComplete="off" />
            </div>
            <SubmitButton variant="danger">Excluir minha conta</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
