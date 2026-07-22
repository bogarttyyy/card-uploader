import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders Macquarie-specific upload and privacy copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /pampi card/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/choose a pdf statement/i),
    ).toHaveAttribute("accept", ".pdf");
    expect(
      screen.getByText(/convert macquarie credit card statements to csv—privately/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /upload a macquarie card statement/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose PDF")).toBeInTheDocument();
    expect(screen.getByText("PDF only · Up to 10 MiB")).toBeInTheDocument();
    expect(
      screen.getByText(/statement contents remain on this device/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no statement loaded yet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
