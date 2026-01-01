// PKCE (Proof Key for Code Exchange) utilities
import { createHash, randomBytes } from "crypto";

// Base64URL encode for PKCE
export function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Verify PKCE code challenge
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method === "S256") {
    const hash = createHash("sha256").update(codeVerifier).digest();
    const computed = base64UrlEncode(hash);
    return computed === codeChallenge;
  }
  // plain method (not recommended but supported)
  return codeVerifier === codeChallenge;
}

// Generate access token
export function generateAccessToken(): string {
  return createHash("sha256")
    .update(randomBytes(16).toString("hex") + Date.now().toString())
    .digest("hex");
}

// Generate refresh token
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

// Generate authorization code
export function generateAuthorizationCode(): string {
  return randomBytes(32).toString("hex");
}

// Generate CSRF token
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

// Generate client credentials
export function generateClientCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: randomBytes(16).toString("hex"),
    clientSecret: randomBytes(32).toString("hex"),
  };
}
