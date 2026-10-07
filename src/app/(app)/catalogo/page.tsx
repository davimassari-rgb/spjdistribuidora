import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { getDb } from "@/db/client";
import {
  comparePrices,
  countSharedCodes,
  listBrands,
  listSuppliers,
  searchParts,
} from "@/lib/catalog/queries";
import { formatDate } from "@/lib/format";
import { pageParam, param, type SearchParams, withParams } from "@/lib/search-params";
import { CompareTable } from "./compare-table";
import { CatalogFilters } from "./filters";
import { PartsTable } from "./parts-table";

export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage(props: PageProps<"/catalogo">) {
  const params = (await props.searchParams) as SearchParams;
  const db = getDb();
  const compare = param(params, "visao") === "comparar";
  const filters = {
    q: param(params, "q"),
    supplierId: param(params, "fornecedor"),
    brand: param(params, "marca"),
    status: param(params, "situacao"),
    page: pageParam(params),
  };

  const [supplierList, brands, sharedCount] = await Promise.all([
    listSuppliers(db),
    listBrands(db),
    countSharedCodes(db),
  ]);
  const validSupplier = supplierList.some((s) => s.id === filters.supplierId);
  if (!validSupplier) filters.supplierId = undefined;

  const totalActive = supplierList.reduce((sum, s) => sum + s.activeCount, 0);
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"}`;

  return (
    <>
      <PageHeader
        title="Catálogo"
        description={
          supplierList.length === 0 ? (
            <>
              Nenhum fornecedor cadastrado ainda.{" "}
              <Link className="text-blue-600 underline" href="/fornecedores">
                Cadastre um fornecedor e importe a planilha
              </Link>
              .
            </>
          ) : (
            <>
              {totalActive.toLocaleString("pt-BR")} peças disponíveis ·{" "}
              {supplierList.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && " · "}
                  {s.name}: atualizado em {formatDate(s.lastImportAt)}
                </span>
              ))}
            </>
          )
        }
      />

      <div className="mb-4 flex gap-2">
        <Link
          href={withParams("/catalogo", params, { visao: undefined, page: undefined })}
          className={tab(!compare)}
        >
          Todas as peças
        </Link>
        <Link
          href={withParams("/catalogo", params, { visao: "comparar", page: undefined })}
          className={tab(compare)}
        >
          Comparar fornecedores ({sharedCount})
        </Link>
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
