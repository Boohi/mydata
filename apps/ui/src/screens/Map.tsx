// World map view — port of screens-map.jsx with the design-time `tweaks` props
// dropped (we always render the calm + light branch).
import { useMemo, useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { IconBtn, Pill } from "../components/primitives";
import { categories, countries, destCoords, destinations, origin } from "../data/mock";
import type { CategoryId, CountryCode, Destination } from "../data/types";

// Equirectangular world. lng [-180, 180] → x [0, 720]. lat [78, -56] → y [0, 300].
const MD_MAP_W = 720;
const MD_MAP_H = 300;
const MD_LAT_TOP = 78;
const MD_LAT_BOT = -56;

function mdProject(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * MD_MAP_W;
  const y = ((MD_LAT_TOP - lat) / (MD_LAT_TOP - MD_LAT_BOT)) * MD_MAP_H;
  return [x, y];
}

// 72-col × 30-row hand-mapped land mask (rough but recognizable).
// '.' = ocean, '#' = land. Each cell ≈ 5° lng × 4.5° lat.
const MD_LAND_MASK: readonly string[] = [
  "........................................................................",
  ".....#####....#####################........................##########...",
  "...#######....######################...........................#####....",
  "..########..#########################....................######........",
  "..########.#########################.................#####............",
  "..#######..#######################.................#################...",
  ".######....#####################...................#################...",
  ".######......################.......................################...",
  ".######.........##########..............#......#######################..",
  "..######............####...............####...########################.",
  "...####...............#................######.######################...",
  "....##..................................#####.#######################..",
  "....##....................................##.######################...",
  ".....#.......................................#####################....",
  "....##........................................###################.....",
  "....##..........................................################......",
  "...##.............................................##############......",
  "..###.............................................###############.....",
  "..###..............................................##############.....",
  "..##................................................##.########.......",
  "..#..................................................#..######........",
  "..#..................................................#..#####.........",
  "..#...................................................#..####........#",
  "..#....................................................#..##.........#",
  "..#.....................................................##............",
  "..#.....................................................##.......####.",
  "..#......................................................#......######",
  "..........................................................#......####.",
  "..........................................................#....#.#....",
  "...............................................................#......",
];

// ── Pre-render the land dots so we don't reflow on every render ─────
const MD_LAND_DOTS: ReadonlyArray<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  const rows = MD_LAND_MASK.length;
  const cols = MD_LAND_MASK[0].length;
  const cw = MD_MAP_W / cols;
  const ch = MD_MAP_H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (MD_LAND_MASK[r][c] === "#") {
        out.push([c * cw + cw / 2, r * ch + ch / 2]);
      }
    }
  }
  return out;
})();

