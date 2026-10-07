import type { ImportIssue } from "@/db/schema";

/** Linhas com erro (não importadas) e avisos (importadas com ressalva) de uma importação. */
export function IssuesTable({
  issues,
  truncatedAt,
}: {
  issues: ImportIssue[];
  truncatedAt?: number;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Linha</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a mesma linha pode ter vários avisos
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-1.5 font-mono">{issue.row}</td>
              <td className="px-3 py-1.5">
                {issue.level === "error" ? (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                    Erro
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    Aviso
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5">{issue.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {truncatedAt !== undefined && issues.length >= truncatedAt && (
        <p className="px-3 py-2 text-xs text-slate-500">
          Mostrando as primeiras {truncatedAt} ocorrências.
        </p>
      )}
    </div>
  );
}
