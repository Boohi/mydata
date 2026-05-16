import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Settings } from "../screens/Settings";

describe("Settings screen", () => {
  it("toggling Dark pill flips document data-theme", () => {
    render(<Settings />);
    try {
      fireEvent.click(screen.getByText("Dark"));
      expect(document.documentElement.dataset.theme).toBe("dark");
    } finally {
      // Reset to light so other tests aren't poisoned.
      fireEvent.click(screen.getByText("Light"));
      // Defensive: also reset in case the click failed.
      document.documentElement.dataset.theme = "light";
      try {
        localStorage.setItem("mydata.theme", "light");
      } catch {
        /* ignore */
      }
    }
  });
});
