import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "../../config/env";
import { unauthorized } from "../../shared/apiError";
import { AccountRole } from "../../shared/roles";
import { Account } from "../accounts/accounts.types";

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: AccountRole;
  type: "access";
  jti: string;
  iat: number;
  exp: number;
}

export function signAccessToken(account: Account): {
  accessToken: string;
  expiresAt: string;
} {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + env.JWT_ACCESS_TTL_SECONDS;
  const claims: AccessTokenClaims = {
    sub: account._id,
    email: account.email,
    role: account.role,
    type: "access",
    jti: randomUUID(),
    iat: issuedAt,
    exp: expiresAt
  };

  return {
    accessToken: signJwt(claims),
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const claims = verifyJwt(token);

  if (claims.type !== "access") {
    throw unauthorized("Invalid token type.");
  }

  return claims;
}

function signJwt(claims: AccessTokenClaims): string {
  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT"
  };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(claims);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(signingInput);

  return `${signingInput}.${signature}`;
}

function verifyJwt(token: string): AccessTokenClaims {
  const parts = token.split(".");

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw unauthorized("Invalid access token.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signingInput);

  if (!safeEqual(encodedSignature, expectedSignature)) {
    throw unauthorized("Invalid access token.");
  }

  const header = decodeJson<JwtHeader>(encodedHeader);

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw unauthorized("Invalid access token.");
  }

  const claims = decodeJson<AccessTokenClaims>(encodedPayload);

  if (claims.type !== "access" || !claims.sub || !claims.exp) {
    throw unauthorized("Invalid access token.");
  }

  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    throw unauthorized("Access token has expired.");
  }

  return claims;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson<T>(value: string): T {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    throw unauthorized("Invalid access token.");
  }
}

function sign(value: string): string {
  return createHmac("sha256", env.JWT_ACCESS_SECRET).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
