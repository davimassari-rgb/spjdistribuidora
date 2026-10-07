import Link from "next/link";

type Option = { value: string; label: string };

/** Formulário de filtros via GET (os filtros ficam na URL e podem ser compartilhados). */
export function CatalogFilters({
  action,
  values,
  suppliers,
  brands,
  hidden = {},
  showStatus = true,
}: {
  action: string;
  values: { q?: string; supplierId?: string; brand?: string; status?: string };
  suppliers?: Option[];
  brands: string[];
  hidden?: Record<string, string>;
  showStatus?: boolean;
}) {
  return (
    <form
      action={action}
      className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        className="input"
        type="search"
        name="q"
        placeholder="Buscar por código, descrição, marca ou aplicação…"
        defaultValue={values.q}
        aria-label="Buscar"
      />
      {suppliers && (
        <select
          className="input"
          name="fornecedor"
          defaultValue={values.supplierId ?? ""}
          aria-label="Fornecedor"
        >
          <option value="">Todos os fornecedores</option>
          {suppliers.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      <select className="input" name="marca" defaultValue={values.brand ?? ""} aria-label="Marca">
        <option value="">Todas as marcas</option>
        {brands.map((brand) => (
          <option key={brand} value={brand}>
            {brand}
          </option>
        ))}
      </select>
      {showStatus && (
        <select
          className="input"
          name="situacao"
          defaultValue={values.status ?? "active"}
          aria-label="Situação"
        >
          <option value="active">Disponíveis</option>
          <option value="inactive">Indisponíveis</option>
          <option value="all">Todas</option>
        </select>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1">
          Filtrar
        </button>
        <Link
          href={Object.keys(hidden).length ? `${action}?${new URLSearchParams(hidden)}` : action}
          className="btn-secondary"
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}
