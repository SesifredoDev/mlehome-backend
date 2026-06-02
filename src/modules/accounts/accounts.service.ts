import { getCollection } from "../../db/mongo";
import { badRequest, notFound } from "../../shared/apiError";
import { createId } from "../../shared/ids";
import { AccountRole } from "../../shared/roles";
import { nowIso } from "../../shared/time";
import { hashPassword } from "./password.service";
import { Account, AccountStatus, PublicAccount } from "./accounts.types";

interface RegisterAccountInput {
  email: string;
  password: string;
  displayName?: string;
  role: AccountRole;
}

export async function registerAccount(input: RegisterAccountInput): Promise<PublicAccount> {
  const accounts = await getCollection<Account>("accounts");
  const emailNormalized = normalizeEmail(input.email);
  const existing = await accounts.findOne({ emailNormalized });

  if (existing) {
    throw badRequest("An account with this email already exists.");
  }

  const timestamp = nowIso();
  const account: Account = {
    _id: createId("acct"),
    email: input.email.trim(),
    emailNormalized,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName?.trim() || undefined,
    role: input.role,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await accounts.insertOne(account);
  return toPublicAccount(account);
}

export async function getAccountByEmail(email: string): Promise<Account | undefined> {
  const accounts = await getCollection<Account>("accounts");

  return (await accounts.findOne({ emailNormalized: normalizeEmail(email) })) ?? undefined;
}

export async function getAccountById(accountId: string): Promise<Account> {
  const accounts = await getCollection<Account>("accounts");
  const account = await accounts.findOne({ _id: accountId });

  if (!account) {
    throw notFound("Account was not found.");
  }

  return account;
}

export async function updateAccountStatus(
  accountId: string,
  status: AccountStatus
): Promise<Account> {
  const accounts = await getCollection<Account>("accounts");
  const updatedAt = nowIso();
  const result = await accounts.findOneAndUpdate(
    { _id: accountId },
    {
      $set: {
        status,
        updatedAt
      }
    },
    { returnDocument: "after" }
  );

  if (!result) {
    throw notFound("Account was not found.");
  }

  return result;
}

export function toPublicAccount(account: Account): PublicAccount {
  return {
    _id: account._id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
