import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { getImport, getSupplier } from "@/lib/catalog/queries";
import { formatDateTime } from "@/lib/format";
import { IssuesTable } from "../../issues-table";

export const metadata: Metadata = { title: "Relatório de importação" };

export default async function ImportReportPage(
  props: PageProps<"/fornecedores/[id]/importacoes/[importId]">,
) {
  const { id, importId } = await props.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(importId).success) notFound();
  const db = getDb();
  const [supplier, report] = await Promise.all([getSupplier(db, id), getImport(db, id, importId)]);
  if (!supplier || !report) notFound();

  return (
    <>
      <Link href={`/fornecedores/${supplier.id}`} className="text-sm text-blue-600 hover:underline">
        ← {supplier.name}
      </Link>
      <PageHeader
        title="Relatório de importação"
        description={`${report.fileName} · ${formatDateTime(report.createdAt)}${report.userName ? ` · por ${report.userName}` : ""}`}
      />
      <div className="card mb-4 grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Linhas lidas", report.totalRows],
          ["Peças novas", report.createdCount],
          ["Atualizadas", report.updatedCount],
          ["Indisponíveis", report.deactivatedCount],
          ["Erros", report.errorCount],
          ["Avisos", report.warningCount],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-slate-500">{label}</div>
            <div className="text-xl font-semibold">{Number(value).toLocaleString("pt-BR")}</div>
          </div>
        ))}
      </div>
      {report.issues.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">Nenhum erro ou aviso.</div>
      ) : (
        <IssuesTable issues={report.issues} truncatedAt={2000} />
      )}
    </>
  );
}
