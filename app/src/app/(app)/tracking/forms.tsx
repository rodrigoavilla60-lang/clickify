"use client";

import { useActionState } from "react";
import { FieldError, Input, Label, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createTrackingSite, type SiteState } from "../actions";

export function NewSiteForm() {
  const [state, action] = useActionState<SiteState, FormData>(createTrackingSite, {});
  const v = state.values ?? {};
  return (
    <form key={state.ok ?? "novo"} action={action} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="tk-name">Nome do site</Label>
        <Input id="tk-name" name="name" defaultValue={v.name} placeholder="Ex.: Loja principal" maxLength={60} />
      </div>
      <div>
        <Label htmlFor="tk-domain">Domínio do CNAME (opcional)</Label>
        <Input id="tk-domain" name="domain" defaultValue={v.domain} placeholder="Ex.: t.sualoja.com" autoComplete="off" aria-describedby="tk-domain-help" />
        <p id="tk-domain-help" className="mt-1 text-xs text-muted">
          Só preencha se for usar CNAME (recomendado): crie o registro CNAME apontando para o domínio do app.
          Pode deixar vazio e configurar depois.
        </p>
      </div>
      <FieldError id="tk-err">{state.error}</FieldError>
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <SubmitButton className="w-full">Criar site</SubmitButton>
    </form>
  );
}
