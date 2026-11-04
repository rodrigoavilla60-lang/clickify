"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, Input, Label, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { updateSettings, type SettingsState } from "../actions";

const ZONES = ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Cuiaba", "America/Rio_Branco",
  "America/Noronha", "Europe/Lisbon", "America/New_York", "UTC"];

export function SettingsForm({ ws }: { ws: { name: string; timezone: string } }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateSettings, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="name">Nome da operação</Label>
        <Input id="name" name="name" defaultValue={ws.name} maxLength={60} />
      </div>
      <div>
        <Label htmlFor="timezone">Fuso horário dos relatórios</Label>
        <Select id="timezone" name="timezone" defaultValue={ws.timezone}>
          {(ZONES.includes(ws.timezone) ? ZONES : [ws.timezone, ...ZONES]).map((z) => <option key={z} value={z}>{z}</option>)}
        </Select>
      </div>
      <p className="text-xs text-muted">
        Impostos, taxas e custos dos produtos ficam em <Link href="/custos" className="text-accent underline">Custos</Link>.
      </p>
      <FieldError id="settings-err">{state.error}</FieldError>
      {state.ok && <p role="status" className="text-sm text-success">Salvo.</p>}
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}
