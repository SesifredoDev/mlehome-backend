export const accountRoles = ["parent", "child", "tutor", "integration"] as const;

export type AccountRole = (typeof accountRoles)[number];

export function parseAccountRole(value: unknown): AccountRole | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return accountRoles.includes(value as AccountRole) ? (value as AccountRole) : undefined;
}
