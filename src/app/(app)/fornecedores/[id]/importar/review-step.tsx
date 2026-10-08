"use client";

import { useMemo, useState, useTransition } from "react";
import type { ImportIssue } from "@/db/schema";
import type { ReviewRow } from "@/lib/catalog/mapping";
import { checkReviewedRows, type ImportResult, importReviewedRows } from "../../actions";

type Imported = Extract<ImportResult, { ok: true }>;
type Filter = "all" | "error" | "warning" | "excluded";
const PAGE_SIZE = 50;

/**
 * Revisão da planilha antes de gravar: todas as linhas lidas, editáveis, com os problemas
 * encontrados. Nada vai para o catálogo até a pessoa confirmar.
 */
export function ReviewStep({
  supplierId,
  supplierName,
  fileName,
  initialRows,
  initialIssues,
  onBack,
  onImported,
}: {
  supplierId: string;
  supplierName: string;
  fileName: string;
  initialRows: ReviewRow[];
  initialIssues: ImportIssue[];
  onBack: () => void;
  onImported: (result: Imported) => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [issues, setIssues] = useState(initialIssues);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<Filter>(
    initialIssues.some((i) => i.level === "error") ? "error" : "all",
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const issuesByRow = useMemo(() => {
    const map = new Map<number, ImportIssue[]>();
    for (const issue of issues) map.set(issue.row, [...(map.get(issue.row) ?? []), issue]);
    return map;
  }, [issues]);
  const levelOf = (row: number) => {
    const list = issuesByRow.get(row) ?? [];
    if (list.some((i) => i.level === "error")) return "error";
    return list.length ? "warning" : "ok";
  };

  const included = rows.filter((r) => !excluded.has(r.row));
  const errorRows = included.filter((r) => levelOf(r.row) === "error").length;
  const warningRows = included.filter((r) => levelOf(r.row) === "warning").length;
  const tierLabels = rows[0]?.tiers.map((t) => t.minQuantity) ?? [];

  const visible = rows.filter((r) => {
    const isExcluded = excluded.has(r.row);
    if (filter === "excluded" ? !isExcluded : isExcluded && filter !== "all") return false;
    if (filter === "error" && levelOf(r.row) !== "error") return false;
    if (filter === "warning" && levelOf(r.row) !== "warning") return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return `${r.code} ${r.description} ${r.brand}`.toLowerCase().includes(q);
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function edit(rowNumber: number, changes: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.row === rowNumber ? { ...r, ...changes } : r)));
    setDirty(true);
  }

  function toggle(rowNumber: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
    setDirty(true);
  }

  function revalidate() {
    startTransition(async () => {
      const result = await checkReviewedRows(included);
      if (result) {
        setIssues(result);
        setDirty(false);
      } else setError("Não foi possível validar as linhas.");
    });
  }

  function confirmImport() {
    setError(null);
    startTransition(async () => {
      const response = await importReviewedRows({ supplierId, fileName, rows: included });
      if (!response.ok) return setError(response.error);
      onImported(response);
    });
  }

  const tab = (value: Filter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => {
        setFilter(value);
        setPage(1);
      }}
      className={`rounded-md px-3 py-1.5 text-sm ${filter === value ? "bg-slate-800 text-white" : "border border-slate-300 bg-white text-slate-600"}`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Revisão dos produtos · {fileName}</h2>
            <p className="text-sm text-slate-500">
              Confira e corrija antes de gravar. Nada foi alterado no catálogo de {supplierName}{" "}
              ainda. Linhas com erro que ficarem sem correção não serão importadas.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onBack} disabled={pending}>
            ← Voltar ao mapeamento
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab("all", "Todas", included.length)}
          {tab("error", "Com erro", errorRows)}
          {tab("warning", "Com aviso", warningRows)}
          {tab("excluded", "Excluídas", excluded.size)}
          <input
            type="search"
            className="input md:max-w-xs"
            placeholder="Buscar código, descrição, marca…"
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setPage(1);
            }}
          />
          {errorRows > 0 && (
            <button
              type="button"
              className="text-sm text-red-600 hover:underline"
              onClick={() => {
                setExcluded(
                  (prev) =>
                    new Set([
                      ...prev,
                      ...included.filter((r) => levelOf(r.row) === "error").map((r) => r.row),
                    ]),
                );
                setDirty(true);
              }}
            >
              Excluir todas as linhas com erro
            </button>
          )}
        </div>
        {dirty && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Há alterações não verificadas.{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={revalidate}
              disabled={pending}
            >
              Verificar de novo
            </button>
          </p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">Linha</th>
              <th className="px-2 py-2 font-medium">Código</th>
              <th className="px-2 py-2 font-medium">Descrição</th>
              <th className="px-2 py-2 font-medium">Marca</th>
              <th className="px-2 py-2 font-medium">Aplicação</th>
              <th className="px-2 py-2 font-medium">Preço</th>
              {tierLabels.map((min) => (
                <th key={min} className="px-2 py-2 font-medium">
                  {min}+ un
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Situação</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={8 + tierLabels.length}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  Nenhuma linha neste filtro.
                </td>
              </tr>
            )}
            {pageRows.map((r) => {
              const isExcluded = excluded.has(r.row);
              const level = levelOf(r.row);
              const cell =
                "w-full rounded border border-slate-200 px-1.5 py-1 text-sm disabled:bg-slate-50";
              return (
                <tr
                  key={r.row}
                  className={`border-b border-slate-100 align-top ${isExcluded ? "opacity-40" : level === "error" ? "bg-red-50" : level === "warning" ? "bg-amber-50/50" : ""}`}
                >
                  <td className="px-2 py-1.5 font-mono text-xs text-slate-500">{r.row}</td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${cell} w-28 font-mono`}
                      value={r.code}
                      disabled={isExcluded}
                      aria-label={`Código linha ${r.row}`}
                      onChange={(e) => edit(r.row, { code: e.currentTarget.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${cell} min-w-56`}
                      value={r.description}
                      disabled={isExcluded}
                      aria-label={`Descrição linha ${r.row}`}
                      onChange={(e) => edit(r.row, { description: e.currentTarget.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${cell} w-32`}
                      value={r.brand}
                      disabled={isExcluded}
                      aria-label={`Marca linha ${r.row}`}
                      onChange={(e) => edit(r.row, { brand: e.currentTarget.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${cell} min-w-40`}
                      value={r.application}
                      disabled={isExcluded}
                      aria-label={`Aplicação linha ${r.row}`}
                      onChange={(e) => edit(r.row, { application: e.currentTarget.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${cell} w-24 text-right`}
                      value={r.price}
                      disabled={isExcluded}
                      inputMode="decimal"
                      placeholder="sob consulta"
                      aria-label={`Preço linha ${r.row}`}
                      onChange={(e) => edit(r.row, { price: e.currentTarget.value })}
                    />
                  </td>
                  {r.tiers.map((tier, index) => (
                    <td key={tier.minQuantity} className="px-2 py-1.5">
                      <input
                        className={`${cell} w-24 text-right`}
                        value={tier.price}
                        disabled={isExcluded}
                        inputMode="decimal"
                        aria-label={`Preço ${tier.minQuantity}+ linha ${r.row}`}
                        onChange={(e) => {
                          const tiers = r.tiers.map((t, i) =>
                            i === index ? { ...t, price: e.currentTarget.value } : t,
                          );
                          edit(r.row, { tiers });
                        }}
                      />
                    </td>
                  ))}
                  <td className="max-w-72 px-2 py-1.5 text-xs">
                    {isExcluded ? (
                      <span className="text-slate-500">Excluída</span>
                    ) : (issuesByRow.get(r.row) ?? []).length === 0 ? (
                      <span className="text-green-700">OK</span>
                    ) : (
                      (issuesByRow.get(r.row) ?? []).map((issue) => (
                        <p
                          key={issue.message}
                          className={issue.level === "error" ? "text-red-700" : "text-amber-800"}
                        >
                          {issue.message}
                        </p>
                      ))
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      className="text-xs text-slate-600 hover:underline"
                      onClick={() => toggle(r.row)}
                    >
                      {isExcluded ? "restaurar" : "excluir"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-500">
          {visible.length} linha(s) · página {currentPage} de {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={currentPage >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
      </div>

      <div className="card sticky bottom-2 flex flex-wrap items-center gap-3 p-3">
        {error && (
          <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={pending || included.length === 0}
          onClick={confirmImport}
        >
          {pending
            ? "Processando…"
            : `Confirmar e importar ${included.length - errorRows} produto(s)`}
        </button>
        <span className="text-xs text-slate-500">
          {errorRows > 0 && `${errorRows} linha(s) com erro serão ignoradas. `}
          {excluded.size > 0 && `${excluded.size} excluída(s) por você. `}
          Peças que não estiverem nesta lista ficam como “Indisponível”.
        </span>
      </div>
    </div>
  );
}
