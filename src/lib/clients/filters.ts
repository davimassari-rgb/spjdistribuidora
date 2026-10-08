import { param, type SearchParams } from "@/lib/search-params";
import type { Segment } from "@/lib/segments";
import type { ClientFilters } from "./clients";

/** Lê os filtros de cliente da URL (nomes dos parâmetros em português). */
export function clientFiltersFrom(params: SearchParams, segment: Segment): ClientFilters {
  return {
    segment,
    q: param(params, "q"),
    kind: param(params, "tipo"),
    region: param(params, "regiao"),
    ownerId: param(params, "responsavel"),
    status: param(params, "situacao"),
  };
}
