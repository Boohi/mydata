// Rules screen — port of MDScreenRules from screens-meta.jsx.
import { ScreenHeader } from "../components/ScreenHeader";
import { AppDot, Badge, Card, IconBtn } from "../components/primitives";
import { Icon, type IconName } from "../components/Icon";
import { appById, countries, destById, rules } from "../data/mock";
import type { RuleAction, Tint } from "../data/types";

interface Preset {
  label: string;
  count: number | string;
  tint: Tint;
  icon: IconName;
}

const PRESETS: readonly Preset[] = [
  { label: "Block all ad networks", count: 9, tint: "danger", icon: "shield" },
  { label: "Block China-bound traffic", count: 4, tint: "danger", icon: "block" },
  { label: "Block analytics", count: 12, tint: "warn", icon: "warn" },
  { label: "Allow Apple system", count: 1, tint: "ok", icon: "allow" },
  { label: "Warn on first-seen host", count: "*", tint: "accent", icon: "bolt" },
  { label: "Background only", count: 14, tint: "neutral", icon: "pause" },
];

interface CommunitySuggestion {
  label: string;
  votes: string;
  risk: "high" | "med" | "low";
}

const COMMUNITY: readonly CommunitySuggestion[] = [
  { label: "Block all TikTok ad SDK endpoints", votes: "4.2k 👍", risk: "high" },
  { label: "Allow Google Search but block Analytics", votes: "3.8k 👍", risk: "low" },
  { label: "Quarantine all .ru / .cn TLDs at night", votes: "1.9k 👍", risk: "med" },
];

const ACTION_TINT: Record<RuleAction, Tint> = {
  block: "danger",
  allow: "ok",
  warn: "warn",
};

export function Rules() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenHeader
        kicker={`${rules.length} active rules · 6 by you, 2 community`}
        title="Rules"
        subtitle="Block, allow, or get notified for any app-to-destination connection. Rules apply system-wide."
        right={
          <>
            <button
              className="md-btn"
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                fontSize: 11.5,
                fontWeight: 600,
                background: "var(--ink)",
                color: "var(--canvas)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="plus" size={11} stroke={1.8} /> New rule
            </button>
            <div style={{ width: 8 }} />
            <IconBtn name="download" title="Export rules" />
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
        {/* Quick presets */}
        <Card eyebrow="One-tap presets" title="Block whole categories at once">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="md-btn"
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "0.5px solid var(--hairline)",
                  background: "var(--panel-2)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  textAlign: "left",
                }}
              >
                <span
                  className={`md-tint-${p.tint}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={p.icon} size={13} stroke={1.8} />
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}
                  >
                    {p.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
                    Affects {p.count} hosts
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card
          eyebrow="Your rules"
          title="Active filters"
          padded={false}
          right={<IconBtn name="filter" />}
        >
          {/* Column header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1.4fr 1.4fr 0.9fr 0.9fr 0.7fr 80px",
              gap: 14,
              padding: "8px 14px",
              fontSize: 9.5,
              fontWeight: 700,
              color: "var(--ink-4)",
              letterSpacing: 0.08,
              textTransform: "uppercase",
              borderBottom: "0.5px solid var(--hairline)",
            }}
          >
            <div />
            <div>App</div>
            <div>Destination</div>
            <div>Action</div>
            <div>Scope</div>
            <div>By</div>
            <div />
          </div>
          {rules.map((r, i) => {
            const a = r.app === "*" ? null : appById[r.app];
            const d = destById[r.dest];
            const actionTint = ACTION_TINT[r.action];
            return (
              <div
                key={i}
                className="md-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1.4fr 1.4fr 0.9fr 0.9fr 0.7fr 80px",
                  gap: 14,
                  padding: "10px 14px",
                  borderTop: "0.5px solid var(--hairline)",
                  alignItems: "center",
                }}
              >
                {r.app === "*" ? (
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: "var(--panel-3)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ink-3)",
                    }}
                  >
                    ∗
                  </span>
                ) : (
                  <AppDot app={r.app} size={20} />
                )}
                <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
                  {r.app === "*" ? "Any app" : (a?.name ?? r.app)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {d && <span style={{ fontSize: 13 }}>{countries[d.country].flag}</span>}
                  <span>{d?.name ?? r.dest}</span>
                </div>
                <div>
                  <Badge tint={actionTint}>{r.action}</Badge>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.scope}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {r.who === "community" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Icon name="user" size={10} stroke={1.8} /> community
                    </span>
                  ) : (
                    "you"
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <IconBtn name="settings" title="Edit" />
                  <IconBtn name="close" title="Delete" />
                </div>
              </div>
            );
          })}
        </Card>

        <Card
          eyebrow="From the community"
          title="Suggested rules people like you turned on"
          right={
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "var(--ink-4)",
              }}
            >
              <span className="md-live-dot" /> 14,212 users contributing
            </span>
          }
        >
          {COMMUNITY.map((s, i) => (
            <div
              key={s.label}
              className="md-row"
              style={{
                padding: "10px 0",
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderTop: i === 0 ? 0 : "0.5px solid var(--hairline)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 2 }}>
                  {s.votes} · maintained by @yarne
                </div>
              </div>
              <button
                className="md-btn"
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: "var(--panel-3)",
                  color: "var(--ink-2)",
                }}
              >
                Add
              </button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
