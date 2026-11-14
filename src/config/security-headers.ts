type SecurityHeaderOptions = {
  isDev: boolean;
  /** `NEXT_PUBLIC_HERO_VIDEO_BASE_URL`: a path on this site, or the address of a media host. */
  heroVideoBaseUrl?: string;
};

const STRIPE_SCRIPTS = ["https://js.stripe.com", "https://*.js.stripe.com"];
const TURNSTILE = "https://challenges.cloudflare.com";
/** Story photos uploaded from the back office. */
const CLOUDINARY_IMAGES = "https://res.cloudinary.com";

const originOf = (url: string | undefined) => {
  if (!url || url.startsWith("/")) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/**
 * The site's Content Security Policy. Pages are prerendered, so scripts can't carry a per-request
 * nonce and inline scripts stay allowed; everything else is limited to this site plus Stripe
 * (checkout), Cloudflare Turnstile (form checks) and Cloudinary (story photos).
 */
export const buildContentSecurityPolicy = ({ isDev, heroVideoBaseUrl }: SecurityHeaderOptions) => {
  const mediaHost = originOf(heroVideoBaseUrl);
  const optional = (value: string | null | false) => (value ? [value] : []);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      // React uses eval in development to rebuild server error stacks in the browser.
      ...optional(isDev && "'unsafe-eval'"),
      ...STRIPE_SCRIPTS,
      TURNSTILE,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      CLOUDINARY_IMAGES,
      "https://*.stripe.com",
      ...optional(mediaHost),
    ],
    "media-src": ["'self'", ...optional(mediaHost)],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://api.stripe.com",
      "https://checkout.stripe.com",
      TURNSTILE,
      // Hot reloading talks to the dev server over a websocket.
      ...optional(isDev && "ws:"),
    ],
    "frame-src": [
      ...STRIPE_SCRIPTS,
      "https://hooks.stripe.com",
      "https://checkout.stripe.com",
      TURNSTILE,
    ],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Only in production: on http://localhost it would send asset requests to https.
  if (!isDev) policy.push("upgrade-insecure-requests");

  return policy.join("; ");
};

/** Headers sent with every response. */
export const buildSecurityHeaders = (options: SecurityHeaderOptions) => [
  { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Browsers ignore this over plain http, so it's safe to send in development too.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];
