const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const char of normalized.replace(/=+$/, "")) {
    const index = BASE64.indexOf(char);
    if (index < 0) throw new Error("Invalid base64url value");
    bits = (bits << 6) | index;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 0xff);
    }
  }

  const escaped = bytes.map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join("");
  return decodeURIComponent(escaped);
}

export function getJwtExpirationMs(token: string): number | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
