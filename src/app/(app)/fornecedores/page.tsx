import { Truck, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FRESHNESS_STYLE, freshnessOf } from "@/components/supplier-status";
import { EmptyState } from "@/components/ui/empty-state";
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
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4 self-start">
          {suppliers.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState
                icon={Truck}
                title="Nenhum fornecedor neste segmento"
                description="Cadastre o primeiro fornecedor ao lado e importe a planilha de produtos dele."
              />
            </div>
          )}
          {suppliers.map((supplier) => {
            const freshness = FRESHNESS_STYLE[freshnessOf(supplier.lastImportAt)];
            const total = supplier.activeCount + supplier.inactiveCount;
            const activePct = total === 0 ? 0 : Math.round((supplier.activeCount / total) * 100);
            return (
              <div key={supplier.id} className="card flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/fornecedores/${supplier.id}`}
                      className="section-title block truncate hover:text-brand-700 hover:underline"
                    >
                      {supplier.name}
                    </Link>
                    <p className="caption num mt-0.5">
                      Última importação: {formatDateTime(supplier.lastImportAt)}
                    </p>
                  </div>
                  <span className={freshness.badge}>{freshness.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="num text-3xl font-semibold text-ink">
                      {supplier.activeCount.toLocaleString("pt-BR")}
                    </div>
                    <div className="caption">disponíveis</div>
                  </div>
                  <div>
                    <div className="num text-3xl font-semibold text-ink-subtle">
                      {supplier.inactiveCount.toLocaleString("pt-BR")}
                    </div>
                    <div className="caption">indisponíveis</div>
                  </div>
                </div>
                <div>
                  <div
                    className="flex h-2 overflow-hidden rounded-full bg-surface-sunken"
                    role="img"
                    aria-label={`${activePct}% das peças disponíveis`}
                  >
                    <div className="bg-green-500" style={{ width: `${activePct}%` }} />
                    <div
                      className="bg-slate-300"
                      style={{ width: `${total === 0 ? 0 : 100 - activePct}%` }}
                    />
                  </div>
                  <p className="caption num mt-1">
                    {total === 0 ? "Sem peças ainda" : `${activePct}% disponíveis`}
                  </p>
                </div>
                <div className="mt-auto flex gap-2">
                  <Link href={`/fornecedores/${supplier.id}`} className="btn-secondary flex-1">
                    Ver peças
                  </Link>
                  <Link
                    href={`/fornecedores/${supplier.id}/importar`}
                    className="btn-primary flex-1"
                  >
                    <Upload className="size-4" aria-hidden />
                    Importar
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid gap-6 self-start sm:grid-cols-2 xl:grid-cols-1">
          <section className="card self-start p-4">
            <h2 className="section-title mb-3">Novo fornecedor</h2>
            <NewSupplierForm />
          </section>
          <section className="card p-4">
            <h2 className="section-title mb-1">Margem de venda · {segmentLabel(segment)}</h2>
            <p className="caption mb-3">
              Preço no portal do cliente = preço do fornecedor + esta margem.
            </p>
            <MarkupForm current={bpToPercent(markupBp)} />
          </section>
        </div>
      </div>
    </>
  );
}
