import { DisplayRequestId } from "../primitives/DisplayRequestId.js";

/** Child → host: branding iframe requests visible/focusable layout. */
export const OWS_REQUEST_DISPLAY_EVENT = "ows:requestDisplay" as const;

/** Child → host: branding iframe no longer needs visible layout. */
export const OWS_RELEASE_DISPLAY_EVENT = "ows:releaseDisplay" as const;

/** Child → host: branding iframe requests the host hide the wallet panel. */
export const OWS_REQUEST_HIDE_EVENT = "ows:requestHide" as const;

/**
 * Host → child Postmate model method carrying display-ready notification.
 * Not an EIP-1193 or custom RPC method.
 */
export const OWS_DISPLAY_READY_MODEL_METHOD = "__owsDisplayReady" as const;

/** Host → child: host confirms the wallet panel is hidden. */
export const OWS_HIDE_READY_MODEL_METHOD = "__owsHideReady" as const;

export const DEFAULT_DISPLAY_TIMEOUT_MS = 30_000;

export type RequestDisplayParams = {
  width: number;
  height: number;
};

export type RequestDisplayEnvelope = RequestDisplayParams & {
  displayId: DisplayRequestId;
};

export type DisplayReadyPayload = {
  displayId: DisplayRequestId;
};

export type ReleaseDisplayEnvelope = {
  displayId: DisplayRequestId;
};

export type RequestHideEnvelope = {
  displayId?: DisplayRequestId;
};

export type HideReadyPayload = {
  displayId?: DisplayRequestId;
};

export function deserializeRequestDisplay(data: unknown): RequestDisplayEnvelope {
  const parsed = parseJson(data);
  if (
    typeof parsed.displayId !== "string" ||
    typeof parsed.width !== "number" ||
    typeof parsed.height !== "number"
  ) {
    throw new Error("Invalid request display envelope");
  }
  return {
    displayId: DisplayRequestId(parsed.displayId),
    width: parsed.width,
    height: parsed.height,
  };
}

export function deserializeDisplayReady(data: unknown): DisplayReadyPayload {
  const parsed = parseJson(data);
  if (typeof parsed.displayId !== "string") {
    throw new Error("Invalid display ready payload");
  }
  return { displayId: DisplayRequestId(parsed.displayId) };
}

export function deserializeReleaseDisplay(data: unknown): ReleaseDisplayEnvelope {
  const parsed = parseJson(data);
  if (typeof parsed.displayId !== "string") {
    throw new Error("Invalid release display envelope");
  }
  return { displayId: DisplayRequestId(parsed.displayId) };
}

export function deserializeRequestHide(data: unknown): RequestHideEnvelope {
  const parsed = parseJson(data);
  const envelope: RequestHideEnvelope = {};
  if (typeof parsed.displayId === "string") {
    envelope.displayId = DisplayRequestId(parsed.displayId);
  }
  return envelope;
}

export function deserializeHideReady(data: unknown): HideReadyPayload {
  const parsed = parseJson(data);
  const payload: HideReadyPayload = {};
  if (typeof parsed.displayId === "string") {
    payload.displayId = DisplayRequestId(parsed.displayId);
  }
  return payload;
}

function parseJson(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid display JSON payload");
    }
    return parsed as Record<string, unknown>;
  }
  if (!data || typeof data !== "object") {
    throw new Error("Invalid display payload");
  }
  return data as Record<string, unknown>;
}
