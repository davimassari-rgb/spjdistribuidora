import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { param, type SearchParams } from "@/lib/search-params";
import { listUsers } from "@/lib/users";
import { removeUser } from "./actions";
import { UserActions } from "./forms";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage(props: PageProps<"/usuarios">) {
  const me = await requireUser();
  const params = (await props.searchParams) as SearchParams;
  const users = await listUsers(getDb());

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Equipe com acesso ao sistema. Todos têm o mesmo nível de acesso."
        actions={<UserActions openPassword={param(params, "senha") === "1"} />}
      />
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th className="hidden sm:table-cell">E-mail</th>
              <th className="hidden md:table-cell">Desde</th>
              <th className="w-12">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <div className="font-medium text-ink">
                        {user.name}
                        {user.id === me.id && <span className="badge-brand ml-2">você</span>}
                      </div>
                      <div className="caption sm:hidden">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden sm:table-cell">{user.email}</td>
                <td className="num hidden md:table-cell">{formatDate(user.createdAt)}</td>
                <td className="text-right">
                  {user.id !== me.id && (
                    <form action={removeUser}>
                      <input type="hidden" name="userId" value={user.id} />
                      <ConfirmButton
                        message={`Remover o acesso de ${user.name}?`}
                        className="btn-icon hover:text-danger"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sr-only">Remover {user.name}</span>
                      </ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
