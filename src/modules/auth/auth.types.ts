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
  childLinkId?: string;
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

export interface GuardianTutorAccessChild {
  studentLinkId: string;
  childLinkId: string;
  studentId: string;
  studentName?: string;
  keyStage?: string;
  year?: string;
  scopes: LinkScope[];
  activatedAt?: string;
}

export interface GuardianTutorAccess {
  tutorAccountId: string;
  tutorName?: string;
  tutorEmail?: string;
  children: GuardianTutorAccessChild[];
}

export type ChildLinkStatus = "pending" | "active" | "revoked";

export interface ChildLink {
  _id: string;
  studentId?: string;
  studentName?: string;
  keyStage?: string;
  year?: string;
  guardianAccountId: string;
  childAccountId?: string;
  code: string;
  canLogEntries: boolean;
  status: ChildLinkStatus;
  expiresAt?: string;
  activatedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}
