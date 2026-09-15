import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config/index.js";

export interface AuthJWTPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
}

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function signAuthToken(
  payload: Omit<AuthJWTPayload, "iat" | "exp" | "iss">,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("syncspace-lite")
    .setExpirationTime(config.JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifyAuthToken(token: string): Promise<AuthJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "syncspace-lite",
    });
    return payload as AuthJWTPayload;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = "ss_token";

export function setAuthCookie(res: { cookie: (name: string, value: string, opts: Record<string, unknown>) => void }, token: string): void {
  const isProduction = config.NODE_ENV === "production";
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookie(res: { clearCookie: (name: string, opts: Record<string, unknown>) => void }): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: config.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
}
