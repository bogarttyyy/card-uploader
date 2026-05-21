import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders the initial upload shell and empty state copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /upload your credit card statement/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/select pdf file/i),
    ).toHaveAttribute("accept", ".pdf");
    expect(
      screen.getByText(/analysis summary/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
