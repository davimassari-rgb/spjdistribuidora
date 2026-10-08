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
  /** Cor do cabeçalho da coluna (só visual). */
  tone?: "neutral" | "brand" | "warning" | "success" | "danger";
};

export const PROSPECT_STAGES = [
  { id: "lead", label: "Lead", tone: "neutral" },
  { id: "first_contact", label: "Primeiro contato", tone: "brand" },
  { id: "presentation", label: "Apresentação / visita", tone: "brand" },
  { id: "quote_sent", label: "Cotação enviada", tone: "warning" },
  { id: "first_order", label: "Primeiro pedido", terminal: true, tone: "success" },
  { id: "lost", label: "Perdido", terminal: true, requiresReason: true, tone: "danger" },
] as const satisfies readonly Stage[];

export const FARMER_STAGES = [
  { id: "to_contact", label: "A contatar nesta semana", tone: "brand" },
  { id: "contacted", label: "Contatado", tone: "neutral" },
  { id: "quoting", label: "Cotação em andamento", tone: "warning" },
  { id: "order_closed", label: "Pedido fechado", tone: "success" },
  { id: "delivered", label: "Entregue", tone: "success" },
] as const satisfies readonly Stage[];

/** Kanban comercial: cada card é uma demanda de peça/cotação de um cliente. */
export const OPPORTUNITY_STAGES = [
  { id: "requested", label: "Solicitação", tone: "neutral" },
  { id: "quoting", label: "Cotando no fornecedor", tone: "warning" },
  { id: "quote_sent", label: "Cotação enviada", tone: "warning" },
  { id: "order_closed", label: "Pedido fechado", terminal: true, tone: "success" },
  { id: "delivered", label: "Entregue", terminal: true, tone: "success" },
  { id: "lost", label: "Perdido", terminal: true, requiresReason: true, tone: "danger" },
] as const satisfies readonly Stage[];

/** Quadro de Pedidos: pedidos feitos pelos clientes no portal, até a entrega. */
export const ORDER_STAGES = [
  { id: "received", label: "Recebido", tone: "brand" },
  { id: "purchased", label: "Comprado no fornecedor", tone: "warning" },
  { id: "out_for_delivery", label: "Em entrega", tone: "warning" },
  { id: "delivered", label: "Entregue", terminal: true, tone: "success" },
  { id: "canceled", label: "Cancelado", terminal: true, requiresReason: true, tone: "danger" },
] as const satisfies readonly Stage[];

export type ProspectStage = (typeof PROSPECT_STAGES)[number]["id"];
export type FarmerStage = (typeof FARMER_STAGES)[number]["id"];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]["id"];
export type OrderStage = (typeof ORDER_STAGES)[number]["id"];

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
