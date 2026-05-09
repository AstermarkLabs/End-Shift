/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const QR_LIB_PATH = path.resolve(__dirname, "lib", "qr-code-styling.js");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const nonce = crypto.randomBytes(16).toString("base64");

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName)
    .replace(/NONCE_PLACEHOLDER/g, nonce)
    .replace("QR_LIB_PLACEHOLDER", qrLibInline);

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy":
      `script-src 'nonce-${nonce}'; object-src 'none'; base-uri 'self'`,
  });
  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const qrLibSource = fs.readFileSync(QR_LIB_PATH, "utf-8");
// Strip any source-map comment so it is not inlined into HTML responses
const qrLibInline = qrLibSource.replace(/\/\/# sourceMappingURL=\S+/g, "");
const appName = getAppName();

// ─── .well-known handlers ────────────────────────────────────────────────────
// These files are required for native passkey support:
//   iOS  → apple-app-site-association (Associated Domains)
//   Android → assetlinks.json (Digital Asset Links)
//
// Configure with environment variables (see replit.md for details):
//   WEBAUTHN_IOS_TEAM_ID      e.g. ABCDE12345
//   WEBAUTHN_IOS_BUNDLE_ID    e.g. com.endshift.app
//   WEBAUTHN_ANDROID_PACKAGE  e.g. com.endshift.app
//   WEBAUTHN_ANDROID_SHA256   e.g. AA:BB:CC:DD:... (colon-separated hex)

function serveAppleAppSiteAssociation(res) {
  const teamId = process.env["WEBAUTHN_IOS_TEAM_ID"];
  const bundleId = process.env["WEBAUTHN_IOS_BUNDLE_ID"];
  if (!teamId || !bundleId) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: "WEBAUTHN_IOS_TEAM_ID and WEBAUTHN_IOS_BUNDLE_ID are not set",
      }),
    );
    return;
  }
  const body = JSON.stringify({
    webcredentials: { apps: [`${teamId}.${bundleId}`] },
  });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(body);
}

function serveAssetLinks(res) {
  const pkg = process.env["WEBAUTHN_ANDROID_PACKAGE"];
  const sha256 = process.env["WEBAUTHN_ANDROID_SHA256"];
  if (!pkg || !sha256) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          "WEBAUTHN_ANDROID_PACKAGE and WEBAUTHN_ANDROID_SHA256 are not set",
      }),
    );
    return;
  }
  // Android expects colon-separated uppercase hex fingerprints.
  const fingerprint = sha256.toUpperCase();
  const body = JSON.stringify([
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ]);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url || "/", `http://${req.headers.host}`);
  } catch {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  // Native passkey domain-association files — must be served at the root
  // domain (no base-path prefix) before the base-path stripping above would
  // hide them.  We match on the raw URL pathname for these two well-known
  // paths so they are always reachable regardless of BASE_PATH.
  const rawPathname = url.pathname;
  if (rawPathname === "/.well-known/apple-app-site-association") {
    return serveAppleAppSiteAssociation(res);
  }
  if (rawPathname === "/.well-known/assetlinks.json") {
    return serveAssetLinks(res);
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
});
