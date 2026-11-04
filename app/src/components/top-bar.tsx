import Link from "next/link";
import { Check, LogOut, Settings, Trophy } from "lucide-react";
import type { User, Workspace } from "@/lib/auth";
import { query } from "@/lib/db";
import { money } from "@/lib/format";
import { progress, shortMoney, TIERS } from "@/lib/milestones";
import { Dropdown } from "./client";
import { Logo } from "./logo";
import { logout } from "../app/(auth)/actions";

// Barra de cima: conquistas de faturamento e o menu da conta.
export async function TopBar({ user, ws }: { user: User; ws: Workspace }) {
  // Faturamento aprovado desde o começo e o dia em que cada degrau foi batido.
  const [rows, [tot]] = await Promise.all([
    query<{ tier: string; at: string | null }>(
      `with c as (
         select approved_at, sum(amount_cents) over (order by approved_at, id) as cum
         from orders where workspace_id = $1 and status = 'approved' and approved_at is not null)
       select t::text as tier, min(c.approved_at) as at
       from unnest($2::bigint[]) t left join c on c.cum >= t group by t order by t`,
      [ws.id, TIERS],
    ),
    query<{ total: string }>("select coalesce(sum(amount_cents),0) as total from orders where workspace_id = $1 and status = 'approved'", [ws.id]),
  ]);
  const p = progress(Number(tot.total));
  const when = new Map(rows.map((r) => [Number(r.tier), r.at]));
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const label = p.next === null ? "Todas as conquistas batidas" : `Próxima conquista: ${shortMoney(p.next)}`;

  return (
    <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-4 md:px-8">
      <span aria-hidden />
      <Link href="/hoje" aria-label="Clickify, ir para Hoje" className="rounded-md px-2 py-1 hover:opacity-90">
        <Logo size="xl" />
      </Link>
      <div className="flex items-center justify-end gap-2">
      <Dropdown label={`Conquistas. ${label}. Faturado até agora: ${money(p.total)}`} summary={
        <>
          <Trophy aria-hidden className={`size-4 shrink-0 ${p.reached.length ? "text-warning" : "text-muted"}`} />
          <span className="hidden flex-col gap-1 sm:flex">
            <span className="text-xs tabular-nums">
              <b>{shortMoney(p.total)}</b>
              <span className="text-muted"> / {p.next === null ? "tudo batido" : shortMoney(p.next)}</span>
            </span>
            <span className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="block h-full rounded-full bg-gradient-to-r from-brand-mint to-brand-green" style={{ width: `${Math.max(2, p.pct * 100)}%` }} />
            </span>
          </span>
        </>
      }>
        <p className="text-sm font-semibold">Conquistas de faturamento</p>
        <p className="mt-0.5 text-xs text-muted">
          {money(p.total)} em vendas aprovadas desde o começo.
          {p.next !== null && <> Faltam <b className="text-text">{money(p.missing)}</b> para {shortMoney(p.next)}.</>}
        </p>
        <ol className="mt-3 space-y-1.5">
          {TIERS.map((t) => {
            const at = when.get(t);
            const isNext = t === p.next;
            return (
              <li key={t} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ${isNext ? "bg-surface-2" : ""}`}>
                <span className="flex items-center gap-2">
                  {at ? <Check aria-hidden className="size-4 text-success" /> : <Trophy aria-hidden className={`size-4 ${isNext ? "text-warning" : "text-border-input"}`} />}
                  <span className={at ? "" : isNext ? "font-semibold" : "text-muted"}>{shortMoney(t)}</span>
                </span>
                <span className="text-xs tabular-nums text-muted">
                  {at ? `batida em ${new Date(at).toLocaleDateString("pt-BR", { timeZone: ws.timezone })}` : isNext ? `${Math.floor(p.pct * 100)}%` : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </Dropdown>

      <Dropdown label={`Menu da conta (${user.name})`} summary={
        <>
          <span className="hidden text-right sm:block">
            <span className="block max-w-40 truncate text-sm font-semibold leading-tight">{user.name}</span>
            <span className="block text-xs leading-tight text-muted">Dono da conta</span>
          </span>
          <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">{initials}</span>
        </>
      }>
        <p className="truncate text-sm font-semibold" title={user.name}>{user.name}</p>
        <p className="truncate text-xs text-muted" title={user.email}>{user.email}</p>
        <p className="mt-0.5 truncate text-xs text-muted" title={ws.name}>{ws.name}</p>
        <div className="mt-3 border-t border-border pt-2">
          <Link href="/configuracoes" className="flex h-9 items-center gap-3 rounded-md px-2 text-sm hover:bg-surface-2">
            <Settings aria-hidden className="size-4" /> Configurações
          </Link>
          <form action={logout}>
            <button className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
              <LogOut aria-hidden className="size-4" /> Sair
            </button>
          </form>
        </div>
      </Dropdown>
      </div>
    </div>
  );
}
