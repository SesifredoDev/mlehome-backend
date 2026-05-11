export const linkScopes = [
  "stats:read",
  "entries:create",
  "evidence:create",
  "reports:tutor"
] as const;

export type LinkScope = (typeof linkScopes)[number];

export type StudentLinkStatus = "pending" | "active" | "revoked";

export interface StudentLink {
  _id: string;
  studentId: string;
  guardianAccountId: string;
  tutorAccountId?: string;
  code: string;
  scopes: LinkScope[];
  status: StudentLinkStatus;
  expiresAt?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}
