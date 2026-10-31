export const SITE_URL = "https://walletface.org";
export const GITHUB_URL = "https://github.com/CryptographyBloke/Face";
export const CURATED_SPACES = ["yam.eth", "ens.eth", "aavedao.eth"];
export const spacePath = (id: string) => `/spaces/${encodeURIComponent(id)}`;
export const profilePath = (address: string) =>
  `/u/${encodeURIComponent(address)}`;
export const shareUrl = (path: string) => new URL(path, SITE_URL).href;
export const shortAddress = (a: string) =>
  a.length > 16 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
export const validSpaceId = (id: string) =>
  /^[a-z0-9][a-z0-9._-]{0,99}$/.test(id);
export const validAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
export function safeHttps(value: string | null | undefined) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
