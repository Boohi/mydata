import { Icon, type IconName } from "./Icon";
import { apps, destinations, rules } from "../data/mock";
import type { ScreenId } from "./AppShell";

interface NavItem {
  id: ScreenId;
  label: string;
  icon: IconName;
  section: "main" | "system";
  badge?: "live";
  count?: number;
}

const NAV: readonly NavItem[] = [
  { id: "today", label: "Today", icon: "today", section: "main", badge: "live" },
  { id: "map", label: "World map", icon: "globe", section: "main" },
  { id: "apps", label: "Apps", icon: "apps", section: "main", count: apps.length },
  {
    id: "destinations",
    label: "Destinations",
    icon: "flow",
    section: "main",
    count: destinations.length,
  },
  { id: "rules", label: "Rules", icon: "rules", section: "main", count: rules.length },
  { id: "reports", label: "Reports", icon: "reports", section: "main" },
  { id: "settings", label: "Settings", icon: "settings", section: "system" },
];

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}

function SidebarItem({ item, active, onClick }: SidebarItemProps) {
  return (
    <button
      className="md-btn"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "6px 10px",
        borderRadius: 7,
        fontSize: 12.5,
        fontWeight: 500,
        color: active ? "var(--ink)" : "var(--ink-3)",
        background: active ? "var(--panel)" : "transparent",
        boxShadow: active ? "0 1px 2px rgba(15,23,42,.06), 0 0 0 0.5px var(--hairline)" : "none",
        transition: "background .1s, color .1s",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          color: active ? "var(--accent)" : "var(--ink-4)",
          display: "inline-flex",
        }}
      >
        <Icon name={item.icon} size={14} stroke={1.7} />
      </span>
      <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
      {item.badge === "live" && <span className="md-live-dot" />}
      {item.count != null && (
        <span
          style={{
            fontSize: 10.5,
            color: "var(--ink-4)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {item.count}
        </span>
      )}
    </button>
  );
}

interface ProBlurbProps {
  onUpgrade?: () => void;
}

function ProBlurb({ onUpgrade }: ProBlurbProps) {
  return (
    <button
      className="md-btn"
      onClick={onUpgrade}
      style={{
        display: "block",
        textAlign: "left",
        margin: 10,
        padding: "11px 12px 10px",
        borderRadius: 10,
        width: "calc(100% - 20px)",
        background: "var(--ink)",
        color: "var(--canvas)",
        transition: "transform .1s",
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.985)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <Icon name="pro" size={12} stroke={1.8} /> Get Pro
      </div>
      <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, lineHeight: 1.35 }}>
        Unlimited history, custom rules, weekly digest.
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.5 }}>$4.99</span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>/ month</span>
      </div>
    </button>
  );
}

export interface SidebarProps {
  active: ScreenId;
  onNav: (id: ScreenId) => void;
  paused: boolean;
  onPauseToggle: () => void;
  onUpgrade?: () => void;
}

const noop = () => {};

export function Sidebar({ active, onNav, paused, onPauseToggle, onUpgrade = noop }: SidebarProps) {
  const main = NAV.filter((n) => n.section === "main");
  const sys = NAV.filter((n) => n.section === "system");
  return (
    <aside
      style={{
        width: 218,
        background: "var(--panel-2)",
        borderRight: "0.5px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* logo / wordmark */}
      <div
        style={{
          padding: "10px 14px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "linear-gradient(155deg, var(--ink) 0%, var(--accent) 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            position: "relative",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
            <path d="M14 8h-3.5M5.5 8H2M8 14v-3.5M8 5.5V2" />
          </svg>
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.3 }}>myData</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.04,
            color: "var(--ink-4)",
          }}
        >
          v0.8.2
        </span>
      </div>

      {/* status pill */}
      <div style={{ padding: "0 10px 8px" }}>
        <button
          className="md-btn"
          onClick={onPauseToggle}
          style={{
            width: "100%",
            padding: "7px 9px",
            borderRadius: 8,
            background: paused ? "var(--warn-soft)" : "var(--ok-soft)",
            color: paused ? "var(--warn)" : "var(--ok)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <Icon name={paused ? "play" : "pause"} size={11} />
          {paused ? "Resume monitoring" : "Monitoring 14 apps"}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              opacity: 0.7,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {paused ? "paused" : "live"}
          </span>
        </button>
      </div>

      <div
        style={{
          padding: "4px 10px 4px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {main.map((it) => (
          <SidebarItem
            key={it.id}
            item={it}
            active={active === it.id}
            onClick={() => onNav(it.id)}
          />
        ))}
        <div
          style={{
            height: 1,
            background: "var(--hairline)",
            margin: "10px 8px 8px",
          }}
        />
        {sys.map((it) => (
          <SidebarItem
            key={it.id}
            item={it}
            active={active === it.id}
            onClick={() => onNav(it.id)}
          />
        ))}
      </div>

      <ProBlurb onUpgrade={onUpgrade} />
    </aside>
  );
}
