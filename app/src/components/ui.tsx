import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold text-sm whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "h-8 px-3", md: "h-10 px-4" };
  const variants = {
    primary: "bg-accent text-on-accent hover:brightness-110",
    secondary: "bg-surface-2 text-text border border-border hover:border-border-input",
    ghost: "text-muted hover:text-text hover:bg-surface-2",
    danger: "bg-surface-2 text-danger border border-border hover:border-danger",
  };
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`;
}

export function Button({
  variant, size, className = "", ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant, size, className = "", ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className = "", ...rest }: ComponentProps<"section">) {
  return <section className={`rounded-lg border border-border bg-surface p-4 md:p-6 ${className}`} {...rest} />;
}

// "ⓘ" com a explicação da métrica. Só CSS: abre no mouse e no foco do teclado, e o texto fica
// ligado ao botão (aria-describedby) para leitor de tela.
let tipSeq = 0;
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = `dica-${label.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${tipSeq++ % 1000}`;
  return (
    <span className="group relative inline-flex shrink-0">
      <button type="button" aria-label={`O que é ${label}?`} aria-describedby={id}
        className="flex size-6 items-center justify-center rounded-full text-muted hover:text-text focus-visible:text-text">
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v3.8M8 5v.01" strokeLinecap="round" />
        </svg>
      </button>
      <span id={id} role="tooltip"
        className="invisible absolute right-0 top-7 z-20 w-64 rounded-md border border-border bg-surface-2 p-3 text-left text-xs font-normal leading-relaxed text-text opacity-0 shadow-pop transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {children}
      </span>
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold md:text-[28px] md:leading-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Label({ className = "", ...rest }: ComponentProps<"label">) {
  return <label className={`mb-1 block text-xs font-medium text-muted ${className}`} {...rest} />;
}

const field =
  "h-10 w-full rounded-md border border-border-input bg-surface px-3 text-sm text-text placeholder:text-muted aria-[invalid=true]:border-danger";

export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return <input className={`${field} ${className}`} {...rest} />;
}

export function Select({ className = "", ...rest }: ComponentProps<"select">) {
  return <select className={`${field} ${className}`} {...rest} />;
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1 text-xs text-danger">
      {children}
    </p>
  );
}

const BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: "Aprovada", cls: "text-success" },
  pending: { label: "Pendente", cls: "text-warning" },
  refused: { label: "Recusada", cls: "text-muted" },
  refunded: { label: "Reembolsada", cls: "text-muted" },
  chargeback: { label: "Chargeback", cls: "text-danger" },
  ACTIVE: { label: "Ativo", cls: "text-success" },
  PAUSED: { label: "Pausado", cls: "text-muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const b = BADGE[status] ?? { label: status, cls: "text-muted" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm bg-surface-2 px-2 py-0.5 text-xs font-medium ${b.cls}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {b.label}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: {
  icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const cls = { info: "text-text", warning: "text-warning", danger: "text-danger", success: "text-success" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`mb-4 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}
