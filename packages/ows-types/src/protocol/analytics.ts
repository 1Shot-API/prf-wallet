import { AnalyticsEventId } from "../primitives/AnalyticsEventId.js";
import { DomainString } from "../primitives/DomainString.js";
import { UnixTimestamp } from "../primitives/UnixTimestamp.js";

/** Child → host: branding iframe publishes a product analytics event. */
export const OWS_ANALYTICS_EVENT = "ows:analytics" as const;

/**
 * Required Branding→Host analytics base. Branding may attach additional
 * properties; OWS does not type them. Event catalogs are branding-owned.
 */
export interface IOWSAnalyticsEvent {
  eventId: AnalyticsEventId;
  timestamp: UnixTimestamp;
  hostDomain: DomainString;
  name: string;
  [key: string]: unknown;
}

export type OWSAnalyticsEventOptions = {
  eventId?: AnalyticsEventId;
  timestamp?: UnixTimestamp;
};

/**
 * Abstract base analytics event. Branding layers must extend this and call
 * `super` so `eventId` / `timestamp` / branded `hostDomain` are filled.
 *
 * @example
 * ```ts
 * class AccountCreatedEvent extends OWSAnalyticsEvent {
 *   constructor(
 *     hostDomain: DomainString,
 *     public readonly accountAddress: EVMAccountAddress,
 *   ) {
 *     super("AccountCreated", hostDomain);
 *   }
 * }
 * ```
 */
export abstract class OWSAnalyticsEvent implements IOWSAnalyticsEvent {
  readonly eventId: AnalyticsEventId;
  readonly timestamp: UnixTimestamp;
  [key: string]: unknown;

  constructor(
    public readonly name: string,
    public readonly hostDomain: DomainString,
    options?: OWSAnalyticsEventOptions,
  ) {
    if (name.length === 0) {
      throw new Error("OWSAnalyticsEvent requires a non-empty name");
    }
    if (hostDomain.length === 0) {
      throw new Error("OWSAnalyticsEvent requires a non-empty hostDomain");
    }

    this.eventId = options?.eventId ?? AnalyticsEventId(crypto.randomUUID());
    this.timestamp =
      options?.timestamp ?? UnixTimestamp(Math.floor(Date.now() / 1000));
  }
}

/**
 * Parse an `ows:analytics` Postmate payload.
 * Validates and brands the four required base fields; preserves all other
 * enumerable properties so hosts receive the full rich event.
 */
export function deserializeAnalyticsEvent(data: unknown): IOWSAnalyticsEvent {
  const parsed = parseJson(data);

  if (typeof parsed.eventId !== "string" || parsed.eventId.length === 0) {
    throw new Error("Invalid analytics event: eventId");
  }
  if (typeof parsed.timestamp !== "number" || !Number.isFinite(parsed.timestamp)) {
    throw new Error("Invalid analytics event: timestamp");
  }
  if (typeof parsed.hostDomain !== "string" || parsed.hostDomain.length === 0) {
    throw new Error("Invalid analytics event: hostDomain");
  }
  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    throw new Error("Invalid analytics event: name");
  }

  return {
    ...parsed,
    eventId: AnalyticsEventId(parsed.eventId),
    timestamp: UnixTimestamp(parsed.timestamp),
    hostDomain: DomainString(parsed.hostDomain),
    name: parsed.name,
  };
}

function parseJson(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid analytics JSON payload");
    }
    return parsed as Record<string, unknown>;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid analytics payload");
  }
  return data as Record<string, unknown>;
}
