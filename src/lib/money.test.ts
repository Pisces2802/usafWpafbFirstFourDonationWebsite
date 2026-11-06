import { describe, expect, it } from "vitest";

import { parseAmountToCents } from "@/lib/money";

describe("parseAmountToCents", () => {
  it.each([
    ["40", 4000],
    ["$40", 4000],
    ["50.5", 5050],
    ["50,5", 5050],
    ["50,50", 5050],
    ["1,500", 150000],
    ["1.500", 150000],
    ["1,500.25", 150025],
    ["1.500,25", 150025],
    ["1 500,25 $US", 150025],
    ["100 USD", 10000],
  ])("parses %s as %i cents", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "50,", "1,5000", "12.345.6", "1,500.000", "1.500,000.5", "-5"])(
    "rejects %j",
    (input) => {
      expect(parseAmountToCents(input)).toBeNull();
    },
  );
});
