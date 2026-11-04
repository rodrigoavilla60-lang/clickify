import { type NextRequest } from "next/server";
import { currentUser, requireWorkspace } from "@/lib/auth";
import { resolvePeriod } from "@/lib/period";
import { derive, levelRows } from "@/lib/metrics";
import { COLUMNS } from "@/lib/columns";
import type { Level } from "@/lib/meta";
import { centsToNumber, csvResponse, toCsv } from "@/lib/csv";

const LEVEL: Record<Level, string> = { campaign: "campanhas", adset: "conjuntos", ad: "anuncios" };

// Exporta todas as colunas do catálogo, não só as visíveis: planilha é para cruzar à vontade.
export async function GET(req: NextRequest) {
  if (!(await currentUser())) return new Response("não autorizado", { status: 401 });
  const { ws } = await requireWorkspace();
  const sp = req.nextUrl.searchParams;
  const period = resolvePeriod(sp.get("p") ?? undefined, ws.timezone);
  const nivel = sp.get("nivel");
  const level: Level = nivel === "adset" || nivel === "ad" ? nivel : "campaign";
  const pai = sp.get("pai");
  const parent = level !== "campaign" && pai && /^\d+$/.test(pai) ? pai : undefined;
  const st = sp.get("status");
  const rows = await levelRows(ws, level, period.from, period.to, parent, {
    search: (sp.get("q") ?? "").slice(0, 80),
    status: st === "ACTIVE" || st === "PAUSED" ? st : undefined,
  });
  const csv = toCsv(
    ["Nome", "Status", "Conta", "Plataforma", "Orçamento/dia (R$)", ...COLUMNS.map((c) => (c.format === "money" ? `${c.label} (R$)` : c.label))],
    rows.map((r) => {
      const b = { ...r, profit: derive(ws, r.revenue, r.spend, r.sales, r.productCost).profit };
      return [
        r.name, r.status === "ACTIVE" ? "Ativo" : "Pausado", r.accountName, "Meta", centsToNumber(r.budget),
        ...COLUMNS.map((c) => {
          const v = c.value(b);
          if (v === null) return null;
          if (c.format === "money") return centsToNumber(v);
          if (c.format === "int") return Math.round(v);
          return Math.round(v * 10000) / 10000;
        }),
      ];
    }),
  );
  return csvResponse(`clickify-${LEVEL[level]}-${period.from}_a_${period.to}.csv`, csv);
}
