import { describe, it, expect } from "vitest";
import { invoiceStatusBadge } from "@/src/app/(public)/payments/checkout/_components/invoiceStatusBadge";

describe("invoiceStatusBadge", () => {
  it("maps paid -> primary", () => {
    expect(invoiceStatusBadge("paid")).toEqual({
      variant: "primary",
      label: "Paid",
    });
  });

  it("maps open -> warning", () => {
    expect(invoiceStatusBadge("open")).toEqual({
      variant: "warning",
      label: "Open",
    });
  });

  it("maps uncollectible -> destructive", () => {
    expect(invoiceStatusBadge("uncollectible")).toEqual({
      variant: "destructive",
      label: "Uncollectible",
    });
  });

  it("maps void -> secondary", () => {
    expect(invoiceStatusBadge("void")).toEqual({
      variant: "secondary",
      label: "Void",
    });
  });

  it("falls back to secondary with the raw status for unknown values", () => {
    expect(invoiceStatusBadge("draft")).toEqual({
      variant: "secondary",
      label: "draft",
    });
  });

  it("falls back to secondary with 'Unknown' for null", () => {
    expect(invoiceStatusBadge(null)).toEqual({
      variant: "secondary",
      label: "Unknown",
    });
  });

  it("never uses the outline variant (invisible on the white billing card)", () => {
    for (const status of [
      "paid",
      "open",
      "uncollectible",
      "void",
      "draft",
      null,
    ]) {
      expect(invoiceStatusBadge(status).variant).not.toBe("outline");
    }
  });
});
