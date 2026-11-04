import { type NextRequest } from "next/server";
import { currentUser, requireWorkspace } from "@/lib/auth";
import { resolvePeriod } from "@/lib/period";
import { listSales } from "@/lib/sales";
import { centsToNumber, csvResponse, toCsv } from "@/lib/csv";
import { isPlatform, PLATFORMS } from "@/lib/platforms";

const STATUS: Record<string, string> = {
  approved: "Aprovada", pending: "Pendente", refused: "Recusada", refunded: "Reembolsada", chargeback: "Chargeback",
};
const PAY: Record<string, string> = { pix: "Pix", card: "Cartão", boleto: "Boleto", other: "Outros" };

export async function GET(req: NextRequest) {
  if (!(await currentUser())) return new Response("não autorizado", { status: 401 });
  const { ws } = await requireWorkspace();
  const sp = req.nextUrl.searchParams;
  const period = resolvePeriod(sp.get("p") ?? undefined, ws.timezone);
  const rows = await listSales(ws, period.from, period.to, sp.get("s") ?? "", (sp.get("q") ?? "").trim().slice(0, 80), 10000);
  const date = (d: string | null) =>
    d ? new Intl.DateTimeFormat("pt-BR", { timeZone: ws.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "";
  const csv = toCsv(
    ["Data do pedido", "Pedido", "Status", "Valor (R$)", "Moeda", "Produto", "Checkout", "Pagamento", "Aprovado em",
      "Campanha", "Conjunto", "Anúncio", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"],
    rows.map((r) => [
      date(r.ordered_at), r.external_id, STATUS[r.status] ?? r.status, centsToNumber(Number(r.amount_cents)), r.currency,
      r.product_name, isPlatform(r.platform) ? PLATFORMS[r.platform].label : r.platform,
      r.payment_method ? PAY[r.payment_method] ?? r.payment_method : "", date(r.approved_at),
      r.campaign, r.adset, r.ad, r.utm_source, r.utm_campaign, r.utm_medium, r.utm_content, r.utm_term,
    ]),
  );
  return csvResponse(`clickify-vendas-${period.from}_a_${period.to}.csv`, csv);
}
