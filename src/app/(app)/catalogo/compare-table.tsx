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
    <div className="card divide-y divide-line">
      {rows.map((row) => {
        const best = row.offers[0]?.priceCents ?? null;
        return (
          <div key={row.codeKey} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
            <div className="min-w-0 md:w-1/3">
              <div className="font-mono text-sm font-semibold">{row.codeKey}</div>
              <div className="text-sm">{row.description}</div>
              {row.brand && <div className="caption">{row.brand}</div>}
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              {row.offers.map((offer) => {
                const isBest = best !== null && offer.priceCents === best;
                return (
                  <div
                    key={offer.partId}
                    className={`rounded-ui border px-3 py-1.5 text-sm ${
                      isBest ? "border-success-border bg-success-bg" : "border-line"
                    }`}
                  >
                    <div className="caption">
                      {offer.supplierName} · {offer.code}
                    </div>
                    <div className="num flex items-baseline gap-2 font-semibold">
                      {formatCents(offer.priceCents)}
                      {isBest ? (
                        <span className="text-xs font-medium text-success">menor preço</span>
                      ) : (
                        best !== null &&
                        offer.priceCents !== null && (
                          <span className="text-xs font-medium text-danger">
                            +
                            {(((offer.priceCents - best) / best) * 100).toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}
                            %
                          </span>
                        )
                      )}
                    </div>
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
