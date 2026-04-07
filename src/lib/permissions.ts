export type Feature = "contracts" | "leads" | "shows" | "analytics" | "inventory" | "bookkeeper";
export type RolePermissions = Record<string, Record<Feature, boolean>>;

export const FEATURES: { key: Feature; label: string; description: string }[] = [
  { key: "contracts", label: "Contracts", description: "View and create sales contracts" },
  { key: "leads",     label: "Leads",     description: "Lead pipeline and management" },
  { key: "shows",     label: "Shows",     description: "Show schedule and event check-in" },
  { key: "analytics", label: "Analytics", description: "Revenue, leaderboard, show reports" },
  { key: "inventory", label: "Inventory", description: "Inventory units and stock management" },
  { key: "bookkeeper",label: "Finance",   description: "Bookkeeper dashboard and CC reports" },
];

export const ROLES_WITH_PERMISSIONS = [
  { key: "manager",    label: "Manager" },
  { key: "sales_rep",  label: "Sales Rep" },
  { key: "bookkeeper", label: "Bookkeeper" },
  { key: "field_crew", label: "Field Crew" },
];

export const DEFAULT_PERMISSIONS: RolePermissions = {
  manager:    { contracts: true,  leads: true,  shows: true,  analytics: true,  inventory: true,  bookkeeper: true  },
  sales_rep:  { contracts: true,  leads: true,  shows: true,  analytics: false, inventory: false, bookkeeper: false },
  bookkeeper: { contracts: true,  leads: false, shows: false, analytics: false, inventory: false, bookkeeper: true  },
  field_crew: { contracts: false, leads: false, shows: false, analytics: false, inventory: false, bookkeeper: false },
};

/**
 * Check whether a role has access to a feature.
 * Admin always has full access regardless of stored permissions.
 */
export function hasPermission(
  orgPerms: RolePermissions | null | undefined,
  role: string | null | undefined,
  feature: Feature
): boolean {
  if (!role) return false;
  if (role === "admin") return true; // Admin always has full access

  const perms = orgPerms ?? DEFAULT_PERMISSIONS;
  return perms[role]?.[feature] ?? DEFAULT_PERMISSIONS[role]?.[feature] ?? false;
}
