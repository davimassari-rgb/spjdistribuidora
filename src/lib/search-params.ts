export type SearchParams = Record<string, string | string[] | undefined>;

/** Primeiro valor (texto) de um parâmetro da URL. */
export function param(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

export function pageParam(params: SearchParams): number {
  const page = Number(param(params, "page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Monta uma URL mantendo os filtros atuais e trocando/removendo alguns parâmetros. */
export function withParams(
  path: string,
  params: SearchParams,
  changes: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") query.delete(key);
    else query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
