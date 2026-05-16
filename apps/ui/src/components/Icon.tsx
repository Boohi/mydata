import React from "react";

export type IconName =
  | "today"
  | "map"
  | "apps"
  | "globe"
  | "rules"
  | "reports"
  | "settings"
  | "search"
  | "pause"
  | "play"
  | "pro"
  | "arrowUp"
  | "arrowDn"
  | "shield"
  | "bolt"
  | "flow"
  | "close"
  | "chev"
  | "chevDn"
  | "chevUp"
  | "dot"
  | "block"
  | "allow"
  | "warn"
  | "user"
  | "plus"
  | "filter"
  | "arrowRt"
  | "download"
  | "logo";

export interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
}

const paths: Record<IconName, React.ReactNode> = {
  today: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l2.5 2.5" />
    </>
  ),
  map: (
    <>
      <path d="M2 4l4-2 4 2 4-2v10l-4 2-4-2-4 2V4z" />
      <path d="M6 2v10M10 4v10" />
    </>
  ),
  apps: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
    </>
  ),
  rules: (
    <>
      <path d="M3 4h10M3 8h10M3 12h6" />
      <circle cx="11.5" cy="12" r="1.5" />
    </>
  ),
  reports: (
    <>
      <path d="M3 13V7M7 13V3M11 13V9" />
      <path d="M2 13h12" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </>
  ),
  pause: (
    <>
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </>
  ),
  play: <path d="M4 3l9 5-9 5V3z" fill="currentColor" />,
  pro: <path d="M8 1l2 4.5 5 .6-3.6 3.4.9 4.9L8 12l-4.3 2.4.9-4.9L1 6.1l5-.6L8 1z" />,
  arrowUp: <path d="M8 13V3M4 7l4-4 4 4" />,
  arrowDn: <path d="M8 3v10M4 9l4 4 4-4" />,
  shield: <path d="M8 1.5l5 2v4c0 3.5-2.5 6-5 7-2.5-1-5-3.5-5-7v-4l5-2z" />,
  bolt: <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" />,
  flow: (
    <>
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="13" cy="13" r="1.5" />
      <path d="M3 4.5C 3 10, 13 6, 13 11.5" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  chev: <path d="M6 4l4 4-4 4" />,
  chevDn: <path d="M4 6l4 4 4-4" />,
  chevUp: <path d="M4 10l4-4 4 4" />,
  dot: <circle cx="8" cy="8" r="1.8" fill="currentColor" />,
  block: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.5 11.5l7-7" />
    </>
  ),
  allow: <path d="M3 8.5l3.5 3L13 4.5" />,
  warn: (
    <>
      <path d="M8 2l6.5 11.5h-13L8 2z" />
      <path d="M8 7v3M8 12v.01" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="6" r="2.5" />
      <path d="M3 14c.5-2.5 2.5-4 5-4s4.5 1.5 5 4" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  filter: <path d="M2 3h12l-4.5 6V14L6.5 12V9L2 3z" />,
  arrowRt: <path d="M3 8h10M9 4l4 4-4 4" />,
  download: <path d="M8 2v9M4 7l4 4 4-4M2 14h12" />,
  logo: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <path d="M8 1.5L8 4.5M8 11.5L8 14.5M1.5 8L4.5 8M11.5 8L14.5 8" />
    </>
  ),
};

export function Icon({ name, size = 14, stroke = 1.6 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
