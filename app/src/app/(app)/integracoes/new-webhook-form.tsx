"use client";

import { useActionState, useState } from "react";
import { FieldError, Input, Label, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { PLATFORMS, type CheckoutPlatform } from "@/lib/platforms";
import { createWebhook, type WebhookState } from "../actions";

const ORDER: CheckoutPlatform[] = ["shopify", "kiwify", "hotmart", "yampi", "eduzz", "generic", "capture"];

export function NewWebhookForm() {
  const [state, action] = useActionState<WebhookState, FormData>(createWebhook, {});
  const [platform, setPlatform] = useState<CheckoutPlatform>("shopify");
  const info = PLATFORMS[platform];
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="platform">Plataforma</Label>
        <Select id="platform" name="platform" value={platform} onChange={(e) => setPlatform(e.target.value as CheckoutPlatform)}>
          {ORDER.map((p) => (
            <option key={p} value={p}>{PLATFORMS[p].label}{PLATFORMS[p].beta ? " (beta)" : ""}</option>
          ))}
        </Select>
        {info.beta && (
          <p className="mt-1 text-xs text-warning">
            Beta: feita a partir da documentação da {info.label}. Confira se a 1ª venda real aparece certinha em Vendas.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="wh-name">Nome</Label>
        <Input id="wh-name" name="name" placeholder="Ex.: Loja principal" maxLength={60}
          aria-invalid={!!state.error} aria-describedby="wh-err" />
      </div>
      {info.secret && (
        <div>
          <Label htmlFor="secret">{info.secret.label} (opcional)</Label>
          <Input id="secret" name="secret" autoComplete="off" aria-describedby="secret-help" />
          <p id="secret-help" className="mt-1 text-xs text-muted">
            {info.secret.help} Com ela, o Clickify recusa vendas falsas enviadas por outra pessoa.
          </p>
        </div>
      )}
      <FieldError id="wh-err">{state.error}</FieldError>
      <SubmitButton className="w-full">Gerar URL</SubmitButton>
    </form>
  );
}
