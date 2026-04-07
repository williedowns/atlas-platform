/**
 * Salta platform brand constants.
 * PLATFORM_NAME = the SaaS product ("Salta")
 * COMPANY_NAME  = the tenant/customer ("Atlas Spas")
 *
 * When multi-tenancy is live, COMPANY_NAME will be loaded from the
 * organizations table based on the authenticated user's org.
 */

export const PLATFORM_NAME =
  process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Salta";

export const COMPANY_NAME =
  process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Atlas Spas";
