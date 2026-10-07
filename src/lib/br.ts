// Validações de documentos e contatos brasileiros.

/**
 * Normaliza um CNPJ: remove pontuação e deixa em maiúsculas.
 * Desde julho/2026 a Receita emite CNPJ alfanumérico (12 caracteres A-Z/0-9 + 2 dígitos
 * verificadores numéricos); os CNPJs antigos, só com números, continuam válidos.
 */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Valida dígitos verificadores (módulo 11) de CNPJ numérico ou alfanumérico. */
export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // 00000000000000, 11111111111111…

  // Valor de cada caractere = código ASCII − 48 ("0"→0 … "9"→9, "A"→17 … "Z"→42).
  const values = [...cnpj].map((char) => char.charCodeAt(0) - 48);
  const checkDigit = (length: number) => {
    let weight = length - 7; // 5 para o 1º dígito, 6 para o 2º
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += values[i] * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return checkDigit(12) === values[12] && checkDigit(13) === values[13];
}

/** Telefone brasileiro → só dígitos com DDD (10 ou 11). Aceita +55. null se inválido. */
export function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits.startsWith("0")) return null;
  return digits;
}

/** Link para abrir conversa no WhatsApp (o app/site do WhatsApp, sem integração). */
export function whatsappLink(digits: string): string {
  return `https://wa.me/55${digits}`;
}
