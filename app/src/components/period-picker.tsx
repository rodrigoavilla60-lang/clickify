import Link from "next/link";
import { PERIODS } from "@/lib/period";

// Período vai na URL (?p=7d) para o link poder ser compartilhado.
export function PeriodPicker({ current, base, keep = {} }: {
  current: string; base: string; keep?: Record<string, string | undefined>;
}) {
  return (
    <nav aria-label="Período" className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1">
      {PERIODS.map((p) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
        q.set("p", p.key);
        const active = p.key === current;
        return (
          <Link
            key={p.key}
            href={`${base}?${q}`}
            aria-current={active ? "true" : undefined}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium ${active ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
