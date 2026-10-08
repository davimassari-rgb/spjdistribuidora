import { ALL_CLIENT_KINDS } from "@/lib/segments";

// Etapas dos Kanbans e listas fixas. Para ajustar as etapas, edite este arquivo
// (são gravadas como texto no banco; renomear o `id` exige migrar os dados existentes).

export type Stage = {
  id: string;
  label: string;
  /** Coluna final: mostra só os cards dos últimos dias para o quadro não crescer sem fim. */
  terminal?: boolean;
  /** Mover para esta coluna pede um motivo (ex.: Perdido). */
  requiresReason?: boolean;
};

export const PROSPECT_STAGES = [
  { id: "lead", label: "Lead" },
  { id: "first_contact", label: "Primeiro contato" },
  { id: "presentation", label: "Apresentação / visita" },
  { id: "quote_sent", label: "Cotação enviada" },
  { id: "first_order", label: "Primeiro pedido", terminal: true },
  { id: "lost", label: "Perdido", terminal: true, requiresReason: true },
] as const satisfies readonly Stage[];

export const FARMER_STAGES = [
  { id: "to_contact", label: "A contatar nesta semana" },
  { id: "contacted", label: "Contatado" },
  { id: "quoting", label: "Cotação em andamento" },
  { id: "order_closed", label: "Pedido fechado" },
  { id: "delivered", label: "Entregue" },
] as const satisfies readonly Stage[];

/** Kanban comercial: cada card é uma demanda de peça/cotação de um cliente. */
export const OPPORTUNITY_STAGES = [
  { id: "requested", label: "Solicitação" },
  { id: "quoting", label: "Cotando no fornecedor" },
  { id: "quote_sent", label: "Cotação enviada" },
  { id: "order_closed", label: "Pedido fechado", terminal: true },
  { id: "delivered", label: "Entregue", terminal: true },
  { id: "lost", label: "Perdido", terminal: true, requiresReason: true },
] as const satisfies readonly Stage[];

export type ProspectStage = (typeof PROSPECT_STAGES)[number]["id"];
export type FarmerStage = (typeof FARMER_STAGES)[number]["id"];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]["id"];

export const ids = <T extends readonly { id: string }[]>(stages: T) =>
  stages.map((s) => s.id) as unknown as [T[number]["id"], ...T[number]["id"][]];

/** Na virada da semana, estes cards do farmer voltam para "A contatar". */
export const FARMER_RESET_STAGES: FarmerStage[] = ["contacted", "order_closed", "delivered"];

/** Cards em colunas finais aparecem por este número de dias. */
export const TERMINAL_VISIBLE_DAYS = 30;

/** Rótulos de todos os tipos de cliente; os tipos válidos variam por segmento (segments.ts). */
export const CLIENT_KINDS: Record<string, string> = ALL_CLIENT_KINDS;

export const CLIENT_STATUSES = {
  prospect: "Prospecção",
  active: "Cliente ativo",
  lost: "Perdido",
} as const;
export type ClientStatus = keyof typeof CLIENT_STATUSES;

export const INTERACTION_KINDS = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  visit: "Visita",
  email: "E-mail",
  other: "Outro",
} as const;
export type InteractionKind = keyof typeof INTERACTION_KINDS;

export function stageLabel(stages: readonly Stage[], id: string | null | undefined): string {
  return stages.find((s) => s.id === id)?.label ?? "—";
}
