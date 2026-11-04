"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { login, register, type AuthState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : register, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-4">
      {e.form && <p role="alert" className="rounded-md bg-surface-2 px-3 py-2 text-sm text-danger">{e.form}</p>}
      {mode === "register" && (
        <div>
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name}
            aria-invalid={!!e.name} aria-describedby="name-err" />
          <FieldError id="name-err">{e.name}</FieldError>
        </div>
      )}
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email}
          aria-invalid={!!e.email} aria-describedby="email-err" />
        <FieldError id="email-err">
          {e.email}
          {e.email?.includes("Entre") && <> <Link className="underline" href="/login">Entrar</Link></>}
        </FieldError>
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          aria-invalid={!!e.password} aria-describedby="password-err" />
        <FieldError id="password-err">{e.password}</FieldError>
        {mode === "login" && (
          <p className="mt-2 text-right text-xs"><Link href="/esqueci-senha" className="text-muted underline hover:text-text">Esqueci minha senha</Link></p>
        )}
      </div>
      <SubmitButton className="w-full">{mode === "login" ? "Entrar" : "Criar conta"}</SubmitButton>
    </form>
  );
}
