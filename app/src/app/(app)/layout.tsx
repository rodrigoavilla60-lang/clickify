import { BarChart3, Cable, Calculator, CircleCheck, Megaphone, Receipt, Store, Sun } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { one } from "@/lib/db";
import { NavLink } from "@/components/client";
import { TopBar } from "@/components/top-bar";

// Menu curto: o dia a dia em cima, o que se configura uma vez embaixo. Checkouts, contas de
// anúncio e UTMs ficam juntos em "Conexões", com abas dentro da tela.
const NAV = [
  { href: "/hoje", label: "Hoje", icon: Sun },
  { href: "/dashboard", label: "Resumo", icon: BarChart3 },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/vendas", label: "Vendas", icon: Receipt },
  { href: "/custos", label: "Custos", icon: Calculator },
  { href: "/integracoes", label: "Conexões", icon: Cable, also: ["/contas", "/utms", "/pixel"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ws } = await requireWorkspace();
  // "Primeiros passos" só aparece enquanto falta ligar conta de anúncio ou checkout.
  const setup = await one<{ accounts: number; hooks: number }>(
    `select (select count(*) from ad_accounts where workspace_id = $1 and enabled)::int as accounts,
            (select count(*) from webhooks where workspace_id = $1)::int as hooks`,
    [ws.id],
  );
  const incomplete = !setup?.accounts || !setup?.hooks;
  return (
    <div className="md:flex">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">
        Pular para o conteúdo
      </a>
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <details className="group md:contents" open>
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-4 md:pointer-events-none">
            {/* A logo fica no centro da barra de cima; aqui, a operação em que você está. */}
            <span className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-brand-green">
                <Store className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight" title={ws.name}>{ws.name}</span>
                <span className="block text-xs leading-tight text-muted">Operação</span>
              </span>
            </span>
            <span className="text-xs text-muted md:hidden">Menu</span>
          </summary>
          <div className="flex flex-col gap-1 px-3 pb-4 pt-2 md:h-[calc(100dvh-56px)]">
            <nav aria-label="Principal" className="flex flex-col gap-1">
              {incomplete && (
                <NavLink href="/onboarding"><CircleCheck aria-hidden className="size-4" /> Primeiros passos</NavLink>
              )}
              {NAV.map(({ href, label, icon: Icon, also }) => (
                <NavLink key={href} href={href} also={also}>
                  <Icon aria-hidden className="size-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </details>
      </aside>
      <div className="min-w-0 flex-1">
        <TopBar user={user} ws={ws} />
        <main id="conteudo" className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
