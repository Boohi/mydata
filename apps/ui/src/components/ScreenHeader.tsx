import React from "react";

export interface ScreenHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  kicker?: string;
}

export function ScreenHeader({ title, subtitle, right, kicker }: ScreenHeaderProps) {
  return (
    <div
      style={{
        padding: "20px 28px 14px",
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
        borderBottom: "0.5px solid var(--hairline)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && (
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--ink-4)",
              letterSpacing: 0.06,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {kicker}
          </div>
        )}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: -0.6,
            margin: 0,
            color: "var(--ink)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-3)",
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{right}</div>}
    </div>
  );
}
