import { expect, test } from "@playwright/test";
import path from "node:path";

test("loads the upload shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /upload your credit card statement/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel(/select pdf file/i)).toBeVisible();
});

test("shows an error for a non-pdf upload", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel(/select pdf file/i).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });

  await expect(
    page.getByText("Please upload a PDF statement. Other file types are not supported."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /download combined csv/i })).toHaveCount(0);
});

test("extracts text from the fixture pdf", async ({ page }) => {
  await page.goto("/");

  const fixturePath = path.resolve(
    process.cwd(),
    "statements/Statement_CRDd8abc3f468af07377c2867bd15418f734afeca244f8b9e685d.pdf",
  );

  await page.getByLabel(/select pdf file/i).setInputFiles(fixturePath);

  await expect(page.getByRole("link", { name: /download combined csv/i })).toBeVisible();
  await expect(page.getByText("Statement Details").first()).toBeVisible();
  await expect(page.getByText("15 May 2026")).toBeVisible();
  await expect(page.getByText("$5,323.21").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("•••• 7248").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("•••• 8489").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/raw page text debug snapshot/i)).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveValue("7248");
  await expect(
    page.getByText("OPENAI *CHATGPT SUBSCR OPENAI.COM CA").filter({ visible: true }),
  ).toHaveCount(0);

  const tableScroller = page.locator('[class*="resultsTableWrap"]').first();
  await expect(tableScroller).toBeVisible();
  await expect
    .poll(async () =>
      tableScroller.evaluate(
        (element) =>
          getComputedStyle(element).overflowY === "auto" &&
          element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);

  await page.getByRole("combobox").selectOption("8489");
  await expect(page.getByRole("combobox")).toHaveValue("8489");
  await expect(
    page.getByText("OPENAI *CHATGPT SUBSCR OPENAI.COM CA").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("AAMI  INSURANCE AUSTRALIA").filter({ visible: true }),
  ).toHaveCount(0);
});
