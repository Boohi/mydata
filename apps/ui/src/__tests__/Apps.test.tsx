import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Apps } from "../screens/Apps";

describe("Apps screen", () => {
  it("renders app rows and toggles the breakdown panel for Google Chrome", () => {
    render(<Apps />);
    const chromeLabel = screen.getByText("Google Chrome");
    expect(chromeLabel).toBeInTheDocument();

    // Chrome panel is not expanded by default — only tiktok is.
    expect(screen.queryByText("Where Google Chrome's data goes")).not.toBeInTheDocument();

    // Click chrome row (event bubbles to row-level onClick).
    fireEvent.click(chromeLabel);
    expect(screen.getByText("Where Google Chrome's data goes")).toBeInTheDocument();

    // Click again to collapse.
    fireEvent.click(screen.getByText("Google Chrome"));
    expect(screen.queryByText("Where Google Chrome's data goes")).not.toBeInTheDocument();
  });
});
