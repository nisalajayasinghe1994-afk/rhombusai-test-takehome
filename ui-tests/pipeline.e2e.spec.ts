import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: ".auth/storageState.json" });

test("AI Pipeline Flow", async ({ page }) => {

  const projectName = `test-${Date.now()}`;
  const csvPath = path.resolve("fixtures/messy-input.csv");


});
