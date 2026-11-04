import { type NextRequest } from "next/server";
import { currentUser, requireWorkspace } from "@/lib/auth";
import { resolvePeriod } from "@/lib/period";
import { UTM_FIELDS, utmReport, type UtmField } from "@/lib/sales";
import { centsToNumber, csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  if (!(await currentUser())) return new Response("não autorizado", { status: 401 });
  const { ws } = await requireWorkspace();
  const sp = req.nextUrl.searchParams;
  const period = resolvePeriod(sp.get("p") ?? undefined, ws.timezone);
  const by = sp.get("por");
  const field: UtmField = (UTM_FIELDS as readonly string[]).includes(by ?? "") ? (by as UtmField) : "utm_campaign";
  const rows = await utmReport(ws, period.from, period.to, field);
  const csv = toCsv(
    [field, "Pedidos", "Vendas aprovadas", "Faturamento (R$)", "Gasto (R$)", "ROAS"],
    rows.map((r) => [
      r.key ?? "(sem UTM)", r.orders, r.sales, centsToNumber(r.revenue), centsToNumber(r.spend),
      r.spend ? Math.round((r.revenue / r.spend) * 100) / 100 : null,
    ]),
  );
  return csvResponse(`clickify-${field}-${period.from}_a_${period.to}.csv`, csv);
}
