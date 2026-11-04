"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, Input, Label, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { changePassword, requestPasswordReset, resetPassword, type ResetState } from "./actions";

export function ForgotForm() {
  const [state, action] = useActionState<ResetState, FormData>(requestPasswordReset, {});
  if (state.ok) return <Notice tone="success">{state.ok}</Notice>;
  return (
    <form action={action} noValidate className="space-y-4">
      <div>
        <Label htmlFor="email">E-mail da conta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email}
          aria-invalid={!!state.error} aria-describedby="email-err" />
        <FieldError id="email-err">{state.error}</FieldError>
      </div>
      <SubmitButton className="w-full">Enviar link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<ResetState, FormData>(resetPassword, {});
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="password">Senha nova</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-describedby="pw-help" />
        <p id="pw-help" className="mt-1 text-xs text-muted">Pelo menos 8 caracteres.</p>
      </div>
      <div>
        <Label htmlFor="confirm">Repita a senha nova</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-describedby="reset-err" />
      </div>
      <FieldError id="reset-err">
        {state.error}
        {state.error?.includes("Peça um novo") && <> <Link className="underline" href="/esqueci-senha">Pedir outro link</Link></>}
      </FieldError>
      <SubmitButton className="w-full">Salvar senha nova</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<ResetState, FormData>(changePassword, {});
  return (
    <form key={state.ok ?? "form"} action={action} noValidate className="space-y-3">
      <div>
        <Label htmlFor="current">Senha atual</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" />
      </div>
      <div>
        <Label htmlFor="new-password">Senha nova</Label>
        <Input id="new-password" name="password" type="password" autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="new-confirm">Repita a senha nova</Label>
        <Input id="new-confirm" name="confirm" type="password" autoComplete="new-password" aria-describedby="change-err" />
      </div>
      <FieldError id="change-err">{state.error}</FieldError>
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <SubmitButton variant="secondary">Trocar senha</SubmitButton>
    </form>
  );
}
