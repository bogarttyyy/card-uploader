import { expect, test } from "@playwright/test";
import path from "node:path";

test("loads the upload shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /credit card bill manager/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Choose a PDF statement")).toBeVisible();
});

test("shows an error for a non-pdf upload", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Choose a PDF statement").setInputFiles({
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
    "statements/Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf",
  );

  await page.getByLabel("Choose a PDF statement").setInputFiles(fixturePath);

  await expect(page.getByRole("link", { name: /download combined csv/i })).toBeVisible();
  await expect(page.getByText("Exportable rows")).toBeVisible();
  await expect(page.getByText("16 March 2026")).toBeVisible();
  await expect(page.getByText("$3,575.18").first()).toBeVisible();
  await expect(page.getByText("7248, 8489")).toBeVisible();
  await expect(page.getByText(/raw page text debug snapshot/i)).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveValue("7248");
  await expect(page.getByRole("link", { name: /^download csv$/i })).toHaveAttribute(
    "download",
    "credit_card_7248_transactions.csv",
  );
  await page.getByRole("combobox").selectOption("8489");
  await expect(page.getByRole("combobox")).toHaveValue("8489");
  await expect(page.getByRole("link", { name: /^download csv$/i })).toHaveAttribute(
    "download",
    "credit_card_8489_transactions.csv",
  );
  await expect(page.getByText("OPENAI *CHATGPT SUBSCR OPENAI.COM CA")).toBeVisible();
});
