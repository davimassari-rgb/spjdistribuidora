import type { ComparisonRow } from "@/lib/catalog/queries";
import { formatCents } from "@/lib/format";

/** Mesma peça (código normalizado) em vários fornecedores, do menor para o maior preço. */
export function CompareTable({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        Nenhuma peça em comum entre os fornecedores com esses filtros. A comparação usa o código da
        peça (ignorando hífens, pontos e espaços).
      </div>
    );
  }
  return (
    <div className="card divide-y divide-slate-100">
      {rows.map((row) => {
        const best = row.offers[0]?.priceCents ?? null;
        return (
          <div key={row.codeKey} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
            <div className="min-w-0 md:w-1/3">
              <div className="font-mono text-sm font-semibold">{row.codeKey}</div>
              <div className="text-sm">{row.description}</div>
              {row.brand && <div className="text-xs text-slate-500">{row.brand}</div>}
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              {row.offers.map((offer) => {
                const isBest = best !== null && offer.priceCents === best;
                return (
                  <div
                    key={offer.partId}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      isBest ? "border-green-300 bg-green-50" : "border-slate-200"
                    }`}
                  >
                    <div className="text-xs text-slate-500">
                      {offer.supplierName} · {offer.code}
                    </div>
                    <div className="font-semibold">{formatCents(offer.priceCents)}</div>
                  </div>
                );
              })}
            </div>
            {row.spreadCents !== null && row.spreadCents > 0 && (
              <div className="text-xs whitespace-nowrap text-slate-500">
                Diferença: <strong>{formatCents(row.spreadCents)}</strong>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
