import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { daysAgoLabel, FreshnessDot } from "@/components/supplier-status";
import { getDb } from "@/db/client";
import {
  comparePrices,
  countSharedCodes,
  listBrands,
  listSuppliers,
  searchParts,
} from "@/lib/catalog/queries";
import { pageParam, param, type SearchParams, withParams } from "@/lib/search-params";
import { getCurrentSegment } from "@/lib/segment-server";
import { CompareTable } from "./compare-table";
import { CatalogFilters } from "./filters";
import { PartsTable } from "./parts-table";

export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage(props: PageProps<"/catalogo">) {
  const params = (await props.searchParams) as SearchParams;
  const db = getDb();
  const compare = param(params, "visao") === "comparar";
  const segment = await getCurrentSegment();
  const filters = {
    segment,
    q: param(params, "q"),
    supplierId: param(params, "fornecedor"),
    brand: param(params, "marca"),
    status: param(params, "situacao"),
    page: pageParam(params),
  };

  const [supplierList, brands, sharedCount] = await Promise.all([
    listSuppliers(db, segment),
    listBrands(db, undefined, segment),
    countSharedCodes(db, segment),
  ]);
  const validSupplier = supplierList.some((s) => s.id === filters.supplierId);
  if (!validSupplier) filters.supplierId = undefined;

  const totalActive = supplierList.reduce((sum, s) => sum + s.activeCount, 0);
  return (
    <>
      <PageHeader
        title="Catálogo"
        description={
          supplierList.length === 0 ? (
            <>
              Nenhum fornecedor cadastrado ainda.{" "}
              <Link className="font-medium text-brand-700 underline" href="/fornecedores">
                Cadastre um fornecedor e importe a planilha
              </Link>
              .
            </>
          ) : (
            <>
              <span className="num font-semibold text-ink">
                {totalActive.toLocaleString("pt-BR")}
              </span>{" "}
              peças disponíveis em {supplierList.length} fornecedor(es)
            </>
          )
        }
      />

      {supplierList.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="Atualização dos fornecedores">
          {supplierList.map((s) => (
            <li key={s.id}>
              <Link
                href={`/fornecedores/${s.id}`}
                className="card flex items-center gap-2 px-3 py-2 text-sm transition hover:border-line-strong hover:shadow-pop"
              >
                <FreshnessDot lastImportAt={s.lastImportAt} />
                <span className="font-medium text-ink">{s.name}</span>
                <span className="num text-ink-subtle">
                  {s.activeCount.toLocaleString("pt-BR")} peças
                </span>
                <span className="caption">· {daysAgoLabel(s.lastImportAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div
        role="tablist"
        className="mb-4 inline-flex rounded-ui border border-line bg-surface-sunken p-1"
      >
        {[
          {
            active: !compare,
            href: withParams("/catalogo", params, { visao: undefined, page: undefined }),
            label: "Todas as peças",
          },
          {
            active: compare,
            href: withParams("/catalogo", params, { visao: "comparar", page: undefined }),
            label: `Comparar fornecedores (${sharedCount})`,
          },
        ].map((tab) => (
          <Link
            key={tab.label}
            role="tab"
            aria-selected={tab.active}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab.active ? "bg-surface text-ink shadow-ui" : "text-ink-subtle hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <CatalogFilters
        action="/catalogo"
        values={filters}
        suppliers={compare ? undefined : supplierList.map((s) => ({ value: s.id, label: s.name }))}
        brands={brands}
        hidden={compare ? { visao: "comparar" } : {}}
        showStatus={!compare}
      />

      {compare ? (
        <CompareResults filters={filters} params={params} />
      ) : (
        <PartResults filters={filters} params={params} />
      )}
    </>
  );
}

async function PartResults({
  filters,
  params,
}: {
  filters: Parameters<typeof searchParts>[1];
  params: SearchParams;
}) {
  const result = await searchParts(getDb(), filters);
  return (
    <>
      <PartsTable rows={result.rows} />
      <Pagination
        path="/catalogo"
        params={params}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />
    </>
  );
}

async function CompareResults({
  filters,
  params,
}: {
  filters: Parameters<typeof comparePrices>[1];
  params: SearchParams;
}) {
  const result = await comparePrices(getDb(), filters);
  return (
    <>
      <CompareTable rows={result.rows} />
      <Pagination
        path="/catalogo"
        params={params}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />
    </>
  );
}
