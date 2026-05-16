import { useMemo, useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, Card, Pill } from "../components/primitives";
import { categories, countries, destinations } from "../data/mock";
import type { CategoryId, CountryCode, Destination } from "../data/types";

type GroupBy = "country" | "category" | "company";
type Filter = "all" | CategoryId;

interface Group {
  key: string;
  items: Destination[];
  total: number;
}

export function Destinations() {
  const [groupBy, setGroupBy] = useState<GroupBy>("country");
  const [filter, setFilter] = useState<Filter>("all");

  const groups: Group[] = useMemo(() => {
    const filt =
      filter === "all" ? destinations : destinations.filter((d) => d.category === filter);
    const g: Record<string, Destination[]> = {};
    for (const d of filt) {
      const key =
        groupBy === "country" ? d.country : groupBy === "category" ? d.category : d.company;
      (g[key] ||= []).push(d);
    }
    return Object.entries(g)
      .map(([k, v]) => ({
        key: k,
        items: v.slice().sort((a, b) => b.mb - a.mb),
        total: v.reduce((s, x) => s + x.mb, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [groupBy, filter]);

  const totalMb = destinations.reduce((s, d) => s + d.mb, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenHeader
        kicker={`${destinations.length} destinations · 14 apps`}
        title="Destinations"
        subtitle="Companies and services receiving data from your machine. Block any line item."
        right={
          <>
            <Pill active={groupBy === "country"} onClick={() => setGroupBy("country")}>
              Country
            </Pill>
            <Pill active={groupBy === "company"} onClick={() => setGroupBy("company")}>
              Company
            </Pill>
            <Pill active={groupBy === "category"} onClick={() => setGroupBy("category")}>
              Category
            </Pill>
          </>
        }
      />
      <div
        style={{
          padding: "12px 20px 4px",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-4)",
            fontWeight: 600,
            marginRight: 4,
          }}
        >
          FILTER
        </span>
        <Pill active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Pill>
        {(Object.entries(categories) as [CategoryId, (typeof categories)[CategoryId]][]).map(
          ([k, c]) => (
            <Pill key={k} active={filter === k} onClick={() => setFilter(k)}>
              {c.label}
            </Pill>
          )
        )}
      </div>
      <div
        className="md-scroll"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 20px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {groups.map((g) => {
          const groupLabel =
            groupBy === "country"
              ? `${countries[g.key as CountryCode].flag}  ${countries[g.key as CountryCode].name}`
              : groupBy === "category"
                ? categories[g.key as CategoryId].label
                : g.key;
          const groupBlurb =
            groupBy === "country"
              ? countries[g.key as CountryCode].risk === "high"
                ? "High-risk jurisdiction"
                : countries[g.key as CountryCode].risk === "med"
                  ? "Medium-risk"
                  : "Low-risk jurisdiction"
              : groupBy === "category"
                ? categories[g.key as CategoryId].blurb
                : `${g.items.length} ${g.items.length === 1 ? "destination" : "destinations"}`;
          return (
            <Card
              key={g.key}
              padded={false}
              title={groupLabel}
              eyebrow={groupBlurb}
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="md-tnum"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {g.total.toFixed(1)} MB
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
                    {((g.total / totalMb) * 100).toFixed(1)}% of total
                  </span>
                </div>
              }
            >
              {g.items.map((d, i) => {
                const c = countries[d.country];
                const cat = categories[d.category];
                return (
                  <div
                    key={d.id}
                    className="md-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 80px 90px 90px",
                      alignItems: "center",
                      gap: 14,
                      padding: "9px 14px",
                      borderTop: i === 0 ? 0 : "0.5px solid var(--hairline)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{c.flag}</span>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: "var(--ink)",
                          }}
                        >
                          {d.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "var(--ink-4)",
                          marginTop: 2,
                        }}
                      >
                        {d.company} · {d.purpose}
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      <Badge tint={cat.tint}>{cat.label}</Badge>
                    </div>
                    <div
                      className="md-mono md-tnum"
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-3)",
                        textAlign: "right",
                      }}
                    >
                      {d.conns.toLocaleString()} <span style={{ color: "var(--ink-5)" }}>conn</span>
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
                      {d.mb.toFixed(1)}{" "}
                      <span style={{ fontWeight: 400, color: "var(--ink-4)" }}>MB</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="md-btn"
                        style={{
                          padding: "4px 9px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          border: "0.5px solid var(--hairline-2)",
                          color: "var(--ink-2)",
                          background: "var(--panel)",
                        }}
                      >
                        Allow
                      </button>
                      <button
                        className="md-btn"
                        style={{
                          padding: "4px 9px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          background: "var(--danger-soft)",
                          color: "var(--danger)",
                        }}
                      >
                        Block
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
