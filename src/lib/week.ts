import { TIME_ZONE } from "./format";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data local (São Paulo) no formato "AAAA-MM-DD". */
export function localDate(date: Date): string {
  return partsFmt.format(date); // en-CA já formata como AAAA-MM-DD
}

/**
 * Segunda-feira (data local de São Paulo, "AAAA-MM-DD") da semana de `date`.
 * O ciclo semanal do farmer vira na segunda-feira às 00h no horário de Brasília.
 */
export function weekStart(date: Date): string {
  const [y, m, d] = localDate(date).split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const weekday = new Date(utcMidnight).getUTCDay(); // 0 = domingo
  const daysSinceMonday = (weekday + 6) % 7;
  return new Date(utcMidnight - daysSinceMonday * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Semanas completas entre duas datas (para o alerta de "X semanas sem pedido"). */
export function weeksBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (7 * MS_PER_DAY)));
}

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/** "AAAA-MM-DD" (data escolhida num input date) → meio-dia em Brasília, imune a fuso. */
export function localDateToTimestamp(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
