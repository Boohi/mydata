import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldMapScreen } from "../screens/Map";
import { destinations } from "../data/mock";

describe("WorldMapScreen", () => {
  it("renders at most one flow path per destination", () => {
    const { container } = render(<WorldMapScreen />);
    const flows = container.querySelectorAll("path.md-flow");
    expect(flows.length).toBeLessThanOrEqual(destinations.length);
    // Default filter is 'all'; every destination in the mock has coordinates,
    // so we should see exactly that many arcs.
    expect(flows.length).toBe(destinations.length);
  });
});
