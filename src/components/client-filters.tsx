import Link from "next/link";
import { CLIENT_KINDS, CLIENT_STATUSES } from "@/lib/kanban/stages";

/** Filtros de clientes (tipo, região, responsável) usados na lista e nos Kanbans. */
export function ClientFilters({
  action,
  values,
  regions,
  users,
  showStatus = false,
  showSearch = true,
}: {
  action: string;
  values: { q?: string; kind?: string; region?: string; ownerId?: string; status?: string };
  regions: string[];
  users: { id: string; name: string }[];
  showStatus?: boolean;
  showSearch?: boolean;
}) {
  return (
    <form
      action={action}
      className="card mb-4 flex flex-col gap-3 p-3 md:flex-row md:flex-wrap md:items-center"
    >
      {showSearch && (
        <input
          className="input md:max-w-xs"
          type="search"
          name="q"
          placeholder="Nome, CNPJ, contato ou cidade…"
          defaultValue={values.q}
          aria-label="Buscar"
        />
      )}
      <select
        className="input md:w-auto"
        name="tipo"
        defaultValue={values.kind ?? ""}
        aria-label="Tipo"
      >
        <option value="">Todos os tipos</option>
        {Object.entries(CLIENT_KINDS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className="input md:w-auto"
        name="regiao"
        defaultValue={values.region ?? ""}
        aria-label="Região"
      >
        <option value="">Todas as regiões</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
      <select
        className="input md:w-auto"
        name="responsavel"
        defaultValue={values.ownerId ?? ""}
        aria-label="Responsável"
      >
        <option value="">Todos os responsáveis</option>
        <option value="none">Sem responsável</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      {showStatus && (
        <select
          className="input md:w-auto"
          name="situacao"
          defaultValue={values.status ?? ""}
          aria-label="Situação"
        >
          <option value="">Todas as situações</option>
          {Object.entries(CLIENT_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Filtrar
        </button>
        <Link href={action} className="btn-secondary">
          Limpar
        </Link>
      </div>
    </form>
  );
}
