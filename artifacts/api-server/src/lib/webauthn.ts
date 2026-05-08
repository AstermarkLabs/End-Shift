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
export const RP_ID = process.env["WEBAUTHN_RP_ID"] ?? "localhost";

// Web origin (HTTPS for production, HTTP for localhost dev).
const WEB_ORIGIN = process.env["WEBAUTHN_ORIGIN"] ?? `http://${RP_ID}`;

// Android native passkey origin: derived from the app signing certificate's
// SHA-256 fingerprint.  Supply WEBAUTHN_ANDROID_SHA256 as a colon-separated
// hex string (the format shown in Android Studio / Play Console), e.g.
//   AA:BB:CC:DD:...
// If not set, Android native passkeys cannot be verified server-side.
function computeAndroidOrigin(): string | null {
  const hex = process.env["WEBAUTHN_ANDROID_SHA256"];
  if (!hex) return null;
  try {
    const bytes = Buffer.from(hex.replace(/:/g, ""), "hex");
    return `android:apk-key-hash:${bytes.toString("base64url")}`;
  } catch {
    return null;
  }
}

const ANDROID_ORIGIN = computeAndroidOrigin();

// Build the full list of accepted origins.  Verification calls accept an
// array so both web and Android native credentials work against the same RP.
export const EXPECTED_ORIGINS: string[] = [
  WEB_ORIGIN,
  ...(ANDROID_ORIGIN ? [ANDROID_ORIGIN] : []),
];

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
