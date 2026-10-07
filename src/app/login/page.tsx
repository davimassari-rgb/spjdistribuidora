import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countUsers } from "@/lib/users";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  if ((await countUsers(getDb())) === 0) redirect("/setup");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">SPJ Distribuidora</h1>
        <p className="mb-6 text-sm text-slate-500">Acesso restrito à equipe.</p>
        <LoginForm />
      </div>
    </main>
  );
}
