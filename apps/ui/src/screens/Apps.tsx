import { useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppDot, Badge, IconBtn, Pill, Sparkline } from "../components/primitives";
import { Icon } from "../components/Icon";
import { apps, countries, destById } from "../data/mock";
import type { AppMeta, Tint } from "../data/types";

type Risk = "high" | "med" | "low";
type SortKey = "mb" | "dests" | "name";

interface AppRowProps {
  app: AppMeta;
  expanded: boolean;
  onToggle: () => void;
}

function AppRow({ app, expanded, onToggle }: AppRowProps) {
  const max = Math.max(...apps.map((a) => a.mb));
  const topDestKey = app.breakdown.find(([k]) => k !== "other")?.[0];
  const topDest = topDestKey ? destById[topDestKey] : undefined;
  const risk: Risk = app.mb > 400 ? "high" : app.mb > 150 ? "med" : "low";
  const riskTint: Record<Risk, Tint> = {
    high: "danger",
    med: "warn",
    low: "ok",
  };
  return (
    <div className="md-row" style={{ borderTop: "0.5px solid var(--hairline)" }}>
      <div
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1.4fr 1.3fr 1fr 80px 80px 24px",
          alignItems: "center",
          gap: 14,
          padding: "10px 18px",
          cursor: "pointer",
        }}
      >
        <AppDot app={app.id} size={24} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{app.name}</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{app.publisher}</div>
        </div>
        <div>
          <div className="md-tnum" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
            {(app.mb / 1024).toFixed(2)}{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-4)" }}>GB</span>
          </div>
          <div
            style={{
              marginTop: 4,
              height: 4,
              background: "var(--panel-3)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(4, (app.mb / max) * 100)}%`,
                height: "100%",
                background: app.color,
                opacity: 0.85,
                borderRadius: 2,
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
          <div>{app.dests} destinations</div>
          <div style={{ color: "var(--ink-4)", marginTop: 2 }}>
            {topDest ? (
              <>
                top: <span style={{ color: "var(--ink-3)" }}>{topDest.name}</span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div style={{ color: app.color }}>
          <Sparkline data={app.spark} w={70} h={24} color="currentColor" fill />
        </div>
        <Badge tint={riskTint[risk]}>{risk}</Badge>
        <span
          style={{
            color: "var(--ink-4)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform .15s",
            display: "inline-flex",
          }}
        >
          <Icon name="chev" size={14} />
        </span>
      </div>
      {expanded && (
        <div
          style={{
            padding: "4px 18px 16px 70px",
            background: "var(--panel-2)",
            borderTop: "0.5px solid var(--hairline)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 24,
              paddingTop: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--ink-4)",
                  letterSpacing: 0.06,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Where {app.name}'s data goes
              </div>
              <div
                style={{
                  display: "flex",
                  height: 10,
                  borderRadius: 5,
                  overflow: "hidden",
                  border: "0.5px solid var(--hairline)",
                }}
              >
                {app.breakdown.map(([k, pct], i) => {
                  const d = destById[k];
                  const c = d ? countries[d.country]?.color : "var(--c-other)";
                  return (
                    <div
                      key={i}
                      style={{ width: `${pct}%`, background: c }}
                      title={`${d?.name || k}: ${pct}%`}
                    />
                  );
                })}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {app.breakdown.map(([k, pct]) => {
                  const d = destById[k];
                  const c = d ? countries[d.country] : null;
                  return (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: c?.color || "var(--c-other)",
                        }}
                      />
                      <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{d?.name || k}</span>
                      <span className="md-tnum" style={{ color: "var(--ink-4)" }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--ink-4)",
                  letterSpacing: 0.06,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Quick actions
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  className="md-btn"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 500,
                    background: "var(--panel)",
                    color: "var(--ink-2)",
                    border: "0.5px solid var(--hairline-2)",
                  }}
                >
                  Block analytics destinations
                </button>
                <button
                  className="md-btn"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 500,
                    background: "var(--panel)",
                    color: "var(--ink-2)",
                    border: "0.5px solid var(--hairline-2)",
                  }}
                >
                  Allow only when foregrounded
                </button>
                <button
                  className="md-btn"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 500,
                    background: "var(--danger-soft)",
                    color: "var(--danger)",
                    border: "0.5px solid color-mix(in oklab, var(--danger) 25%, transparent)",
                  }}
                >
                  Block all non-US traffic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Apps() {
  const [expanded, setExpanded] = useState<string | null>("tiktok");
  const [sort, setSort] = useState<SortKey>("mb");
  const sorted = [...apps].sort((a, b) => {
    if (sort === "mb") return b.mb - a.mb;
    if (sort === "dests") return b.dests - a.dests;
    return a.name.localeCompare(b.name);
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenHeader
        kicker={`${apps.length} apps · last 24h`}
        title="Apps"
        subtitle="Every app on your machine that sent data today, sorted by volume."
        right={
          <>
            <div style={{ display: "flex", gap: 4 }}>
              <Pill active={sort === "mb"} onClick={() => setSort("mb")}>
                By volume
              </Pill>
              <Pill active={sort === "dests"} onClick={() => setSort("dests")}>
                By destinations
              </Pill>
              <Pill active={sort === "name"} onClick={() => setSort("name")}>
                A–Z
              </Pill>
            </div>
            <div style={{ width: 8 }} />
            <IconBtn name="search" />
            <IconBtn name="filter" />
          </>
        }
      />
      <div className="md-scroll" style={{ flex: 1, overflow: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "28px 1.4fr 1.3fr 1fr 80px 80px 24px",
            gap: 14,
            padding: "10px 18px",
            fontSize: 9.5,
            fontWeight: 700,
            color: "var(--ink-4)",
            letterSpacing: 0.08,
            textTransform: "uppercase",
            position: "sticky",
            top: 0,
            background: "var(--canvas)",
            zIndex: 1,
            borderBottom: "0.5px solid var(--hairline)",
          }}
        >
          <div />
          <div>App</div>
          <div>Sent today</div>
          <div>Destinations</div>
          <div>24h trend</div>
          <div>Risk</div>
          <div />
        </div>
        {sorted.map((app) => (
          <AppRow
            key={app.id}
            app={app}
            expanded={expanded === app.id}
            onToggle={() => setExpanded(expanded === app.id ? null : app.id)}
          />
        ))}
      </div>
    </div>
  );
}
