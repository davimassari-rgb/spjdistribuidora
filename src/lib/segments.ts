// Segmentos de distribuição atendidos pela SPJ. Cada fornecedor e cada cliente pertence a um
// segmento; o catálogo, os clientes e os quadros mostram só o segmento escolhido no topo.

export const SEGMENTS = {
  auto_parts: {
    label: "Autopeças",
    clientKinds: { workshop: "Oficina mecânica", parts_store: "Loja de autopeças" },
  },
  cosmetics: {
    label: "Maquiagem",
    clientKinds: {
      beauty_salon: "Salão de beleza",
      cosmetics_store: "Loja de cosméticos",
      pharmacy: "Farmácia / drogaria",
    },
  },
  food: {
    label: "Alimentação",
    clientKinds: {
      restaurant: "Restaurante / lanchonete",
      market: "Mercado / mercearia",
      bakery: "Padaria / confeitaria",
    },
  },
} as const;

export type Segment = keyof typeof SEGMENTS;
export const SEGMENT_IDS = Object.keys(SEGMENTS) as [Segment, ...Segment[]];
export const DEFAULT_SEGMENT: Segment = "auto_parts";

export function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && value in SEGMENTS;
}

export function segmentLabel(segment: string): string {
  return isSegment(segment) ? SEGMENTS[segment].label : segment;
}

export function clientKindsOf(segment: Segment): Record<string, string> {
  return SEGMENTS[segment].clientKinds;
}

/** Todos os tipos de cliente de todos os segmentos (para exibir rótulos). */
export const ALL_CLIENT_KINDS: Record<string, string> = Object.assign(
  {},
  ...SEGMENT_IDS.map((s) => SEGMENTS[s].clientKinds),
);
