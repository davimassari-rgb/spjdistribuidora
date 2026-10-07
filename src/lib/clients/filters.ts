import { param, type SearchParams } from "@/lib/search-params";
import type { ClientFilters } from "./clients";

/** Lê os filtros de cliente da URL (nomes dos parâmetros em português). */
export function clientFiltersFrom(params: SearchParams): ClientFilters {
  return {
    q: param(params, "q"),
    kind: param(params, "tipo"),
    region: param(params, "regiao"),
    ownerId: param(params, "responsavel"),
    status: param(params, "situacao"),
  };
}
