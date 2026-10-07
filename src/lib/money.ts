// Conversão de valores monetários para centavos inteiros, SEM aritmética de ponto flutuante
// sobre o valor final. Aceita os formatos que aparecem em planilhas brasileiras.

export type MoneyParseResult = { ok: true; cents: number | null } | { ok: false };

/**
 * Converte um valor de célula em centavos.
 * - vazio, null, "-" → { ok: true, cents: null }   (sem preço)
 * - 10.23 (número)   → 1023
 * - "R$ 1.234,56"    → 123456
 * - "1,234.56"       → 123456
 * - "10,5"           → 1050
 * - "1.234"          → 123400  (ponto seguido de exatamente 3 dígitos = milhar, padrão BR)
 * Mais de 2 casas decimais são arredondadas (meio para cima).
 */
export function parseMoneyToCents(value: unknown): MoneyParseResult {
  if (value === null || value === undefined) return { ok: true, cents: null };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false };
    // toPrecision(15) remove o ruído binário (ex.: 1.005 → "1.00500000000000").
    return parseDecimalString(value.toPrecision(15));
  }
  if (typeof value !== "string") return { ok: false };

  const s = value.trim().replace(/^R\$/i, "").replace(/\s/g, ""); // \s inclui o espaço não separável do Excel
  if (s === "" || s === "-") return { ok: true, cents: null };
  if (!/^-?[\d.,]+$/.test(s)) return { ok: false };

  const commas = s.split(",").length - 1;
  const dots = s.split(".").length - 1;
  let normalized: string;

  if (commas > 0 && dots > 0) {
    // O separador que aparece por último é o decimal.
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    if (s.split(decimal).length - 1 > 1) return { ok: false };
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else if (commas > 0) {
    normalized = commas === 1 ? s.replace(",", ".") : s.split(",").join("");
  } else if (dots > 0) {
    const thousandsOnly = dots > 1 || /^-?\d{1,3}\.\d{3}$/.test(s);
    normalized = thousandsOnly ? s.split(".").join("") : s;
  } else {
    normalized = s;
  }
  return parseDecimalString(normalized);
}

/** Converte "123.45" (ponto decimal) em centavos. */
function parseDecimalString(s: string): MoneyParseResult {
  if (/e/i.test(s)) {
    // Notação científica (números enormes/minúsculos vindos do Excel): fora do domínio de preços.
    return { ok: false };
  }
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  const [intPart, fracPart = ""] = body.split(".");
  if (!/^\d+$/.test(intPart || "0") || !/^\d*$/.test(fracPart)) return { ok: false };

  const frac = fracPart.padEnd(3, "0");
  let cents = Number(intPart || "0") * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return { ok: false };
  return { ok: true, cents: negative ? -cents : cents };
}

/** Converte o texto de um input de valor ("1.234,56") em centavos; null se vazio. */
export function parseMoneyInput(value: string): number | null | "invalid" {
  const result = parseMoneyToCents(value);
  if (!result.ok) return "invalid";
  return result.cents;
}
