/** Child → host: branding pushes an EIP-1193 provider notification. */
export const OWS_EIP1193_EVENT = "ows:eip1193" as const;

/**
 * Branding→Host EIP-1193 notification payload.
 * `event` is the EIP-1193 event name (`chainChanged`, `accountsChanged`, …);
 * `params` are the listener arguments (spread when delivered on the host).
 */
export interface IOWSEip1193EventNotification {
  event: string;
  params: unknown[];
}

/**
 * Parse an `ows:eip1193` Postmate payload.
 */
export function deserializeEip1193EventNotification(
  data: unknown,
): IOWSEip1193EventNotification {
  const parsed = parseJson(data);

  if (typeof parsed.event !== "string" || parsed.event.length === 0) {
    throw new Error("Invalid EIP-1193 event notification: event");
  }
  if (!Array.isArray(parsed.params)) {
    throw new Error("Invalid EIP-1193 event notification: params");
  }

  return {
    event: parsed.event,
    params: parsed.params,
  };
}

function parseJson(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid EIP-1193 event JSON payload");
    }
    return parsed as Record<string, unknown>;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid EIP-1193 event payload");
  }
  return data as Record<string, unknown>;
}
