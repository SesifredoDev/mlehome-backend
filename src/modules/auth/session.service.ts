import { createHash, randomBytes } from "node:crypto";

import { env } from "../../config/env";
import { getCollection } from "../../db/mongo";
import { unauthorized } from "../../shared/apiError";
import { createId } from "../../shared/ids";
import {
  getAccountByEmail,
  getAccountById,
  toPublicAccount
} from "../accounts/accounts.service";
import { Account, PublicAccount } from "../accounts/accounts.types";
import { verifyPassword } from "../accounts/password.service";
import { signAccessToken } from "./jwt.service";
import { RefreshTokenRecord } from "./session.types";

interface ClientContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthTokenSet {
  account: PublicAccount;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: "Bearer";
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  context: ClientContext;
}): Promise<AuthTokenSet> {
  const account = await getAccountByEmail(input.email);

  if (!account || account.status !== "active") {
    throw unauthorized("Invalid email or password.");
  }

  const passwordMatches = await verifyPassword(input.password, account.passwordHash);

  if (!passwordMatches) {
    throw unauthorized("Invalid email or password.");
  }

  return issueTokenSet(account, input.context);
}

export async function refreshAuthTokens(input: {
  refreshToken: string;
  context: ClientContext;
}): Promise<AuthTokenSet> {
  const refreshTokens = await getCollection<RefreshTokenRecord>("refresh_tokens");
  const existingHash = hashRefreshToken(input.refreshToken);
  const existing = await refreshTokens.findOne({ tokenHash: existingHash });

  if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
    throw unauthorized("Invalid refresh token.");
  }

  const account = await getAccountById(existing.accountId);

  if (account.status !== "active") {
    throw unauthorized("Account is disabled.");
  }

  const nextRawToken = createRefreshToken();
  const nextHash = hashRefreshToken(nextRawToken);
  const now = new Date();
  const nextExpiresAt = createRefreshExpiry();
  const nextRecord: RefreshTokenRecord = {
    _id: createId("rtok"),
    accountId: account._id,
    tokenHash: nextHash,
    userAgent: input.context.userAgent,
    ipAddress: input.context.ipAddress,
    expiresAt: nextExpiresAt,
    createdAt: now,
    updatedAt: now
  };

  await refreshTokens.insertOne(nextRecord);
  const revokeResult = await refreshTokens.updateOne(
    { _id: existing._id, revokedAt: { $exists: false } },
    {
      $set: {
        revokedAt: now,
        replacedByTokenHash: nextHash,
        updatedAt: now
      }
    }
  );

  if (revokeResult.modifiedCount !== 1) {
    await refreshTokens.updateOne(
      { _id: nextRecord._id },
      {
        $set: {
          revokedAt: now,
          updatedAt: now
        }
      }
    );
    throw unauthorized("Invalid refresh token.");
  }

  return buildTokenSet(account, nextRawToken, nextExpiresAt);
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const refreshTokens = await getCollection<RefreshTokenRecord>("refresh_tokens");
  const now = new Date();

  await refreshTokens.updateOne(
    { tokenHash: hashRefreshToken(refreshToken), revokedAt: { $exists: false } },
    {
      $set: {
        revokedAt: now,
        updatedAt: now
      }
    }
  );
}

export async function revokeAllRefreshTokens(accountId: string): Promise<number> {
  const refreshTokens = await getCollection<RefreshTokenRecord>("refresh_tokens");
  const now = new Date();
  const result = await refreshTokens.updateMany(
    { accountId, revokedAt: { $exists: false } },
    {
      $set: {
        revokedAt: now,
        updatedAt: now
      }
    }
  );

  return result.modifiedCount;
}

async function issueTokenSet(account: Account, context: ClientContext): Promise<AuthTokenSet> {
  const rawRefreshToken = createRefreshToken();
  const refreshTokenExpiresAt = createRefreshExpiry();
  const now = new Date();
  const refreshTokens = await getCollection<RefreshTokenRecord>("refresh_tokens");
  const refreshRecord: RefreshTokenRecord = {
    _id: createId("rtok"),
    accountId: account._id,
    tokenHash: hashRefreshToken(rawRefreshToken),
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
    expiresAt: refreshTokenExpiresAt,
    createdAt: now,
    updatedAt: now
  };

  await refreshTokens.insertOne(refreshRecord);

  return buildTokenSet(account, rawRefreshToken, refreshTokenExpiresAt);
}

function buildTokenSet(
  account: Account,
  refreshToken: string,
  refreshTokenExpiresAt: Date
): AuthTokenSet {
  const accessToken = signAccessToken(account);

  return {
    account: toPublicAccount(account),
    accessToken: accessToken.accessToken,
    accessTokenExpiresAt: accessToken.expiresAt,
    refreshToken,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    tokenType: "Bearer"
  };
}

function createRefreshToken(): string {
  return randomBytes(64).toString("base64url");
}

function createRefreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}
