/**
 * Salta platform brand constants.
 * PLATFORM_NAME  = the SaaS product ("Salta")
 * COMPANY_NAME   = the customer-facing retail brand ("Atlas Spas")
 * CORPORATE_NAME = the legal parent entity ("Atlas Building Systems, Inc.")
 *                  — used on owner-facing reports + legal footers
 *
 * When multi-tenancy is live, COMPANY_NAME will be loaded from the
 * organizations table based on the authenticated user's org.
 */

export const PLATFORM_NAME =
  process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Salta";

export const COMPANY_NAME =
  process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Atlas Spas";

export const CORPORATE_NAME =
  process.env.NEXT_PUBLIC_CORPORATE_NAME ?? "Atlas Building Systems, Inc.";
