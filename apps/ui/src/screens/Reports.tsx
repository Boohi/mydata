// Reports screen — port of MDDonut + MDScreenReports from screens-meta.jsx.
// The `proActive` / `onUpgrade` props are dropped; we always render the Pro
// upsell card (the non-Pro slice of v0.1).
import { ScreenHeader } from "../components/ScreenHeader";
import { AppDot, Card, IconBtn, KPI, Pill } from "../components/primitives";
import { Icon } from "../components/Icon";
import { apps, appById, destById, weekly } from "../data/mock";

interface DonutProps {
  data: ReadonlyArray<readonly [string, number]>;
  size?: number;
}

function Donut({ data, size = 160 }: DonutProps) {
  const total = data.reduce((s, [, v]) => s + v, 0);
  let acc = 0;
  const radius = size / 2 - 14;
  const cx = size / 2,
    cy = size / 2;
  const stroke = 22;
  const palette = [
    "var(--c-us)",
    "var(--c-cn)",
    "var(--c-de)",
    "var(--c-ie)",
    "var(--c-nl)",
    "var(--c-sg)",
    "var(--c-other)",
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--panel-3)"
          strokeWidth={stroke}
        />
        {data.map(([label, v], i) => {
          const frac = v / total;
          const len = 2 * Math.PI * radius * frac;
          const offset = 2 * Math.PI * radius * acc;
          const dashArray = `${len} ${2 * Math.PI * radius - len}`;
          acc += frac;
          return (
            <circle
              key={label}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth={stroke}
              strokeDasharray={dashArray}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize="22"
          fontWeight="600"
          fill="var(--ink)"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          style={{ letterSpacing: -0.5 }}
        >
          {weekly.totalGB}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="10"
          fontWeight="500"
          fill="var(--ink-3)"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          GB this week
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
        {data.map(([label, v], i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: palette[i % palette.length],
              }}
            />
            <span style={{ fontSize: 11.5, color: "var(--ink-2)", flex: 1 }}>{label}</span>
            <span
              className="md-tnum"
              style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}
            >
              {v}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Reports() {
  const topDest = destById[weekly.topDest];
  const bigMoverApp = appById[weekly.bigMover.app];
  const sortedApps = [...apps].sort((a, b) => b.mb - a.mb).slice(0, 6);
  const max = apps[0].mb;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenHeader
        kicker="Week of May 10 – May 16"
        title="Weekly report"
        subtitle="A digest of what your machine sent, where it went, and what changed."
        right={
          <>
            <Pill active>This week</Pill>
            <Pill>Last week</Pill>
            <Pill>Month</Pill>
            <div style={{ width: 8 }} />
            <IconBtn name="download" />
          </>
        }
      />

      <div
        className="md-scroll"
        style={{
          flex: 1,
          overflow: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Hero stats */}
        <div style={{ display: "flex", gap: 12 }}>
          <KPI
            label="Total data out"
            value={weekly.totalGB}
            unit="GB"
            delta="+12% vs last week"
            tone="up"
            sub="≈ 4 movies' worth"
          />
          <KPI
            label="Top destination"
            value={topDest?.name ?? weekly.topDest}
            sub={`${weekly.topDestGB} GB · 29% of total`}
          />
          <KPI
            label="Blocked"
            value={weekly.blocks}
            unit="attempts"
            delta={`${weekly.trackersBlocked} trackers`}
            tone="down"
          />
          <KPI
            label="Big mover"
            value={weekly.bigMover.delta}
            sub={`${bigMoverApp?.name ?? weekly.bigMover.app} traffic`}
            tone="up"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 12 }}>
          <Card eyebrow="Geography" title="Where your data went">
            <Donut data={weekly.worldShare} />
          </Card>

          <Card eyebrow="Notable" title="Stories from this week">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <span
                  className="md-tint-danger"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="warn" size={14} stroke={1.8} />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                    TikTok started talking to a new endpoint
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-3)",
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    <span className="md-mono">ads.bytedance.cn</span> received 312% more data after
                    Tuesday's app update.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span
                  className="md-tint-warn"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="flow" size={14} stroke={1.8} />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                    Slack sent product analytics 6,201 times
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-3)",
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    Anonymized event data to Segment, even with "Privacy" mode on.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span
                  className="md-tint-ok"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="shield" size={14} stroke={1.8} />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                    Your rules blocked 142 connection attempts
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-3)",
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    Saved roughly 6.2 MB of profiling data. Most came from Chrome.
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card eyebrow="Top apps" title="By data sent this week" padded={false}>
          {sortedApps.map((a, i) => (
            <div
              key={a.id}
              className="md-row"
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 1.4fr 60px",
                alignItems: "center",
                gap: 14,
                padding: "10px 14px",
                borderTop: i === 0 ? 0 : "0.5px solid var(--hairline)",
              }}
            >
              <AppDot app={a.id} size={22} />
              <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{a.name}</div>
              <div>
                <div
                  style={{
                    height: 5,
                    background: "var(--panel-3)",
                    borderRadius: 2.5,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(a.mb / max) * 100}%`,
                      height: "100%",
                      background: a.color,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
              <div
                className="md-tnum md-mono"
                style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--ink)" }}
              >
                {((a.mb * 7) / 1024).toFixed(2)}{" "}
                <span style={{ fontWeight: 400, color: "var(--ink-4)" }}>GB</span>
              </div>
            </div>
          ))}
        </Card>

        {/* Pro upsell — always rendered in this slice (proActive prop dropped). */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--accent-soft), var(--accent-tint))",
            padding: "16px 18px",
            borderRadius: 12,
            border: "0.5px solid color-mix(in oklab, var(--accent) 22%, transparent)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "var(--accent)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="pro" size={16} stroke={1.8} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
              Get the full 90-day report
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
              Pro gives you unlimited history, custom digests, and exportable CSV/JSON reports.
            </div>
          </div>
          <button
            className="md-btn"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            Try Pro free for 7 days
          </button>
        </div>
      </div>
    </div>
  );
}
