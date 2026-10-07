import Link from "next/link";
import { type SearchParams, withParams } from "@/lib/search-params";

export function Pagination({
  path,
  params,
  page,
  pageCount,
  total,
}: {
  path: string;
  params: SearchParams;
  page: number;
  pageCount: number;
  total: number;
}) {
  if (pageCount <= 1) return <p className="mt-4 text-sm text-slate-500">{total} resultado(s)</p>;
  const link = "rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100";
  return (
    <div className="mt-4 flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-500">
        {total} resultado(s) · página {page} de {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className={link} href={withParams(path, params, { page: page - 1 })}>
            Anterior
          </Link>
        )}
        {page < pageCount && (
          <Link className={link} href={withParams(path, params, { page: page + 1 })}>
            Próxima
          </Link>
        )}
      </div>
    </div>
  );
}
