/**
 * Parses a dollar amount typed by a donor into cents, accepting both `.` and `,` as the decimal
 * separator ("50,5" in fr/es, "50.5" in en). A separator followed by exactly three digits is read
 * as a thousands separator ("1,500" / "1.500" → $1,500); thousands groups must be consistent and
 * can't reuse the decimal separator. Returns null when the input isn't a valid amount.
 */
export const parseAmountToCents = (raw: string): number | null => {
  const cleaned = raw.replace(/USD|US|[\s  $]/gi, "");
  if (!cleaned) return null;

  const lastIndex = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  const digitsAfterLast = lastIndex === -1 ? 0 : cleaned.length - lastIndex - 1;
  const lastIsDecimal = lastIndex !== -1 && digitsAfterLast > 0 && digitsAfterLast <= 2;

  const integerPart = lastIsDecimal ? cleaned.slice(0, lastIndex) : cleaned;
  const fractionPart = lastIsDecimal ? cleaned.slice(lastIndex + 1) : "";
  const decimalSeparator = lastIsDecimal ? cleaned[lastIndex] : null;

  if (/[.,]/.test(integerPart)) {
    const groupSeparators = new Set(integerPart.match(/[.,]/g));
    if (!/^\d{1,3}([.,]\d{3})+$/.test(integerPart)) return null;
    if (groupSeparators.size > 1) return null;
    if (decimalSeparator && groupSeparators.has(decimalSeparator)) return null;
  } else if (!/^\d+$/.test(integerPart)) {
    return null;
  }
  if (!/^\d{0,2}$/.test(fractionPart)) return null;

  return Number(integerPart.replace(/[.,]/g, "")) * 100 + Number(fractionPart.padEnd(2, "0"));
};

/** Currency format for gift amounts: "$100", "$77.55", "100 $US". */
export const MONEY_FORMAT = {
  style: "currency",
  currency: "USD",
  trailingZeroDisplay: "stripIfInteger",
} as const satisfies Intl.NumberFormatOptions;
