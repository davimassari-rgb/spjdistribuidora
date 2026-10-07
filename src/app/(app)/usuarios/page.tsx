import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { listUsers } from "@/lib/users";
import { removeUser } from "./actions";
import { AddUserForm, ChangePasswordForm } from "./forms";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const me = await requireUser();
  const users = await listUsers(getDb());

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Equipe com acesso ao sistema. Todos têm o mesmo nível de acesso."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card self-start overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Desde</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{user.name}</td>
                  <td className="px-4 py-2">{user.email}</td>
                  <td className="px-4 py-2">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-2 text-right">
                    {user.id === me.id ? (
                      <span className="text-xs text-slate-400">você</span>
                    ) : (
                      <form action={removeUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Remover
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-4 font-semibold">Novo usuário</h2>
            <AddUserForm />
          </section>
          <section className="card p-4">
            <h2 className="mb-4 font-semibold">Alterar minha senha</h2>
            <ChangePasswordForm />
          </section>
        </div>
      </div>
    </>
  );
}
