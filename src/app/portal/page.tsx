import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { getDb } from "@/db/client";
import { clients } from "@/db/schema";
import { requireCustomer } from "@/lib/auth/current-user";
import { formatCents } from "@/lib/format";
import { portalCatalog } from "@/lib/orders";
import { getMarkupBp } from "@/lib/pricing";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { DEFAULT_SEGMENT, isSegment } from "@/lib/segments";
import { AddToCart } from "./portal-ui";

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
      <PageHeader
        title="Produtos"
        description="Escolha os produtos e a quantidade, depois envie o pedido pelo carrinho."
      />
      <form action="/portal" className="card mb-4 flex gap-2 p-3">
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por código, nome, marca ou aplicação…"
          aria-label="Buscar produtos"
        />
        <button type="submit" className="btn-primary">
          Buscar
        </button>
      </form>

      {result.products.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Nenhum produto encontrado.
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {result.products.map((product) => (
            <li
              key={product.partId}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{product.description}</div>
                <div className="text-xs text-slate-500">
                  {product.code}
                  {product.brand && ` · ${product.brand}`}
                </div>
                {product.application && (
                  <div className="text-xs text-slate-500">{product.application}</div>
                )}
              </div>
              <div className="sm:w-40 sm:text-right">
                <div
                  className={
                    product.priceCents === null ? "text-slate-400 italic" : "font-semibold"
                  }
                >
                  {formatCents(product.priceCents)}
                </div>
                {product.tiers.map((tier) => (
                  <div key={tier.minQuantity} className="text-xs text-green-700">
                    a partir de {tier.minQuantity} un: {formatCents(tier.priceCents)}
                  </div>
                ))}
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
