/**
 * Cross-state tax sourcing decision — extracted from Step3Products + loadFromQuote.
 *
 * Atlas's default is delivery to the customer's home. When the customer's
 * state differs from the show/location state AND we can resolve that state's
 * rate, the destination state is the correct tax jurisdiction (per Avalara
 * consultation 2026-05-28 and TX Tax Code §151.330).
 *
 * Same-state customers: no override — show/location address is correct.
 * Out-of-coverage customer states: no override — falls back to show/location
 * rate (best we can do without that state's lookup).
 *
 * Single source of truth for the decision so the two callsites (wizard
 * Step3Products + quote→contract loadFromQuote) can never drift.
 */

const COVERED_STATES = new Set(["TX", "LA", "OK", "KS", "AR"]);

export interface ShipToAddress {
  line1: string;
  city: string;
  region: string; // 2-letter state code
  postalCode: string;
  country: "US";
}

export interface DecideShipToArgs {
  /** Customer object from the wizard draft or quote row */
  customer?: {
    state?: string | null;
    address?: string | null;
    city?: string | null;
    zip?: string | null;
  } | null;
  /** Show object — `state` field used to compare against customer */
  show?: { state?: string | null } | null;
  /** Location object — `state` field used when no show is present */
  location?: { state?: string | null } | null;
}

/**
 * Returns a ship_to_address payload when the wizard should override the
 * default show/location-based sourcing. Returns `undefined` when the default
 * behavior is correct (same-state customer, missing customer info, or
 * customer state not in our coverage).
 */
export function decideShipToAddress(args: DecideShipToArgs): ShipToAddress | undefined {
  const customer = args.customer;
  if (!customer) return undefined;
  if (!customer.address || !customer.city) return undefined;
  if (!customer.zip || !/^\d{5}$/.test(customer.zip)) return undefined;

  const customerState = (customer.state ?? "").trim().toUpperCase();
  if (!COVERED_STATES.has(customerState)) return undefined;

  const venueState = (args.show?.state ?? args.location?.state ?? "")
    .trim()
    .toUpperCase();
  if (customerState === venueState) return undefined;

  return {
    line1: customer.address,
    city: customer.city,
    region: customerState,
    postalCode: customer.zip,
    country: "US",
  };
}
