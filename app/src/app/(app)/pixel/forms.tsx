"use client";

import { useActionState } from "react";
import { FieldError, Input, Label, Notice, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { addPixel, testPixel, type PixelState } from "../actions";

export function NewPixelForm({ hooks }: { hooks: { id: string; name: string }[] }) {
  const [state, action] = useActionState<PixelState, FormData>(addPixel, {});
  const v = state.values ?? {};
  return (
    <form key={state.ok ?? "novo"} action={action} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="px-name">Nome</Label>
        <Input id="px-name" name="name" defaultValue={v.name} placeholder="Ex.: Pixel da loja" maxLength={60} />
      </div>
      <div>
        <Label htmlFor="px-id">ID do pixel</Label>
        <Input id="px-id" name="pixel_id" defaultValue={v.pixel_id} inputMode="numeric" autoComplete="off" aria-describedby="px-id-help" />
        <p id="px-id-help" className="mt-1 text-xs text-muted">Número que aparece no Gerenciador de Eventos, embaixo do nome do pixel.</p>
      </div>
      <div>
        <Label htmlFor="px-token">Token de acesso da API de Conversões</Label>
        <Input id="px-token" name="token" type="password" autoComplete="off" aria-describedby="px-token-help" />
        <p id="px-token-help" className="mt-1 text-xs text-muted">
          No Gerenciador de Eventos: pixel &gt; Configurações &gt; API de Conversões &gt; Gerar token de acesso.
          Fica guardado com criptografia e não aparece de novo.
        </p>
      </div>
      <div>
        <Label htmlFor="px-test">Código de teste (opcional)</Label>
        <Input id="px-test" name="test_code" defaultValue={v.test_code} autoComplete="off" placeholder="Ex.: TEST12345" aria-describedby="px-test-help" />
        <p id="px-test-help" className="mt-1 text-xs text-muted">
          Da aba &quot;Eventos de teste&quot;. Com ele, os eventos aparecem lá para conferir. Apague quando terminar de testar.
        </p>
      </div>
      <div>
        <Label htmlFor="px-hook">Vendas de qual checkout</Label>
        <Select id="px-hook" name="webhook" defaultValue={v.webhook ?? ""}>
          <option value="">Todos os checkouts</option>
          {hooks.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      </div>
      <FieldError id="px-err">{state.error}</FieldError>
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <SubmitButton className="w-full">Salvar pixel</SubmitButton>
    </form>
  );
}

export function TestPixelButton({ id, hasCode }: { id: string; hasCode: boolean }) {
  const [state, action] = useActionState<PixelState, FormData>(testPixel, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary">Enviar evento de teste</SubmitButton>
      {!hasCode && !state.error && <p className="text-xs text-muted">Precisa do código de teste cadastrado.</p>}
      {state.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-xs text-success">{state.ok}</p>}
    </form>
  );
}
