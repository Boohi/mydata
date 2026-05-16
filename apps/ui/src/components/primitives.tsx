import React from "react";
import { Icon, type IconName } from "./Icon";
import { appById, countries } from "../data/mock";
import type { CountryCode, Tint } from "../data/types";

// ── Badge ───────────────────────────────────────────────────────────
export interface BadgeProps {
  tint?: Tint;
  children: React.ReactNode;
  mono?: boolean;
  size?: "sm" | "md";
}

export function Badge({ tint = "neutral", children, mono = false, size = "sm" }: BadgeProps) {
  return (
    <span
      className={`md-tint-${tint} ${mono ? "md-mono md-tnum" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: size === "sm" ? 10.5 : 11.5,
        lineHeight: 1,
        padding: size === "sm" ? "3px 6px" : "4px 8px",
        borderRadius: 5,
        fontWeight: 600,
        letterSpacing: 0.01,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ── Pill ────────────────────────────────────────────────────────────
export interface PillProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function Pill({ children, active, onClick }: PillProps) {
  return (
    <button
      className="md-btn"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--canvas)" : "var(--ink-3)",
        border: active ? "0" : "1px solid var(--hairline)",
        transition: "all .12s",
      }}
    >
      {children}
    </button>
  );
}

// ── IconBtn ─────────────────────────────────────────────────────────
export interface IconBtnProps {
  name: IconName;
  onClick?: () => void;
  title?: string;
  active?: boolean;
}

export function IconBtn({ name, onClick, title, active }: IconBtnProps) {
  return (
    <button
      className="md-btn"
      title={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "var(--ink)" : "var(--ink-3)",
        background: active ? "var(--panel-3)" : "transparent",
        transition: "background .1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--panel-3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? "var(--panel-3)" : "transparent";
      }}
    >
      <Icon name={name} size={14} />
    </button>
  );
}

// ── AppDot ──────────────────────────────────────────────────────────
export interface AppDotProps {
  app: string;
  size?: number;
}

export function AppDot({ app, size = 22 }: AppDotProps) {
  const a = appById[app];
  if (!a) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          background: "var(--panel-3)",
        }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size / 4.5,
        background: a.color,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
        fontWeight: 700,
        letterSpacing: -0.5,
        flexShrink: 0,
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      {a.initials}
    </span>
  );
}

// ── CountryFlag ─────────────────────────────────────────────────────
export interface CountryFlagProps {
  cc: CountryCode;
  size?: number;
}

export function CountryFlag({ cc, size = 14 }: CountryFlagProps) {
  const c = countries[cc];
  return (
    <span style={{ fontSize: size, lineHeight: 1, filter: "saturate(0.9)" }}>
      {c?.flag || "🏳️"}
    </span>
  );
}

// ── Sparkline ───────────────────────────────────────────────────────
export interface SparklineProps {
  data: readonly number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({
  data,
  w = 80,
  h = 22,
  color = "currentColor",
  fill = false,
}: SparklineProps) {
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const pts = data.map((v, i): [number, number] => [i * step, h - (v / max) * (h - 2) - 1]);
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const dFill = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {fill && <path d={dFill} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Card ────────────────────────────────────────────────────────────
export interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  right?: React.ReactNode;
  padded?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, title, eyebrow, right, padded = true, style = {} }: CardProps) {
  return (
    <section
      style={{
        background: "var(--panel)",
        borderRadius: 12,
        border: "0.5px solid var(--hairline)",
        boxShadow: "var(--sh-card)",
        overflow: "hidden",
        minWidth: 0,
        ...style,
      }}
    >
      {(title || eyebrow || right) && (
        <header
          style={{
            padding: "12px 14px 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "0.5px solid var(--hairline)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && (
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: "var(--ink-4)",
                  letterSpacing: 0.08,
                  textTransform: "uppercase",
                }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                  marginTop: eyebrow ? 2 : 0,
                }}
              >
                {title}
              </div>
            )}
          </div>
          {right}
        </header>
      )}
      <div style={padded ? { padding: 14 } : {}}>{children}</div>
    </section>
  );
}

// ── KPI ─────────────────────────────────────────────────────────────
export type KPITone = "neutral" | "up" | "down" | "warn";

export interface KPIProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: React.ReactNode;
  tone?: KPITone;
  sub?: React.ReactNode;
}

export function KPI({ label, value, unit, delta, tone = "neutral", sub }: KPIProps) {
  const toneColor: Record<KPITone, string> = {
    neutral: "var(--ink-3)",
    up: "var(--danger)",
    down: "var(--ok)",
    warn: "var(--warn)",
  };
  const color = toneColor[tone];
  return (
    <div
      style={{
        flex: 1,
        background: "var(--panel)",
        borderRadius: 12,
        padding: "14px 16px",
        border: "0.5px solid var(--hairline)",
        boxShadow: "var(--sh-card)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: "var(--ink-4)",
          letterSpacing: 0.04,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <div
          className="md-tnum"
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: -0.8,
            color: "var(--ink)",
          }}
        >
          {value}
        </div>
        {unit && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>{unit}</div>}
      </div>
      {(delta || sub) && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--ink-3)",
          }}
        >
          {delta && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                color,
                fontWeight: 600,
              }}
            >
              {tone === "up" && <Icon name="arrowUp" size={10} stroke={1.8} />}
              {tone === "down" && <Icon name="arrowDn" size={10} stroke={1.8} />}
              {delta}
            </span>
          )}
          {sub && <span style={{ color: "var(--ink-4)" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ── Toggle ──────────────────────────────────────────────────────────
export interface ToggleProps {
  on: boolean;
  onClick?: () => void;
}

export function Toggle({ on, onClick }: ToggleProps) {
  return (
    <button
      className="md-btn"
      onClick={onClick}
      style={{
        width: 34,
        height: 20,
        borderRadius: 10,
        position: "relative",
        background: on ? "var(--ok)" : "var(--hairline-strong)",
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transition: "left .15s",
        }}
      />
    </button>
  );
}
