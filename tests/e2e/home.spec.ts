import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixturePath = path.resolve(
  process.cwd(),
  "statements/Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf",
);

test("loads an accessible, keyboard-operable upload shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /pampi card/i })).toBeVisible();
  await expect(page.getByLabel("Choose a PDF statement")).toBeEnabled();
  await page.getByRole("button", { name: /use dark theme/i }).focus();
  await expect(page.getByRole("button", { name: /use dark theme/i })).toBeFocused();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("rejects invalid and oversized uploads and handles a cancelled picker", async ({ page }) => {
  await page.goto("/");
  const input = page.locator('input[type="file"]');

  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByText(/please upload a pdf statement/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /download combined csv/i })).toHaveCount(0);

  await input.setInputFiles({
    name: "oversized.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0x25),
  });
  await expect(page.getByText(/no larger than 10 mib/i)).toBeVisible();

  await page.getByRole("button", { name: /upload new statement/i }).click();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Select File", { exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([]);
  await expect(page.getByText("No statement loaded yet.")).toBeVisible();
});

test("uploads, reconciles, switches cards, and downloads BOM-prefixed CSV files", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);

  await expect(page.getByRole("button", { name: /download combined csv/i })).toBeVisible();
  await expect(page.getByText("16 March 2026")).toBeVisible();
  await expect(page.getByText("$3,575.18").first()).toBeVisible();
  await expect(page.getByText("7248, 8489")).toBeVisible();
  await expect(page.getByRole("table", { name: /statement reconciliation totals/i })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("7248");

  const cardDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download selected card 7248 csv/i }).click();
  const cardDownload = await cardDownloadPromise;
  expect(cardDownload.suggestedFilename()).toBe("2026-Feb-7248-card-transactions.csv");

  await page.getByRole("combobox").selectOption("8489");
  await expect(page.getByText("OPENAI *CHATGPT SUBSCR OPENAI.COM CA")).toBeVisible();
  await expect(page.getByRole("button", { name: /download selected card 8489 csv/i })).toBeVisible();

  const combinedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download combined csv/i }).click();
  const combinedDownload = await combinedDownloadPromise;
  const downloadPath = await combinedDownload.path();

  expect(combinedDownload.suggestedFilename()).toBe("2026-Feb-card-transactions.csv");
  expect(downloadPath).not.toBeNull();
  const csvData = await readFile(downloadPath!, "utf8");
  expect(csvData.startsWith("\uFEFFCard Number")).toBe(true);
  expect(csvData.split("\n")[1]).toMatch(/^8489,.*,,,7248,/);
  expect(csvData).not.toContain("BPAY PAYMENT");
  expect(consoleErrors).toEqual([]);
});

test("serves strict production security headers", async ({ request }) => {
  test.skip(process.env.PLAYWRIGHT_USE_PRODUCTION !== "1", "Production server only");
  const response = await request.get("/");

  expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(response.headers()["content-security-policy"]).not.toContain("'unsafe-eval'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["cross-origin-opener-policy"]).toBe("same-origin");
});
