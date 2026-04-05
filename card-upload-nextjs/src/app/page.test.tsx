import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders the initial upload shell and empty state copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /credit card statements, without the streamlit runtime\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/choose a pdf statement/i),
    ).toHaveAttribute("accept", ".pdf");
    expect(
      screen.getByText(/waiting for parsed statement data/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
