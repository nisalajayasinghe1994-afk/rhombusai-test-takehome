import { chromium, FullConfig } from "@playwright/test";
import "dotenv/config";
import path from "path";


async function globalSetup(config: FullConfig) {
  const email = process.env.RHOMBUS_EMAIL;
  const password = process.env.RHOMBUS_PASSWORD;

  const projectName = `test-${Date.now()}`;


  if (!email || !password) {
    throw new Error("Missing RHOMBUS_EMAIL or RHOMBUS_PASSWORD in environment.");
  }

const browser = await chromium.launch({
  headless: false,
  slowMo: 200
});
const page = await browser.newPage();

  const baseURL = process.env.RHOMBUS_BASE_URL ?? "https://rhombusai.com/";
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });

  // Entry point: "Open App" from marketing page (documented flow is sign in then workflow page). :contentReference[oaicite:1]{index=1}
  const openApp = page.getByRole("link", { name: /open app/i });
  if (await openApp.isVisible().catch(() => false)) {
    await openApp.click();
  }

  // Generic sign-in. If the app routes differently in your account, adjust these two locators only.
  // The goal is to land on the workflow/projects screen.
  //await page.getByRole("link", { name: /Log In/i }).click().catch(() => {});
  await page.getByRole("button", { name: /Log In/i }).click();

  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  //await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Wait for a stable authenticated signal (projects panel / create project button).
  //await page.getByRole("button", { name: /new project|create project/i }).waitFor({ timeout: 60_000 });
  

  await page.getByRole('button', { name: 'Create a project' }).click();
await page.getByRole('textbox', { name: 'Enter project name' }).fill(projectName);
await page.getByRole('button', { name: 'Create' }).click();


const plusMenuTrigger = page.locator('button:has(svg.lucide-plus), [role="button"]:has(svg.lucide-plus)').first();
  await plusMenuTrigger.waitFor({ state: "visible", timeout: 30_000 });
  await plusMenuTrigger.click();

   const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 15_000 });

const csvPath = path.resolve("fixtures/messy-input.csv");
  
  await fileInput.setInputFiles(csvPath);


    const uploadBtn = page.getByRole("button", { name: /^upload$/i });
  if (await uploadBtn.isVisible().catch(() => false)) {
    await uploadBtn.click();
  }

    const promptBox = page.getByRole("textbox", { name: /what would you like to/i }).first();
  await promptBox.waitFor({ state: "visible", timeout: 30_000 });
  await promptBox.fill("remove duplicates and give me new csv to download");

    await promptBox.press("Enter").catch(() => {});

  // Assert file appears
  // 8) Click "Add new file"
  //await page.getByRole("menuitem", { name: /add new file/i }).waitFor({ state: "visible", timeout: 30_000 });



  await page.context().storageState({ path: ".auth/storageState.json" });
  //await browser.close();
}

export default globalSetup;
