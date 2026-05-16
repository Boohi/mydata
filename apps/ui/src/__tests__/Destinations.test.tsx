import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Destinations } from "../screens/Destinations";

describe("Destinations screen", () => {
  it("groups by country by default and switches to category groups", () => {
    render(<Destinations />);

    // Country pill is visible
    expect(screen.getByText("Country")).toBeInTheDocument();

    const before = screen.getAllByText("Cloud / CDN").length;

    fireEvent.click(screen.getByText("Category"));

    // Switching to category grouping adds the group header occurrence.
    const after = screen.getAllByText("Cloud / CDN").length;
    expect(after).toBeGreaterThan(before);
  });
});
