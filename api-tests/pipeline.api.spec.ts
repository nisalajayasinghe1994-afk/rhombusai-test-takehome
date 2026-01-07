import { test, expect, request } from "@playwright/test";
import { Api } from "./api.config";

test.use({ storageState: ".auth/storageState.json" });

test("Auth/session: /me returns 200 and a user payload", async ({ playwright, baseURL }) => {
  const ctx = await request.newContext({
    baseURL,
    storageState: ".auth/storageState.json"
  });

  const res = await ctx.get(Api.me);
  expect(res.status(), "Expected authenticated /me to succeed").toBe(200);

  const json = await res.json();
  // Keep assertions loose: we just want stable contract checks
  expect(json).toBeTruthy();
});

test("Negative: unauthenticated /me returns 401/403", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.get(Api.me);

  // Depending on implementation: 401 Unauthorized or 403 Forbidden
  expect([401, 403]).toContain(res.status());
});
