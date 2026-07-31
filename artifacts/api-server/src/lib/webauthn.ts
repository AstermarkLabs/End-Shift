import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";

export const RP_NAME = process.env["WEBAUTHN_RP_NAME"] ?? "End Shift";

// EAS builds and the web deployment use the same relying-party domain. Keep
// localhost as the zero-config development default, but never emit localhost
// options from a production API: the browser and native Credential Manager
// will reject those options when the app is served from end-shift.replit.app.
function configuredHost(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(/^https?:\/\//.test(value) ? value : `https://${value}`).hostname;
  } catch {
    return undefined;
  }
}

const REPLIT_HOST = configuredHost(
  process.env["REPLIT_INTERNAL_APP_DOMAIN"] ?? process.env["REPLIT_DEV_DOMAIN"],
);
const DEFAULT_RP_ID =
  REPLIT_HOST ?? (process.env["NODE_ENV"] === "production" ? "end-shift.replit.app" : "localhost");
export const RP_ID = process.env["WEBAUTHN_RP_ID"] ?? DEFAULT_RP_ID;

// Web origin (HTTPS for production, HTTP for localhost dev).
const WEB_ORIGIN =
  process.env["WEBAUTHN_ORIGIN"] ??
  `${RP_ID === "localhost" ? "http" : "https"}://${RP_ID}`;

// The checked-in Android debug keystore signs local `expo run:android` builds.
// It is public by design and only used outside production so the API verifier
// and the generated Digital Asset Links document agree during device testing.
// Release builds must set WEBAUTHN_ANDROID_SHA256 to their release certificate.
const DEBUG_ANDROID_SHA256 =
  "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C";

// Android native passkey origins: derived from app signing certificate SHA-256
// fingerprints.  Supply WEBAUTHN_ANDROID_SHA256 as one or more colon-separated
// hex fingerprints (the format shown in Android Studio / Play Console), joined
// by commas when multiple keys are needed (e.g. debug + release builds):
//   AA:BB:CC:DD:...,EE:FF:00:11:...
// If not set, Android native passkeys cannot be verified server-side.
function computeAndroidOrigins(): string[] {
  const raw =
    process.env["WEBAUTHN_ANDROID_SHA256"] ??
    (process.env["NODE_ENV"] === "production" ? undefined : DEBUG_ANDROID_SHA256);
  if (!raw) return [];
  return raw
    .split(",")
    .map((hex) => hex.trim())
    .filter(Boolean)
    .flatMap((hex) => {
      try {
        const bytes = Buffer.from(hex.replace(/:/g, ""), "hex");
        return [`android:apk-key-hash:${bytes.toString("base64url")}`];
      } catch {
        return [];
      }
    });
}

const ANDROID_ORIGINS = computeAndroidOrigins();

// Build the full list of accepted origins.  Verification calls accept an
// array so both web and Android native credentials work against the same RP.
export const EXPECTED_ORIGINS: string[] = [WEB_ORIGIN, ...ANDROID_ORIGINS];

// Convenience alias kept for callers that only need a single-origin string.
export const EXPECTED_ORIGIN = WEB_ORIGIN;

export async function buildRegistrationOptions(opts: {
  userId: number;
  username: string;
  displayName: string;
  excludeCredentials: Array<{ id: string; transports?: string[] }>;
}) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new Uint8Array(Buffer.from(String(opts.userId), "utf-8")),
    userName: opts.username,
    userDisplayName: opts.displayName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: opts.excludeCredentials.map((c) => ({
      id: c.id,
      transports: c.transports as never,
    })),
  });
}

export async function verifyRegistration(opts: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
}) {
  return verifyRegistrationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: EXPECTED_ORIGINS,
    expectedRPID: RP_ID,
  });
}

export async function buildAuthenticationOptions(opts: {
  allowCredentials: Array<{ id: string; transports?: string[] }>;
}) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
    allowCredentials: opts.allowCredentials.map((c) => ({
      id: c.id,
      transports: c.transports as never,
    })),
  });
}

export async function verifyAuthentication(opts: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  credentialPublicKey: Uint8Array;
  credentialID: string;
  counter: number;
}) {
  return verifyAuthenticationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: EXPECTED_ORIGINS,
    expectedRPID: RP_ID,
    credential: {
      id: opts.credentialID,
      publicKey: new Uint8Array(opts.credentialPublicKey),
      counter: opts.counter,
    },
  });
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}
