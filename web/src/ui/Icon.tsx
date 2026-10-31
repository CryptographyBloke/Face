export type IconName =
  | "home"
  | "search"
  | "star"
  | "user"
  | "code"
  | "arrow"
  | "chevron"
  | "external"
  | "copy"
  | "check"
  | "close"
  | "menu"
  | "sun"
  | "moon"
  | "image"
  | "wallet"
  | "activity"
  | "info"
  | "logout"
  | "plus"
  | "globe";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z",
  user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  code: "m7 6-6 6 6 6m10-12 6 6-6 6M14 3l-4 18",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  external:
    "M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  copy: "M8 8h13v13H8ZM16 8V3H3v13h5",
  check: "m5 12 4 4L20 5",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M3 6h18M3 12h18M3 18h18",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10",
  image: "M3 3h18v18H3Zm0 13 6-6 5 5 3-3 4 4M16 7h.01",
  wallet: "M20 7H4V3h15M4 7a2 2 0 0 1-2-2v14a2 2 0 0 0 2 2h18V7ZM17 12h5v5h-5z",
  activity: "M2 12h4l3-8 6 16 3-8h4",
  info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  logout: "M9 21H3V3h6m7 4 5 5-5 5M7 12h14",
  plus: "M12 4v16M4 12h16",
  globe:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2a19 19 0 0 1 0 20 19 19 0 0 1 0-20",
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="13" fill="currentColor" />
      <path
        d="M12 13h7m2 0h7M13 23c2.8 6 11.2 6 14 0"
        stroke="var(--brand-on)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="15" cy="18" r="1.4" fill="var(--brand-on)" />
      <circle cx="25" cy="18" r="1.4" fill="var(--brand-on)" />
    </svg>
  );
}
