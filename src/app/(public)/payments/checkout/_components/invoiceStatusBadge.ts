// Maps a Stripe invoice status to a Badge variant + display label.
export type InvoiceBadgeVariant =
  | "primary"
  | "warning"
  | "destructive"
  | "secondary";

export function invoiceStatusBadge(status: string | null): {
  variant: InvoiceBadgeVariant;
  label: string;
} {
  switch (status) {
    case "paid":
      return { variant: "primary", label: "Paid" };
    case "open":
      return { variant: "warning", label: "Open" };
    case "uncollectible":
      return { variant: "destructive", label: "Uncollectible" };
    case "void":
      return { variant: "secondary", label: "Void" };
    default:
      return { variant: "secondary", label: status ?? "Unknown" };
  }
}
