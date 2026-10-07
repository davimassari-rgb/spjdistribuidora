import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { getSupplier } from "@/lib/catalog/queries";
import { formatDateTime } from "@/lib/format";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Importar planilha" };

export default async function ImportPage(props: PageProps<"/fornecedores/[id]/importar">) {
  const { id } = await props.params;
  const supplier = z.uuid().safeParse(id).success ? await getSupplier(getDb(), id) : null;
  if (!supplier) notFound();

  return (
    <>
      <Link href={`/fornecedores/${supplier.id}`} className="text-sm text-blue-600 hover:underline">
        ← {supplier.name}
      </Link>
      <PageHeader
        title={`Importar planilha · ${supplier.name}`}
        description={`Última atualização: ${formatDateTime(supplier.lastImportAt)}. A planilha nova substitui os preços atuais deste fornecedor.`}
      />
      <ImportWizard supplierId={supplier.id} supplierName={supplier.name} />
    </>
  );
}
