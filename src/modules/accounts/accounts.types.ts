import { AccountRole } from "../../shared/roles";

export type AccountStatus = "active" | "disabled";

export interface Account {
  _id: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  displayName?: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAccount {
  _id: string;
  email: string;
  displayName?: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}
