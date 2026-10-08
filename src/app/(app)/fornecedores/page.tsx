import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { listSuppliers } from "@/lib/catalog/queries";
import { formatDateTime } from "@/lib/format";
import { bpToPercent, getMarkupBp } from "@/lib/pricing";
import { getCurrentSegment } from "@/lib/segment-server";
import { segmentLabel } from "@/lib/segments";
import { MarkupForm, NewSupplierForm } from "./supplier-forms";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function SuppliersPage() {
  const db = getDb();
  const segment = await getCurrentSegment();
  const [suppliers, markupBp] = await Promise.all([
    listSuppliers(db, segment),
    getMarkupBp(db, segment),
  ]);

  return (
    <>
      <PageHeader
        title={`Fornecedores · ${segmentLabel(segment)}`}
        description="O estoque disponível para venda é o catálogo dos fornecedores, atualizado por planilha."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 self-start sm:grid-cols-2">
          {suppliers.length === 0 && (
            <div className="card p-6 text-sm text-slate-500 sm:col-span-2">
              Nenhum fornecedor ainda. Cadastre o primeiro ao lado.
            </div>
          )}
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="card flex flex-col gap-3 p-4">
              <div>
                <Link
                  href={`/fornecedores/${supplier.id}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {supplier.name}
                </Link>
                <p className="text-sm text-slate-500">
                  Última atualização: {formatDateTime(supplier.lastImportAt)}
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-xl font-semibold">
                    {supplier.activeCount.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-slate-500">disponíveis</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-slate-400">
                    {supplier.inactiveCount.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-slate-500">indisponíveis</div>
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <Link href={`/fornecedores/${supplier.id}`} className="btn-secondary flex-1">
                  Ver peças
                </Link>
                <Link href={`/fornecedores/${supplier.id}/importar`} className="btn-primary flex-1">
                  Importar planilha
                </Link>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6 self-start">
          <section className="card self-start p-4">
            <h2 className="mb-3 font-semibold">Novo fornecedor</h2>
            <NewSupplierForm />
          </section>
          <section className="card p-4">
            <h2 className="mb-1 font-semibold">Margem de venda · {segmentLabel(segment)}</h2>
            <p className="mb-3 text-xs text-slate-500">
              Preço no portal do cliente = preço do fornecedor + esta margem.
            </p>
            <MarkupForm current={bpToPercent(markupBp)} />
          </section>
        </div>
      </div>
    </>
  );
}
