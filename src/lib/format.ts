// Formatação para exibição no padrão brasileiro. O fuso de referência é o de São Paulo.

export const TIME_ZONE = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});
const percentFmt = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});

/** Centavos inteiros → "R$ 1.234,56". A divisão por 100 acontece só aqui, na exibição. */
export function formatCents(cents: number | null | undefined, empty = "Sob consulta"): string {
  if (cents === null || cents === undefined) return empty;
  return brl.format(cents / 100);
}

/** Centavos → "1234,56" (para preencher inputs de valor). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

export function formatDate(date: Date | null | undefined): string {
  return date ? dateFmt.format(date) : "—";
}

export function formatDateTime(date: Date | null | undefined): string {
  return date ? dateTimeFmt.format(date) : "—";
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : percentFmt.format(value);
}

/** Dígitos do CNPJ → "12.345.678/0001-95". */
export function formatCnpj(digits: string | null | undefined): string {
  if (!digits) return "—";
  if (digits.length !== 14) return digits;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** Dígitos do telefone → "(11) 91234-5678" / "(11) 1234-5678". */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "—";
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return digits;
}