// Arc path from origin to dest as a quadratic bezier curved upward.
function mdArcPath([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1,
    dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const cx = mx;
  const cy = my - dist * 0.28;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

interface MDWorldMapProps {
  dests: readonly Destination[];
  hovered: string | null;
  onHover?: (id: string | null) => void;
  filter: string;
}

function MDWorldMap({ dests, hovered, onHover, filter }: MDWorldMapProps) {
  const [origX, origY] = mdProject(origin.lat, origin.lng);
  const projected = useMemo(
    () =>
      dests
        .map((d) => {
          const c = destCoords[d.id];
          if (!c) return null;
          const [x, y] = mdProject(c.lat, c.lng);
          return { d, x, y, coord: c };
        })
        .filter(
          (v): v is { d: Destination; x: number; y: number; coord: (typeof destCoords)[string] } =>
            v !== null
        ),
    [dests]
  );
  const maxMb = Math.max(...dests.map((d) => d.mb), 1);

  // Light-mode hardcoded values (we no longer accept a `dark` prop).
  const landColor = "rgba(15,23,42,0.18)";
  const landDot = "rgba(15,23,42,0.34)";

  return (
    <svg
      viewBox={`0 0 ${MD_MAP_W} ${MD_MAP_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block", userSelect: "none" }}
    >
      {/* Grid lines (equator, tropics) — very subtle */}
      <g stroke={landColor} strokeWidth="0.5" opacity="0.5">
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={0}
            x2={MD_MAP_W}
            y1={MD_MAP_H * p}
            y2={MD_MAP_H * p}
            strokeDasharray="2 4"
          />
        ))}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={`v${p}`}
            x1={MD_MAP_W * p}
            x2={MD_MAP_W * p}
            y1={0}
            y2={MD_MAP_H}
            strokeDasharray="2 4"
          />
        ))}
      </g>

      {/* Land dot grid */}
      <g fill={landDot}>
        {MD_LAND_DOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.1" />
        ))}
      </g>

      {/* Flow lines */}
      <g fill="none" strokeLinecap="round">
        {projected.map(({ d, x, y }) => {
          const c = countries[d.country];
          const isHovered = hovered === d.id;
          const isFiltered = filter && filter !== "all" && d.category !== filter;
          if (isFiltered) return null;
          const stroke = c.color;
          const weight = isHovered ? 2 : 0.9 + (d.mb / maxMb) * 1.6;
          const opacity = isHovered ? 1 : 0.55;
          return (
            <path
              key={d.id}
              d={mdArcPath([origX, origY], [x, y])}
              stroke={stroke}
              strokeWidth={weight}
              opacity={opacity}
              className="md-flow"
              style={{ animationDuration: `${1.2 + (1 - d.mb / maxMb) * 1.4}s` }}
            />
          );
        })}
      </g>

      {/* Destination pings */}
      <g>
        {projected.map(({ d, x, y }) => {
          const c = countries[d.country];
          const isHovered = hovered === d.id;
          const isFiltered = filter && filter !== "all" && d.category !== filter;
          const baseColor = c.color;
          const r = 2.6 + Math.min(6, (d.mb / maxMb) * 7);
          return (
            <g
              key={d.id}
              opacity={isFiltered ? 0.15 : 1}
              onMouseEnter={() => onHover?.(d.id)}
              onMouseLeave={() => onHover?.(null)}
              style={{ cursor: "pointer" }}
            >
              {/* halo */}
              <circle cx={x} cy={y} r={r + 4} fill={baseColor} opacity={isHovered ? 0.25 : 0.12} />
              <circle cx={x} cy={y} r={r} fill={baseColor} stroke={"#fff"} strokeWidth="1.4" />
              {/* label for top destinations */}
              {(d.mb > 80 || isHovered) && !isFiltered && (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={x + 8}
                    y={y - 18}
                    width={d.name.length * 5.2 + 16}
                    height="14"
                    rx="3"
                    fill={"rgba(255,255,255,0.92)"}
                    stroke={landColor}
                    strokeWidth="0.4"
                  />
                  <text
                    x={x + 12}
                    y={y - 8.5}
                    fontSize="8.5"
                    fontWeight="600"
                    fill={"#1a1a1f"}
                    fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                  >
                    {d.name}{" "}
                    <tspan fill={baseColor} fontWeight="700">
                      ·
                    </tspan>{" "}
                    <tspan fill={"rgba(0,0,0,0.5)"}>{d.mb.toFixed(0)}M</tspan>
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* Origin */}
      <g>
        <circle cx={origX} cy={origY} r="14" fill="var(--accent)" opacity="0.16" />
        <circle cx={origX} cy={origY} r="8" fill="var(--accent)" opacity="0.32" />
        <circle
          cx={origX}
          cy={origY}
          r="4.5"
          fill="var(--accent)"
          stroke={"#fff"}
          strokeWidth="1.6"
        />
        <g style={{ pointerEvents: "none" }}>
          <rect x={origX + 10} y={origY - 22} width="88" height="14" rx="3" fill="var(--accent)" />
          <text
            x={origX + 14}
            y={origY - 12.5}
            fontSize="8.5"
            fontWeight="700"
            fill="#fff"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          >
            YOU · Helsinki, FI
          </text>
        </g>
      </g>
    </svg>
  );
}

type Filter = "all" | CategoryId;

export function WorldMapScreen() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const filteredDests = useMemo(
    () => (filter === "all" ? destinations : destinations.filter((d) => d.category === filter)),
    [filter]
  );

  const totalMb = filteredDests.reduce((s, d) => s + d.mb, 0);
  const countrySet = new Set(filteredDests.map((d) => d.country));

  const byCountry = useMemo(() => {
    const g: Partial<Record<CountryCode, Destination[]>> = {};
    for (const d of filteredDests) {
      (g[d.country] ||= []).push(d);
    }
    return (Object.entries(g) as Array<[CountryCode, Destination[]]>)
      .map(([cc, items]) => ({ cc, items, total: items.reduce((s, x) => s + x.mb, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDests]);

  const legend: ReadonlyArray<[CountryCode, string]> = [
    ["US", "United States"],
    ["CN", "China"],
    ["RU", "Russia"],
    ["DE", "Germany"],
    ["IE", "Ireland"],
    ["SG", "Singapore"],
    ["AE", "UAE"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenHeader
        kicker="Live · last 5 minutes"
        title="World map"
        subtitle="Every active connection from your machine, drawn to where the data lands."
        right={
          <>
            <Pill active>Live</Pill>
            <Pill>1h</Pill>
            <Pill>24h</Pill>
            <div style={{ width: 8 }} />
            <IconBtn name="download" title="Export map" />
          </>
        }
      />
      <div
        style={{
          padding: "10px 20px 6px",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600, marginRight: 4 }}>
          SHOW
        </span>
        <Pill active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Pill>
        {(Object.entries(categories) as Array<[CategoryId, (typeof categories)[CategoryId]]>).map(
          ([k, c]) => (
            <Pill key={k} active={filter === k} onClick={() => setFilter(k)}>
              {c.label}
            </Pill>
          )
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
          <span className="md-tnum md-mono" style={{ color: "var(--ink-2)", fontWeight: 600 }}>
            {filteredDests.length}
          </span>{" "}
          destinations · {countrySet.size} countries · {totalMb.toFixed(0)} MB
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          minHeight: 0,
          padding: "8px 20px 20px",
          gap: 14,
        }}
      >
        {/* Map */}
        <div
          style={{
            background: "oklch(0.97 0.005 252)",
            borderRadius: 14,
            border: "0.5px solid var(--hairline)",
            boxShadow: "var(--sh-card)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <MDWorldMap
            dests={filteredDests}
            hovered={hovered}
            onHover={setHovered}
            filter={filter}
          />

          {/* Map legend */}
          <div
            style={{
              position: "absolute",
              left: 16,
              bottom: 14,
              background: "rgba(255,255,255,0.86)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "0.5px solid var(--hairline)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 10.5,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: "var(--ink-4)",
                letterSpacing: 0.08,
                textTransform: "uppercase",
              }}
            >
              Legend
            </div>
            {legend.map(([cc, name]) => (
              <div key={cc} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: countries[cc].color,
                  }}
                />
                <span style={{ color: "var(--ink-2)" }}>{name}</span>
              </div>
            ))}
          </div>

          {/* Big stat overlay */}
          <div
            style={{
              position: "absolute",
              right: 16,
              top: 14,
              background: "rgba(255,255,255,0.86)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "0.5px solid var(--hairline)",
              borderRadius: 10,
              padding: "10px 14px",
              minWidth: 180,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: "var(--ink-4)",
                letterSpacing: 0.08,
                textTransform: "uppercase",
              }}
            >
              Right now
            </div>
            <div
              className="md-tnum"
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: -0.5,
                marginTop: 4,
              }}
            >
              2.4{" "}
              <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>MB/s out</span>
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "var(--ink-3)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span className="md-live-dot" />
              {filteredDests.filter((d) => d.mb > 0).length} active hosts
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div
          className="md-scroll"
          style={{
            background: "var(--panel)",
            borderRadius: 14,
            border: "0.5px solid var(--hairline)",
            boxShadow: "var(--sh-card)",
            overflow: "auto",
          }}
        >
          <div style={{ padding: "12px 14px 10px", borderBottom: "0.5px solid var(--hairline)" }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: "var(--ink-4)",
                letterSpacing: 0.08,
                textTransform: "uppercase",
              }}
            >
              By country
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
              {countrySet.size} jurisdictions
            </div>
          </div>
          {byCountry.map((g, gi) => (
            <div key={g.cc}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: "var(--panel-2)",
                  borderTop: gi === 0 ? 0 : "0.5px solid var(--hairline)",
                  borderBottom: "0.5px solid var(--hairline)",
                }}
              >
                <span style={{ fontSize: 14 }}>{countries[g.cc].flag}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
                  {countries[g.cc].name}
                </span>
                <span
                  style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-4)" }}
                  className="md-tnum"
                >
                  {g.total.toFixed(1)} MB
                </span>
              </div>
              {g.items.map((d, i) => (
                <div
                  key={d.id}
                  onMouseEnter={() => setHovered(d.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="md-row"
                  style={{
                    padding: "7px 14px",
                    borderTop: i === 0 ? 0 : "0.5px solid var(--hairline)",
                    background: hovered === d.id ? "var(--accent-soft)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: countries[d.country].color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-2)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.name}
                  </span>
                  <span
                    className="md-tnum md-mono"
                    style={{ fontSize: 10.5, color: "var(--ink-4)" }}
                  >
                    {d.mb.toFixed(1)}M
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
