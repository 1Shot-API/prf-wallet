import { DomainString } from "@1shotapi/ows-types";

/**
 * Best-effort host page hostname for analytics `hostDomain`.
 * Prefers the embedding ancestor / referrer when in an iframe.
 */
export function resolveHostDomain(): DomainString {
  if (typeof window === "undefined") {
    return DomainString("localhost");
  }

  const ancestors = window.location.ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    try {
      return DomainString(new URL(ancestors[ancestors.length - 1]!).hostname);
    } catch {
      // fall through
    }
  }

  if (document.referrer) {
    try {
      return DomainString(new URL(document.referrer).hostname);
    } catch {
      // fall through
    }
  }

  return DomainString(window.location.hostname || "localhost");
}
