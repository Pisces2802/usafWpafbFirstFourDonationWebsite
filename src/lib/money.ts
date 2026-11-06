/**
 * Parses a dollar amount typed by a donor into cents, accepting both `.` and `,` as the decimal
 * separator ("50,5" in fr/es, "50.5" in en). A separator followed by exactly three digits is read
 * as a thousands separator ("1,500" / "1.500" → $1,500). Returns null when the input isn't a
 * valid amount.
 */
export const parseAmountToCents = (raw: string): number | null => {
  const cleaned = raw.replace(/[\s  $]|US|USD/gi, "");
  if (!cleaned) return null;

  const separators = cleaned.match(/[.,]/g) ?? [];
  const lastIndex = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  const digitsAfterLast = lastIndex === -1 ? 0 : cleaned.length - lastIndex - 1;
  const lastIsDecimal = lastIndex !== -1 && digitsAfterLast > 0 && digitsAfterLast <= 2;

  const integerPart = lastIsDecimal ? cleaned.slice(0, lastIndex) : cleaned;
  const fractionPart = lastIsDecimal ? cleaned.slice(lastIndex + 1) : "";
  const integerDigits = integerPart.replace(/[.,]/g, "");

  if (separators.length > 0 && !lastIsDecimal && digitsAfterLast !== 3) return null;
  if (!/^\d+$/.test(integerDigits) || !/^\d{0,2}$/.test(fractionPart)) return null;

  return Number(integerDigits) * 100 + Number(fractionPart.padEnd(2, "0"));
};
