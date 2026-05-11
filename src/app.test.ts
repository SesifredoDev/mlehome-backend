import { describe, expect, it } from "vitest";

import { buildApp } from "./app";

describe("app", () => {
  it("responds to health checks", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "mlehome-backend"
    });
  });
});
