import type { CatalogRow, Offer } from "@/lib/catalog/queries";
import { formatCents } from "@/lib/format";

function Price({ row }: { row: CatalogRow }) {
  return (
    <div className="whitespace-nowrap">
      <div className={row.priceCents === null ? "text-slate-400 italic" : "font-semibold"}>
        {formatCents(row.priceCents)}
      </div>
      {row.tiers.map((tier) => (
        <div key={tier.minQuantity} className="text-xs text-slate-500">
          {tier.minQuantity}+ un: {formatCents(tier.priceCents)}
        </div>
      ))}
    </div>
  );
}

function Offers({ row }: { row: CatalogRow }) {
  if (row.otherOffers.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {row.otherOffers.map((offer: Offer) => {
        const cheaper =
          offer.priceCents !== null && row.priceCents !== null && offer.priceCents < row.priceCents;
        const pricier =
          offer.priceCents !== null && row.priceCents !== null && offer.priceCents > row.priceCents;
        return (
          <span
            key={offer.partId}
            className={`inline-block w-fit whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${
              cheaper
                ? "bg-amber-100 text-amber-800"
                : pricier
                  ? "bg-green-50 text-green-700"
                  : "bg-slate-100 text-slate-600"
            }`}
            title={cheaper ? "Mais barato no outro fornecedor" : undefined}
          >
            {offer.supplierName}: {formatCents(offer.priceCents)}
          </span>
        );
      })}
    </div>
  );
}

function InactiveBadge() {
  return (
    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-600">
      Indisponível
    </span>
  );
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
      <div className="card p-8 text-center text-sm text-slate-500">Nenhuma peça encontrada.</div>
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
                <div className="text-xs text-slate-500">
                  {[row.brand, showSupplier ? row.supplierName : null].filter(Boolean).join(" · ")}
                </div>
                {row.application && (
                  <div className="mt-1 text-xs text-slate-500">{row.application}</div>
                )}
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

      {/* Computador: tabela */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Descrição / aplicação</th>
              <th className="px-3 py-2 font-medium">Marca</th>
              {showSupplier && <th className="px-3 py-2 font-medium">Fornecedor</th>}
              <th className="px-3 py-2 font-medium">Preço</th>
              <th className="px-3 py-2 font-medium">Em outros fornecedores</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 align-top last:border-0 ${row.active ? "" : "opacity-60"}`}
              >
                <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                  {row.code}
                  {!row.active && <InactiveBadge />}
                </td>
                <td className="px-3 py-2">
                  <div>{row.description}</div>
                  {row.application && (
                    <div className="text-xs text-slate-500">{row.application}</div>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{row.brand ?? "—"}</td>
                {showSupplier && (
                  <td className="px-3 py-2 whitespace-nowrap">{row.supplierName}</td>
                )}
                <td className="px-3 py-2">
                  <Price row={row} />
                </td>
                <td className="px-3 py-2">
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
