import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Today } from "../screens/Today";

describe("Today screen", () => {
  it("renders the data-out KPI with the static prototype value", () => {
    render(<Today />);
    expect(screen.getByText("Data out today")).toBeInTheDocument();
    expect(screen.getByText("1.42")).toBeInTheDocument();
  });
});
