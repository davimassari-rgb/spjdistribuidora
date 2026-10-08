"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Option = { value: string; label: string };
type Values = { q?: string; supplierId?: string; brand?: string; status?: string };

const STATUS_LABEL: Record<string, string> = {
  inactive: "Indisponíveis",
  all: "Todas as situações",
};

/**
 * Filtros aplicados em tempo real (busca com atraso de 350 ms) e guardados na URL,
 * com chips removíveis para cada filtro ativo.
 */
export function CatalogFilters({
  action,
  values,
  suppliers,
  brands,
  hidden = {},
  showStatus = true,
}: {
  action: string;
  values: Values;
  suppliers?: Option[];
  brands: string[];
  hidden?: Record<string, string>;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(values.q ?? "");
  const current = useRef(values);
  current.current = values;

  function apply(changes: Partial<Values>) {
    const next = { ...current.current, ...changes };
    const params = new URLSearchParams(hidden);
    if (next.q) params.set("q", next.q);
    if (next.supplierId) params.set("fornecedor", next.supplierId);
    if (next.brand) params.set("marca", next.brand);
    if (next.status && next.status !== "active") params.set("situacao", next.status);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${action}?${qs}` : action, { scroll: false }));
  }

  // Busca enquanto digita, com atraso para não consultar a cada tecla.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só reage ao texto digitado
  useEffect(() => {
    if (q === (current.current.q ?? "")) return;
    const timer = setTimeout(() => apply({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(timer);
  }, [q]);

  const chips: { label: string; clear: Partial<Values> }[] = [];
  if (values.q) chips.push({ label: `“${values.q}”`, clear: { q: undefined } });
  if (values.supplierId) {
    const name = suppliers?.find((s) => s.value === values.supplierId)?.label ?? "Fornecedor";
    chips.push({ label: name, clear: { supplierId: undefined } });
  }
  if (values.brand) chips.push({ label: values.brand, clear: { brand: undefined } });
  if (values.status && values.status !== "active") {
    chips.push({
      label: STATUS_LABEL[values.status] ?? values.status,
      clear: { status: undefined },
    });
  }

  return (
    <div className="card mb-4 p-3" aria-busy={pending}>
      <form
        action={action}
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() || undefined });
        }}
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]"
      >
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <input
            className="input pl-9"
            type="search"
            name="q"
            placeholder="Código, descrição, marca ou aplicação…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </label>
        {suppliers && (
          <select
            className="input"
            aria-label="Fornecedor"
            value={values.supplierId ?? ""}
            onChange={(e) => apply({ supplierId: e.currentTarget.value || undefined })}
          >
            <option value="">Todos os fornecedores</option>
            {suppliers.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <select
          className="input"
          aria-label="Marca"
          value={values.brand ?? ""}
          onChange={(e) => apply({ brand: e.currentTarget.value || undefined })}
        >
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
            aria-label="Situação"
            value={values.status ?? "active"}
            onChange={(e) => apply({ status: e.currentTarget.value })}
          >
            <option value="active">Disponíveis</option>
            <option value="inactive">Indisponíveis</option>
            <option value="all">Todas as situações</option>
          </select>
        )}
      </form>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="caption">Filtros:</span>
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                if ("q" in chip.clear) setQ("");
                apply(chip.clear);
              }}
              className="badge-brand hover:bg-brand-100"
              aria-label={`Remover filtro ${chip.label}`}
            >
              {chip.label}
              <X className="size-3" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-ink-subtle hover:text-ink hover:underline"
            onClick={() => {
              setQ("");
              router.replace(
                Object.keys(hidden).length
                  ? `${pathname}?${new URLSearchParams(hidden)}`
                  : pathname,
                { scroll: false },
              );
            }}
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}
