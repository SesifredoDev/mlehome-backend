import { describe, expect, it } from "vitest";

import { Account } from "../accounts/accounts.types";
import { signAccessToken, verifyAccessToken } from "./jwt.service";

describe("jwt service", () => {
  it("signs and verifies access tokens", () => {
    const account: Account = {
      _id: "acct_test",
      email: "parent@example.com",
      emailNormalized: "parent@example.com",
      passwordHash: "not-used",
      role: "parent",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tokenSet = signAccessToken(account);
    const claims = verifyAccessToken(tokenSet.accessToken);

    expect(claims.sub).toBe(account._id);
    expect(claims.email).toBe(account.email);
    expect(claims.role).toBe(account.role);
    expect(claims.type).toBe("access");
  });
});
