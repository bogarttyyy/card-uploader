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
    "statements/Statement_CRD9c58559b0ebf4c5a8d313f114865af1dd5032a0356e926bd83.pdf",
  );

  await page.getByLabel(/select pdf file/i).setInputFiles(fixturePath);

  await expect(page.getByRole("link", { name: /download combined csv/i })).toBeVisible();
  await expect(page.getByText("Statement Details").first()).toBeVisible();
  await expect(page.getByText("13 April 2026")).toBeVisible();
  await expect(page.getByText("$3,053.10").filter({ visible: true }).first()).toBeVisible();
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

test("shows mobile stacked results and sticky CSV action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const fixturePath = path.resolve(
    process.cwd(),
    "statements/Statement_CRD9c58559b0ebf4c5a8d313f114865af1dd5032a0356e926bd83.pdf",
  );

  await page.getByLabel(/select pdf file/i).setInputFiles(fixturePath);

  await expect(page.getByText("Analysis Summary")).toBeVisible();
  await expect(page.getByText("Total Spend")).toBeVisible();
  await expect(page.getByRole("link", { name: /download summary csv/i })).toBeVisible();
  await expect(
    page.getByText("AMAZON MARKETPLACE AU SYDNEY").filter({ visible: true }).first(),
  ).toBeVisible();

  const transactionList = page.locator('[class*="transactionList"]').first();
  await expect(transactionList).toBeVisible();
  await expect
    .poll(async () =>
      transactionList.evaluate(
        (element) =>
          getComputedStyle(element).overflowY === "auto" &&
          element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);

  const stickyAction = page.locator('[class*="stickyAction"]').first();
  await expect(stickyAction).toBeVisible();
  await expect(stickyAction).toHaveCSS("position", "sticky");
});
