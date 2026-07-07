import { describe, it, expect } from "vitest";
import { formatMoney } from "@/src/utils/formatMoney";

// Note: the exact currency PREFIX ("$" vs "CA$") is ICU/CLDR-version dependent
// and differs between the browser and Node, so we assert the amount formatting
// rather than the exact prefix string.
describe("formatMoney", () => {
  it("converts cents to a 2-decimal amount", () => {
    expect(formatMoney(14986, "cad")).toMatch(/149\.86$/);
    expect(formatMoney(3164, "cad")).toMatch(/31\.64$/);
  });

  it("always shows two fraction digits", () => {
    expect(formatMoney(0, "usd")).toMatch(/0\.00$/);
    expect(formatMoney(500, "usd")).toMatch(/5\.00$/);
  });

  it("includes a currency symbol", () => {
    expect(formatMoney(14986, "cad")).toContain("$");
  });

  it("is case-insensitive on the currency code", () => {
    expect(formatMoney(14986, "CAD")).toBe(formatMoney(14986, "cad"));
  });
});
