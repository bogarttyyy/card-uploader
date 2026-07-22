import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixturePath = path.resolve(
  process.env.STATEMENT_FIXTURE_DIRECTORY ?? path.join(process.cwd(), "statements"),
  "Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf",
);

test("loads an accessible, keyboard-operable upload shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /pampi card/i })).toBeVisible();
  await expect(page.getByLabel("Choose a PDF statement")).toBeEnabled();
  await expect(page.getByText("PDF only · Up to 10 MiB")).toBeVisible();
  await page.getByLabel("Choose a PDF statement").focus();
  const focusShadow = await page
    .getByTestId("file-drop-zone")
    .evaluate((element) => getComputedStyle(element).boxShadow);
  expect(focusShadow).not.toBe("none");
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
  await page.getByText("Choose PDF", { exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([]);
  await expect(page.getByRole("heading", { name: /upload a macquarie card statement/i })).toBeVisible();
  await expect(page.getByText(/no statement loaded yet/i)).toHaveCount(0);
});

test("uploads, reconciles, responds without overflow, and downloads CSV files", async ({
  page,
}) => {
  test.skip(!existsSync(fixturePath), "Local statement fixture is not available");
  await page.setViewportSize({ width: 1440, height: 900 });
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
  const reconciliation = page.getByText(/all statement totals match/i);
  await expect(reconciliation).toBeVisible();
  await expect(reconciliation.locator("xpath=ancestor::details")).not.toHaveAttribute("open", "");
  await reconciliation.click();
  await expect(page.getByRole("table", { name: /statement reconciliation totals/i })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("7248");

  const desktopAccessibility = await new AxeBuilder({ page }).analyze();
  expect(desktopAccessibility.violations).toEqual([]);

  await expect(page.getByText(/show excluded rows/i)).toBeVisible();
  await page.getByText(/show excluded rows/i).click();
  await expect(page.getByRole("table", { name: /excluded payments for card ending 7248/i })).toBeVisible();

  const cardDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download selected card 7248 csv/i }).click();
  const cardDownload = await cardDownloadPromise;
  expect(cardDownload.suggestedFilename()).toBe("2026-Feb-7248-card-transactions.csv");

  await page.getByRole("combobox").selectOption("8489");
  await expect(page.getByRole("cell", { name: "OPENAI *CHATGPT SUBSCR OPENAI.COM CA" })).toBeVisible();
  await expect(page.getByRole("button", { name: /download selected card 8489 csv/i })).toBeVisible();

  await page.getByRole("button", { name: /use dark theme/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(200);
  const darkAccessibility = await new AxeBuilder({ page }).analyze();
  expect(darkAccessibility.violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("table", { name: /transactions for card ending 8489/i })).toBeHidden();
  await expect(page.getByRole("group", { name: /transactions for card ending 8489/i })).toBeVisible();
  const mobileAccessibility = await new AxeBuilder({ page }).analyze();
  expect(mobileAccessibility.violations).toEqual([]);
  const documentDoesNotOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(documentDoesNotOverflow).toBe(true);
  const visibleSectionsFit = await page.locator("main section:visible").evaluateAll((sections) =>
    sections.every((section) => section.scrollWidth <= section.clientWidth + 1),
  );
  expect(visibleSectionsFit).toBe(true);

  await page.getByRole("button", { name: /use light theme/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

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
