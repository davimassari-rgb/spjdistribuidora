import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { CatalogRow, Offer } from "@/lib/catalog/queries";
import { formatCents } from "@/lib/format";

function Price({ row }: { row: CatalogRow }) {
  return (
    <div className="num text-right whitespace-nowrap">
      <div
        className={row.priceCents === null ? "text-ink-subtle italic" : "font-semibold text-ink"}
      >
        {formatCents(row.priceCents)}
      </div>
      {row.tiers.map((tier) => (
        <div key={tier.minQuantity} className="caption">
          {tier.minQuantity}+ un: {formatCents(tier.priceCents)}
        </div>
      ))}
    </div>
  );
}

/** Diferença percentual do preço do outro fornecedor em relação ao desta linha. */
function diffPercent(offer: number, current: number): string {
  const pct = ((offer - current) / current) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function Offers({ row }: { row: CatalogRow }) {
  if (row.otherOffers.length === 0) return <span className="text-ink-subtle">—</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {row.otherOffers.map((offer: Offer) => {
        const comparable = offer.priceCents !== null && row.priceCents !== null;
        const cheaperElsewhere =
          comparable && (offer.priceCents as number) < (row.priceCents as number);
        const thisIsCheaper =
          comparable && (offer.priceCents as number) > (row.priceCents as number);
        const style = cheaperElsewhere
          ? "badge-danger"
          : thisIsCheaper
            ? "badge-success"
            : "badge-neutral";
        return (
          <span
            key={offer.partId}
            className={`${style} num`}
            title={
              cheaperElsewhere
                ? "Este outro fornecedor está mais barato"
                : thisIsCheaper
                  ? "O preço desta linha é o menor"
                  : undefined
            }
          >
            {offer.supplierName}: {formatCents(offer.priceCents)}
            {comparable && offer.priceCents !== row.priceCents && (
              <strong>({diffPercent(offer.priceCents as number, row.priceCents as number)})</strong>
            )}
          </span>
        );
      })}
    </div>
  );
}

function InactiveBadge() {
  return <span className="badge-neutral ml-2 font-normal">Indisponível</span>;
}

export function PartsTable({
  rows,
  showSupplier = true,
}: {
  rows: CatalogRow[];
  showSupplier?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Nenhuma peça encontrada"
        description="Tente outro termo de busca ou remova algum filtro."
      />
    );
  }
  return (
    <>
      {/* Celular: cartões */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className={`card p-3 ${row.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold">
                  {row.code}
                  {!row.active && <InactiveBadge />}
                </div>
                <div className="text-sm">{row.description}</div>
                <div className="caption">
                  {[row.brand, showSupplier ? row.supplierName : null].filter(Boolean).join(" · ")}
                </div>
                {row.application && <div className="caption mt-1">{row.application}</div>}
              </div>
              <Price row={row} />
            </div>
            {row.otherOffers.length > 0 && (
              <div className="mt-2">
                <Offers row={row} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Computador: tabela com cabeçalho fixo */}
      <div className="card hidden max-h-[calc(100vh-15rem)] overflow-auto md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição / aplicação</th>
              <th>Marca</th>
              {showSupplier && <th>Fornecedor</th>}
              <th className="text-right!">Preço</th>
              <th>Em outros fornecedores</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.active ? "" : "opacity-60"}>
                <td className="font-mono font-semibold whitespace-nowrap">
                  {row.code}
                  {!row.active && <InactiveBadge />}
                </td>
                <td>
                  <div className="text-ink">{row.description}</div>
                  {row.application && <div className="caption">{row.application}</div>}
                </td>
                <td className="whitespace-nowrap">{row.brand ?? "—"}</td>
                {showSupplier && <td className="whitespace-nowrap">{row.supplierName}</td>}
                <td>
                  <Price row={row} />
                </td>
                <td>
                  <Offers row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
