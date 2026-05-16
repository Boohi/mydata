import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, Card, IconBtn, KPI, Pill, AppDot } from "../components/primitives";
import { Icon } from "../components/Icon";
import {
  apps,
  appById,
  categories,
  countries,
  destinations,
  destById,
  feed,
  hourly,
  weekly,
} from "../data/mock";
import type { CountryCode, FeedLevel, Tint } from "../data/types";

interface HourlyChartProps {
  data: readonly number[];
  height?: number;
}

function HourlyChart({ data, height = 130 }: HourlyChartProps) {
  const max = Math.max(...data, 1);
  const currentHour = 14;
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          height,
          padding: "0 2px",
        }}
      >
        {data.map((v, i) => {
          const h = (v / max) * (height - 18);
          const isNow = i === currentHour;
          const isFuture = i > currentHour;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                className="md-tnum"
                style={{
                  fontSize: 9.5,
                  color: isNow ? "var(--accent)" : "transparent",
                  fontWeight: 600,
                }}
              >
                {isNow ? `${v}M` : "·"}
              </div>
              <div
                style={{
                  width: "100%",
                  height: h,
                  background: isFuture
                    ? "repeating-linear-gradient(135deg, var(--panel-3) 0 3px, transparent 3px 6px)"
                    : isNow
                      ? "var(--accent)"
                      : "var(--ink-5)",
                  borderRadius: 3,
                  opacity: isFuture ? 0.4 : 1,
                  transition: "background .15s",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: 6, padding: "0 2px" }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="md-tnum"
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 9.5,
              color: i % 4 === 0 ? "var(--ink-4)" : "transparent",
            }}
          >
            {String(i).padStart(2, "0")}
          </div>
        ))}
      </div>
    </div>
  );
}

function countryFlagInline(cc: CountryCode): string {
  const c = countries[cc];
  return c?.flag || "🏳️";
}

function LiveFeed() {
  const tintForLevel: Record<FeedLevel, Tint> = {
    info: "neutral",
    warn: "warn",
    danger: "danger",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {feed.map((e, i) => {
        const a = appById[e.app];
        const d = destById[e.dest];
        return (
          <div
            key={i}
            className="md-row"
            style={{
              display: "grid",
              gridTemplateColumns: "54px 24px 1fr 60px",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderTop: i === 0 ? 0 : "0.5px solid var(--hairline)",
            }}
          >
            <div className="md-mono md-tnum" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              {e.t}
            </div>
            <AppDot app={e.app} size={20} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 500 }}>{a?.name || e.app}</span>
                <span style={{ color: "var(--ink-5)" }}>→</span>
                <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{d?.name || e.dest}</span>
                {d && <span style={{ fontSize: 11 }}>{countryFlagInline(d.country)}</span>}
                {e.level !== "info" && (
                  <Badge tint={tintForLevel[e.level]}>
                    {e.level === "danger" ? "unknown" : "tracker"}
                  </Badge>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-4)",
                  marginTop: 2,
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.note}
              </div>
            </div>
            <div
              className="md-mono md-tnum"
              style={{
                fontSize: 11.5,
                color: "var(--ink)",
                textAlign: "right",
                fontWeight: 500,
              }}
            >
              {e.mb.toFixed(2)} <span style={{ color: "var(--ink-4)" }}>MB</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopDestList() {
  const top = [...destinations].sort((a, b) => b.mb - a.mb).slice(0, 7);
  const max = top[0].mb;
  return (
    <div>
      {top.map((d, i) => {
        const cat = categories[d.category];
        const c = countries[d.country];
        return (
          <div
            key={d.id}
            className="md-row"
            style={{
              padding: "8px 14px",
              borderTop: i === 0 ? 0 : "0.5px solid var(--hairline)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>{c.flag}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.name}
                </span>
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
                    width: `${(d.mb / max) * 100}%`,
                    height: "100%",
                    background: c.color,
                    borderRadius: 2,
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--ink-4)" }}>
                {cat.label} · {d.conns.toLocaleString()} connections
              </div>
            </div>
            <div
              className="md-mono md-tnum"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              {d.mb.toFixed(1)} <span style={{ fontWeight: 400, color: "var(--ink-4)" }}>MB</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeadsUp() {
  return (
    <div
      style={{
        background: "var(--accent-soft)",
        color: "var(--accent)",
        padding: "12px 14px",
        borderRadius: 10,
        border: "0.5px solid color-mix(in oklab, var(--accent) 25%, transparent)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ marginTop: 1 }}>
        <Icon name="bolt" size={16} stroke={1.7} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
          One new endpoint to review
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
          TikTok talked to <span className="md-mono">ads.bytedance.cn</span> for the first time
          today. Open it in Apps to set a rule.
        </div>
      </div>
      <button
        className="md-btn"
        style={{
          padding: "6px 12px",
          borderRadius: 7,
          fontSize: 11.5,
          fontWeight: 600,
          background: "var(--accent)",
          color: "#fff",
        }}
      >
        Review
      </button>
    </div>
  );
}

export function Today() {
  const activeApps = apps.length;
  const dests = destinations.length;
  const trackers = weekly.trackersBlocked + 23;
  const dateLabel = "Saturday · May 16";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <ScreenHeader
        kicker={dateLabel}
        title="Today"
        subtitle={
          <span>
            Your machine sent{" "}
            <strong className="md-tnum" style={{ color: "var(--ink)" }}>
              1.42 GB
            </strong>{" "}
            to {dests} destinations across {activeApps} apps.
          </span>
        }
        right={
          <>
            <Pill active>Today</Pill>
            <Pill>7d</Pill>
            <Pill>30d</Pill>
            <div style={{ width: 12 }} />
            <IconBtn name="filter" title="Filter" />
            <IconBtn name="download" title="Export" />
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
        <div style={{ display: "flex", gap: 12 }}>
          <KPI
            label="Data out today"
            value="1.42"
            unit="GB"
            delta="+18% vs yesterday"
            tone="up"
            sub="peak 142 MB at 18:00"
          />
          <KPI label="Apps active" value={activeApps} sub="2 new this week" />
          <KPI label="Destinations" value={dests} unit="hosts" sub="3 first-time today" />
          <KPI
            label="Trackers blocked"
            value={trackers}
            delta="auto"
            tone="down"
            sub="by your rules"
          />
        </div>

        <Card
          eyebrow="Last 24 hours"
          title="Bytes sent per hour"
          right={
            <div style={{ display: "flex", gap: 4 }}>
              <Pill active>Out</Pill>
              <Pill>In</Pill>
              <Pill>Both</Pill>
            </div>
          }
        >
          <HourlyChart data={hourly} />
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 12,
            minHeight: 0,
          }}
        >
          <Card
            eyebrow="Live activity"
            title="What's happening right now"
            padded={false}
            right={
              <>
                <span className="md-live-dot" />
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-4)",
                    fontWeight: 600,
                  }}
                >
                  LIVE
                </span>
              </>
            }
          >
            <LiveFeed />
          </Card>
          <Card
            eyebrow="Top destinations"
            title="By bytes sent today"
            padded={false}
            right={<IconBtn name="chev" title="See all" />}
          >
            <TopDestList />
          </Card>
        </div>

        <HeadsUp />
      </div>
    </div>
  );
}
