import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { countUsers } from "@/lib/users";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Configuração inicial" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await countUsers(getDb())) > 0) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">Configuração inicial</h1>
        <p className="mb-6 text-sm text-slate-500">
          Crie o primeiro acesso ao sistema. Os demais usuários são cadastrados depois, em Usuários.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
