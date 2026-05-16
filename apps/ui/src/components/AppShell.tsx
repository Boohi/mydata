import React, { useState } from "react";
import { Sidebar } from "./Sidebar";

export type ScreenId = "today" | "map" | "apps" | "destinations" | "rules" | "reports" | "settings";

export interface AppShellProps {
  startScreen?: ScreenId;
  renderScreen: (screen: ScreenId) => React.ReactNode;
}

export function AppShell({ startScreen = "today", renderScreen }: AppShellProps) {
  const [screen, setScreen] = useState<ScreenId>(startScreen);
  const [paused, setPaused] = useState(false);

  return (
    <div
      className="md-root"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--canvas)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          active={screen}
          onNav={setScreen}
          paused={paused}
          onPauseToggle={() => setPaused((p) => !p)}
        />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {renderScreen(screen)}
        </main>
      </div>
    </div>
  );
}
