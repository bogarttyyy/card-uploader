import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    document.documentElement.classList.remove("dark");
  });

  it("turns dark mode on and persists the preference", async () => {
    render(<ThemeToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("card-uploader-theme")).toBe("dark");
  });

  it("turns dark mode off and persists the preference", async () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("card-uploader-theme")).toBe("light");
  });
});
