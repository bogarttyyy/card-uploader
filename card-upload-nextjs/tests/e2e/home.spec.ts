import { expect, test } from "@playwright/test";

test("loads the upload shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /credit card statements, without the streamlit runtime\./i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Choose a PDF statement")).toBeVisible();
});
