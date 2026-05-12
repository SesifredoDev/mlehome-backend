import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

import { badRequest } from "../../shared/apiError";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1
};

export async function hashPassword(password: string): Promise<string> {
  validatePasswordStrength(password);

  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);

  return [
    "scrypt",
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt,
    derivedKey.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = storedHash.split("$");

  if (scheme !== "scrypt" || !n || !r || !p || !salt || !key) {
    return false;
  }

  const expectedKey = Buffer.from(key, "base64url");
  const actualKey = await deriveKey(password, salt, expectedKey.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });

  if (actualKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(actualKey, expectedKey);
}

function deriveKey(
  password: string,
  salt: string,
  keyLength: number,
  options: typeof SCRYPT_OPTIONS
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function validatePasswordStrength(password: string): void {
  if (password.length < 10) {
    throw badRequest("Password must be at least 10 characters.");
  }
}
