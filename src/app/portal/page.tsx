import { eq } from "drizzle-orm";
import { PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { getDb } from "@/db/client";
import { clients } from "@/db/schema";
import { requireCustomer } from "@/lib/auth/current-user";
import { formatCents } from "@/lib/format";
import { portalCatalog } from "@/lib/orders";
import { getMarkupBp } from "@/lib/pricing";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { DEFAULT_SEGMENT, isSegment, segmentLabel } from "@/lib/segments";
import { AddToCart, PortalSearch } from "./portal-ui";

export const metadata: Metadata = { title: "Produtos" };

/** Catálogo do cliente final: produtos do segmento dele com preço de venda. */
export default async function PortalCatalogPage(props: PageProps<"/portal">) {
  const user = await requireCustomer();
  const params = (await props.searchParams) as SearchParams;
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, user.clientId));
  const segment = client && isSegment(client.segment) ? client.segment : DEFAULT_SEGMENT;
  const q = param(params, "q");
  const result = await portalCatalog(db, {
    segment,
    markupBp: await getMarkupBp(db, segment),
    q,
    page: pageParam(params),
  });

  return (
    <>
      <section className="mb-6 rounded-ui bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-white shadow-pop sm:px-8 sm:py-8">
        <p className="text-sm text-brand-100">Olá, {client?.tradeName ?? user.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Do que você precisa hoje?
        </h1>
        <p className="mt-1 text-sm text-brand-100">
          Catálogo de {segmentLabel(segment).toLowerCase()} com entrega pela SPJ. Escolha, envie o
          pedido e acompanhe por aqui.
        </p>
        <div className="mt-5 max-w-2xl text-ink">
          <PortalSearch initial={q} />
        </div>
      </section>

      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="section-title">{q ? `Resultados para “${q}”` : "Produtos mais pedidos"}</h2>
        <span className="caption num">{result.total.toLocaleString("pt-BR")} produto(s)</span>
      </div>

      {result.products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum produto encontrado"
          description="Tente buscar pelo código, pela marca ou pela aplicação. Se não encontrar, fale com a SPJ: conseguimos cotar sob demanda."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.products.map((product) => (
            <li
              key={product.partId}
              className="card flex flex-col gap-3 p-4 transition hover:shadow-pop"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-ink-subtle">{product.code}</span>
                {product.brand && <span className="badge-neutral">{product.brand}</span>}
              </div>
              <div className="flex-1">
                <h3 className="leading-snug font-semibold text-ink">{product.description}</h3>
                {product.application && (
                  <p className="caption mt-1 line-clamp-2">{product.application}</p>
                )}
              </div>
              <div>
                {product.priceCents === null ? (
                  <p className="text-sm font-medium text-ink-subtle italic">Sob consulta</p>
                ) : (
                  <p className="num text-2xl font-semibold text-ink">
                    {formatCents(product.priceCents)}
                  </p>
                )}
                {product.tiers.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {product.tiers.map((tier) => (
                      <span key={tier.minQuantity} className="badge-success num">
                        {tier.minQuantity}+ un: {formatCents(tier.priceCents)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <AddToCart product={product} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        path="/portal"
        params={params}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />
    </>
  );
}
