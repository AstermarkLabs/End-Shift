import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): string {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  // In production we MUST have explicit, sufficiently-long secrets.
  // Falling back to a deterministic value would let anyone with knowledge of
  // the derivation forge tokens.
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      `Refusing to start: ${name} is required in production and must be at least 16 characters.`,
    );
  }
  // Dev-only deterministic fallback so local development works without setup.
  return `dev-${name}-${process.env["DATABASE_URL"] ?? "local"}`;
}

export interface AccessTokenPayload {
  sub: number;
  username: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: number;
  type: "refresh";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  return jwt.sign(
    { ...payload, type: "access" } satisfies AccessTokenPayload,
    getSecret("JWT_ACCESS_SECRET"),
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

export function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "type">,
): string {
  return jwt.sign(
    { ...payload, type: "refresh" } satisfies RefreshTokenPayload,
    getSecret("JWT_REFRESH_SECRET"),
    { expiresIn: REFRESH_TOKEN_TTL },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getSecret("JWT_ACCESS_SECRET")) as unknown;
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    (decoded as AccessTokenPayload).type !== "access"
  ) {
    throw new Error("Invalid access token");
  }
  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, getSecret("JWT_REFRESH_SECRET")) as unknown;
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    (decoded as RefreshTokenPayload).type !== "refresh"
  ) {
    throw new Error("Invalid refresh token");
  }
  return decoded as RefreshTokenPayload;
}
