"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Loader2 } from "lucide-react";
import { buttonClass } from "./ui";

export function SubmitButton({ children, variant = "primary", className = "" }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, "md", className)}>
      {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function NavLink({ href, also = [], children }: { href: string; also?: string[]; children: React.ReactNode }) {
  const path = usePathname();
  const active = [href, ...also].some((h) => path === h || path.startsWith(`${h}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center gap-3 rounded-md px-3 text-sm ${
        active ? "bg-surface-2 font-semibold text-text" : "text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

// Menu que abre ao clicar (barra de cima). <details> funciona sem JavaScript; com ele, fecha ao
// clicar fora, com Esc e ao navegar.
export function Dropdown({ summary, label, children, align = "right" }: {
  summary: React.ReactNode; label: string; children: React.ReactNode; align?: "left" | "right";
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) {
        d.open = false;
        if (e instanceof KeyboardEvent) d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details ref={ref} className="group relative">
      <summary aria-label={label} className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div className={`absolute top-full z-30 mt-2 w-72 rounded-lg border border-border bg-surface p-3 shadow-pop ${align === "right" ? "right-0" : "left-0"}`}>
        {children}
      </div>
    </details>
  );
}

// Abas de "Conexões": o que liga o Clickify ao resto (checkouts, contas de anúncio, links com UTM).
const CONNECTIONS = [
  { href: "/integracoes", label: "Checkouts" },
  { href: "/contas", label: "Contas de anúncio" },
  { href: "/utms", label: "UTMs" },
  { href: "/pixel", label: "Pixel" },
];

export function ConnectionsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Conexões" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {CONNECTIONS.map((t) => {
        const on = path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm ${on ? "border-accent font-semibold" : "border-transparent text-muted hover:text-text"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CopyField({ value, label, onCopy }: { value: string; label: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <code tabIndex={0} aria-label={label} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-xs">
        {value}
      </code>
      <button
        type="button"
        // Com mais de um campo na tela, "Copiar" sozinho não diz o quê.
        aria-label={`${copied ? "Copiado" : "Copiar"}: ${label}`}
        className={buttonClass("secondary", "md")}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          onCopy?.();
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
        <span aria-live="polite">{copied ? "Copiado" : "Copiar"}</span>
      </button>
    </div>
  );
}

// Liga/desliga no Meta. Pede confirmação antes (um clique solto mexia numa campanha real),
// depois é otimista: volta ao estado anterior se a API falhar.
// Botão de uma decisão da tela Hoje: pede confirmação e roda a ação já presa ao objeto
// (server action com .bind no servidor), então nenhum ID ou valor vem do navegador.
export function DecisionButton({ id, label, question, detail, danger, action }: {
  id: string; label: string; question: string; detail: string; danger?: boolean;
  action: () => Promise<{ error?: string }>;
}) {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!asking) return;
    dialog.current?.showModal();
    confirmButton.current?.focus();
  }, [asking]);

  const confirm = () => {
    dialog.current?.close();
    setError(undefined);
    start(async () => {
      const r = await action();
      if (r.error) setError(r.error);
      else {
        setDone(true);
        router.refresh();
      }
    });
  };

  if (done) return <span role="status" className="inline-flex items-center gap-1 text-sm text-success"><Check aria-hidden className="size-4" /> Feito</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {asking && <dialog
        ref={dialog}
        onClose={() => setAsking(false)}
        aria-labelledby={`decision-${id}`}
        className="m-auto w-[min(380px,calc(100vw-32px))] rounded-lg border border-border bg-surface p-5 text-text shadow-pop backdrop:bg-bg/70"
      >
        <p id={`decision-${id}`} className="font-semibold">{question}</p>
        <p className="mt-1 text-sm text-muted">{detail}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonClass("ghost", "md")} onClick={() => dialog.current?.close()}>Cancelar</button>
          <button type="button" ref={confirmButton} className={buttonClass(danger ? "danger" : "primary", "md")} onClick={confirm}>Confirmar</button>
        </div>
      </dialog>}
      <button type="button" aria-haspopup="dialog" disabled={pending} className={buttonClass(danger ? "danger" : "primary", "sm")}
        onClick={() => { setError(undefined); setAsking(true); }}>
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} {label}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function StatusToggle({ id, name, active, action }: {
  id: string; name: string; active: boolean;
  action: (id: string, next: "ACTIVE" | "PAUSED") => Promise<{ error?: string }>;
}) {
  const [on, setOn] = useState(active);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const next = !on;

  // Só existe enquanto aberto: uma janela por linha da tabela duplicaria os nomes na página.
  // O foco vai para "Confirmar" depois do showModal(), que senão o leva para o 1º botão.
  useEffect(() => {
    if (!asking) return;
    dialog.current?.showModal();
    confirmButton.current?.focus();
  }, [asking]);

  const confirm = () => {
    dialog.current?.close();
    setOn(next);
    setError(undefined);
    start(async () => {
      const r = await action(id, next ? "ACTIVE" : "PAUSED");
      if (r.error) {
        setOn(!next);
        setError(r.error);
      } else router.refresh();
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      {asking && <dialog
        ref={dialog}
        onClose={() => setAsking(false)}
        aria-labelledby={`confirm-${id}`}
        className="m-auto w-[min(360px,calc(100vw-32px))] rounded-lg border border-border bg-surface p-5 text-text shadow-pop backdrop:bg-bg/70"
      >
        <p id={`confirm-${id}`} className="font-semibold">{next ? "Ativar" : "Pausar"} &quot;{name}&quot; no Meta?</p>
        <p className="mt-1 text-sm text-muted">
          {next ? "Ela volta a veicular e a gastar o orçamento." : "Ela para de veicular e de gastar até você ativar de novo."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonClass("ghost", "md")} onClick={() => dialog.current?.close()}>Cancelar</button>
          <button type="button" ref={confirmButton} className={buttonClass(next ? "primary" : "danger", "md")} onClick={confirm}>Confirmar</button>
        </div>
      </dialog>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-haspopup="dialog"
        aria-label={`${on ? "Pausar" : "Ativar"} ${name}`}
        disabled={pending}
        onClick={() => {
          setError(undefined);
          setAsking(true);
        }}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
          on ? "border-success bg-success" : "border-border-input bg-surface-2"
        }`}
      >
        <span className={`absolute top-0.5 size-3.5 rounded-full bg-text transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function BudgetEditor({ id, cents, action }: {
  id: string; cents: number;
  action: (id: string, cents: number) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((cents / 100).toFixed(2).replace(".", ","));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} className="tabular-nums underline decoration-dotted underline-offset-4 hover:text-accent" aria-label={`Editar orçamento diário, atual ${label}`}>
        {label}
      </button>
    );
  return (
    <form
      className="inline-flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
        if (!Number.isFinite(n) || n < 100) return setError("Mínimo R$ 1,00");
        start(async () => {
          const r = await action(id, n);
          if (r.error) setError(r.error);
          else {
            setEditing(false);
            router.refresh();
          }
        });
      }}
    >
      <input
        autoFocus
        aria-label="Novo orçamento diário em reais"
        aria-invalid={!!error}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        inputMode="decimal"
        className="h-8 w-24 rounded-sm border border-border-input bg-bg px-2 text-right text-sm tabular-nums"
      />
      <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : "OK"}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </form>
  );
}
