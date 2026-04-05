import { expect, test } from "@playwright/test";
import path from "node:path";

test("loads the upload shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /credit card statements, without the streamlit runtime\./i,
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
});

test("extracts text from the fixture pdf", async ({ page }) => {
  await page.goto("/");

  const fixturePath = path.resolve(
    process.cwd(),
    "../statements/Statement_CRD9c58559b0ebf4c5a8d313f114865af1dd5032a0356e926bd83.pdf",
  );

  await page.getByLabel("Choose a PDF statement").setInputFiles(fixturePath);

  await expect(page.getByRole("link", { name: /download combined csv/i })).toBeVisible();
  await expect(page.getByText("13 April 2026")).toBeVisible();
  await expect(page.getByText("$3,053.10").first()).toBeVisible();
  await expect(page.getByText("7248, 8489")).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("7248");
  await page.getByRole("combobox").selectOption("8489");
  await expect(page.getByRole("combobox")).toHaveValue("8489");
  await expect(page.getByText("OPENAI *CHATGPT SUBSCR OPENAI.COM CA")).toBeVisible();
});
