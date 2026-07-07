/**
 * Formats an amount in minor units (cents) as a localized currency string.
 *
 * The currency code is case-insensitive; Stripe returns lowercase ISO codes
 * ("cad", "usd"), which are uppercased so `Intl.NumberFormat` always receives a
 * valid ISO 4217 code.
 * @param cents - Amount in minor units, e.g. `14986` for 149.86.
 * @param currency - ISO 4217 currency code, case-insensitive.
 * @returns Localized currency string, e.g. `"CA$149.86"`.
 */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
