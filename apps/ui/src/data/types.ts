// Mock data type definitions ported from the design prototype.

export type CountryCode =
  | "US"
  | "CN"
  | "RU"
  | "DE"
  | "IE"
  | "SG"
  | "NL"
  | "GB"
  | "JP"
  | "HK"
  | "AE";

export type Risk = "low" | "med" | "high";

export interface Country {
  name: string;
  flag: string;
  color: string;
  risk: Risk;
}

export type CategoryId = "ads-analytics" | "cloud" | "social" | "ai" | "system" | "devops";

export type Tint = "danger" | "warn" | "ok" | "accent" | "neutral";

export interface Category {
  label: string;
  tint: Tint;
  blurb: string;
}

export interface Destination {
  id: string;
  name: string;
  company: string;
  country: CountryCode;
  category: CategoryId;
  mb: number;
  conns: number;
  purpose: string;
}

export type AppBreakdownEntry = readonly [destId: string, pct: number];

export interface AppMeta {
  id: string;
  name: string;
  publisher: string;
  mb: number;
  packets: number;
  dests: number;
  color: string;
  initials: string;
  spark: readonly number[];
  breakdown: readonly AppBreakdownEntry[];
}

export type FeedLevel = "info" | "warn" | "danger";

export interface FeedEntry {
  t: string;
  app: string;
  dest: string;
  mb: number;
  level: FeedLevel;
  note: string;
}

export interface DestCoord {
  lat: number;
  lng: number;
  city: string;
  region: string;
}

export type RuleAction = "block" | "allow" | "warn";
export type RuleScope = "always" | "background" | "in-call";
export type RuleWho = "you" | "community";

export interface Rule {
  app: string;
  dest: string;
  action: RuleAction;
  scope: RuleScope;
  who: RuleWho;
}

export interface WeeklyReport {
  totalGB: number;
  totalDelta: number;
  topApp: string;
  topAppGB: number;
  topDest: string;
  topDestGB: number;
  bigMover: { app: string; delta: string; reason: string };
  worldShare: ReadonlyArray<readonly [string, number]>;
  blocks: number;
  trackersBlocked: number;
}
