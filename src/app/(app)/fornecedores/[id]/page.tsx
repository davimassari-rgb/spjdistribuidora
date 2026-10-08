import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { getDb } from "@/db/client";
import { getSupplier, listBrands, listImports, searchParts } from "@/lib/catalog/queries";
import { formatDateTime } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { CatalogFilters } from "../../catalogo/filters";
import { PartsTable } from "../../catalogo/parts-table";
import { deleteSupplier } from "../actions";
import { RenameSupplierForm } from "../supplier-forms";

export const metadata: Metadata = { title: "Fornecedor" };

/** Visão por fornecedor: as peças e preços de um único fornecedor + histórico de importações. */
export default async function SupplierPage(props: PageProps<"/fornecedores/[id]">) {
  const { id } = await props.params;
  const params = (await props.searchParams) as SearchParams;
  const db = getDb();
  const supplier = z.uuid().safeParse(id).success ? await getSupplier(db, id) : null;
  if (!supplier) notFound();

  const filters = {
    q: param(params, "q"),
    brand: param(params, "marca"),
    status: param(params, "situacao"),
    page: pageParam(params),
    supplierId: supplier.id,
  };
  const [result, brands, history] = await Promise.all([
    searchParts(db, filters),
    listBrands(db, supplier.id),
    listImports(db, supplier.id),
  ]);
  const path = `/fornecedores/${supplier.id}`;

  return (
    <>
      <Link href="/fornecedores" className="text-sm text-blue-600 hover:underline">
        ← Fornecedores
      </Link>
      <PageHeader
        title={supplier.name}
        description={`Última atualização: ${formatDateTime(supplier.lastImportAt)}`}
        actions={
          <Link href={`${path}/importar`} className="btn-primary">
            Importar planilha
          </Link>
        }
      />

      <CatalogFilters action={path} values={filters} brands={brands} />
      <PartsTable rows={result.rows} showSupplier={false} />
      <Pagination
        path={path}
        params={params}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-2 font-semibold">Histórico de importações</h2>
          {history.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">Nenhuma planilha importada ainda.</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Arquivo</th>
                    <th className="px-3 py-2 font-medium">Novas</th>
                    <th className="px-3 py-2 font-medium">Atualizadas</th>
                    <th className="px-3 py-2 font-medium">Indisponíveis</th>
                    <th className="px-3 py-2 font-medium">Erros/avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`${path}/importacoes/${item.id}`}
                        >
                          {formatDateTime(item.createdAt)}
                        </Link>
                        {item.userName && (
                          <div className="text-xs text-slate-500">{item.userName}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">{item.fileName}</td>
                      <td className="px-3 py-2">{item.createdCount}</td>
                      <td className="px-3 py-2">{item.updatedCount}</td>
                      <td className="px-3 py-2">{item.deactivatedCount}</td>
                      <td className="px-3 py-2">
                        {item.errorCount} / {item.warningCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card self-start p-4">
          <RenameSupplierForm id={supplier.id} name={supplier.name} />
          <form action={deleteSupplier} className="mt-6 border-t border-slate-100 pt-4">
            <input type="hidden" name="id" value={supplier.id} />
            <p className="mb-2 text-xs text-slate-500">
              Excluir remove o fornecedor, todas as peças e o histórico de importações.
            </p>
            <ConfirmButton
              message={`Excluir ${supplier.name} e todas as peças dele? Não dá para desfazer.`}
            >
              Excluir fornecedor
            </ConfirmButton>
          </form>
        </section>
      </div>
    </>
  );
}
