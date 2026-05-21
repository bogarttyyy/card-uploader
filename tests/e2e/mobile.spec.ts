import { expect, test } from "@playwright/test";
import path from "node:path";

test("shows stacked results and sticky CSV action on mobile browsers", async ({ page }) => {
  await page.goto("/");

  const fixturePath = path.resolve(
    process.cwd(),
    "statements/Statement_CRDd8abc3f468af07377c2867bd15418f734afeca244f8b9e685d.pdf",
  );

  await page.getByLabel(/select pdf file/i).setInputFiles(fixturePath);

  await expect(page.getByText("Analysis Summary")).toBeVisible();
  await expect(page.getByText("Total Spend")).toBeVisible();
  await expect(page.getByRole("link", { name: /download summary csv/i })).toBeVisible();
  await expect(
    page.getByText("KFC Mean Fiddler Mean Fiddler").filter({ visible: true }).first(),
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
