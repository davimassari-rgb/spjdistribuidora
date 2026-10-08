import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { listRegions } from "@/lib/clients/clients";
import { getCurrentSegment } from "@/lib/segment-server";
import { clientKindsOf, segmentLabel } from "@/lib/segments";
import { listUsers } from "@/lib/users";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewClientPage() {
  const db = getDb();
  const segment = await getCurrentSegment();
  const [users, regions] = await Promise.all([listUsers(db), listRegions(db, segment)]);
  return (
    <>
      <Link href="/clientes" className="text-sm text-blue-600 hover:underline">
        ← Clientes
      </Link>
      <PageHeader title={`Novo cliente · ${segmentLabel(segment)}`} />
      <div className="card max-w-4xl p-4">
        <ClientForm
          action={createClientAction}
          users={users}
          regions={regions}
          kinds={clientKindsOf(segment)}
          isNew
        />
      </div>
    </>
  );
}
