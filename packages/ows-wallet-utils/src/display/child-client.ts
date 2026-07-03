import {
  DEFAULT_DISPLAY_TIMEOUT_MS,
  DisplayRequestId,
  OWS_DISPLAY_READY_MODEL_METHOD,
  OWS_HIDE_READY_MODEL_METHOD,
  OWS_RELEASE_DISPLAY_EVENT,
  OWS_REQUEST_DISPLAY_EVENT,
  OWS_REQUEST_HIDE_EVENT,
  deserializeDisplayReady,
  deserializeHideReady,
  serializeRpc,
  type DisplayReadyPayload,
  type HideReadyPayload,
  type RequestDisplayParams,
} from "@1shotapi/ows-types";
import type Postmate from "postmate";
import { debugLog } from "../debug.js";

export type DisplaySession = {
  displayId: DisplayRequestId;
  release(): void;
  hide(): Promise<void>;
};

type PendingDisplay = {
  resolve: (session: DisplaySession) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

type PendingHide = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

let nextDisplayId = 1;

export class DisplayChildClient {
  private readonly pending = new Map<DisplayRequestId, PendingDisplay>();
  private readonly pendingHide = new Map<DisplayRequestId | "anonymous", PendingHide>();
  private readonly childApi: Postmate.ChildAPI;
  private activeSession: DisplaySession | null = null;
  private displayDepth = 0;

  constructor(childApi: Postmate.ChildAPI) {
    this.childApi = childApi;
  }

  handleDisplayReady(data: unknown): void {
    let payload: DisplayReadyPayload;
    try {
      payload = deserializeDisplayReady(data);
    } catch (error) {
      debugLog("display ready deserialize failed", {
        error: error instanceof Error ? error.message : error,
      });
      return;
    }

    const pending = this.pending.get(payload.displayId);
    if (!pending) {
      debugLog("display ready for unknown id", { displayId: payload.displayId });
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pending.delete(payload.displayId);

    const userActivationActive =
      typeof navigator !== "undefined" &&
      "userActivation" in navigator &&
      navigator.userActivation.isActive;

    debugLog("display ready", {
      displayId: payload.displayId,
      userActivationActive,
    });

    const session: DisplaySession = {
      displayId: payload.displayId,
      release: () => this.releaseSession(payload.displayId),
      hide: () => this.requestHide(payload.displayId),
    };
    this.activeSession = session;
    this.displayDepth = 1;
    pending.resolve(session);
  }

  handleHideReady(data: unknown): void {
    let payload: HideReadyPayload;
    try {
      payload = deserializeHideReady(data);
    } catch (error) {
      debugLog("hide ready deserialize failed", {
        error: error instanceof Error ? error.message : error,
      });
      return;
    }

    const key = payload.displayId ?? "anonymous";
    const pending = this.pendingHide.get(key);
    if (!pending) {
      debugLog("hide ready for unknown id", { displayId: payload.displayId });
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingHide.delete(key);
    pending.resolve();
  }

  requestDisplay(
    params: RequestDisplayParams,
    timeoutMs = DEFAULT_DISPLAY_TIMEOUT_MS,
  ): Promise<DisplaySession> {
    if (this.activeSession) {
      this.displayDepth++;
      debugLog("display session reused", {
        displayId: this.activeSession.displayId,
        depth: this.displayDepth,
        ...params,
      });
      return Promise.resolve(this.activeSession);
    }

    const displayId = DisplayRequestId(String(nextDisplayId++));

    return new Promise<DisplaySession>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(displayId);
        reject(new Error("Display request timed out"));
      }, timeoutMs);

      this.pending.set(displayId, { resolve, reject, timeoutId });

      debugLog("requesting display from host", { displayId, ...params });
      this.childApi.emit(
        OWS_REQUEST_DISPLAY_EVENT,
        serializeRpc({ displayId, ...params }),
      );
    });
  }

  requestHide(
    displayId?: DisplayRequestId,
    timeoutMs = DEFAULT_DISPLAY_TIMEOUT_MS,
  ): Promise<void> {
    const key = displayId ?? "anonymous";

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingHide.delete(key);
        reject(new Error("Hide request timed out"));
      }, timeoutMs);

      this.pendingHide.set(key, { resolve, reject, timeoutId });

      debugLog("requesting hide from host", { displayId });
      this.childApi.emit(
        OWS_REQUEST_HIDE_EVENT,
        serializeRpc(
          displayId ? { displayId } : {},
        ),
      );
    }).finally(() => {
      this.clearActiveSession(displayId);
    });
  }

  destroy(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("DisplayChildClient destroyed"));
    }
    for (const pending of this.pendingHide.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("DisplayChildClient destroyed"));
    }
    this.pending.clear();
    this.pendingHide.clear();
    this.activeSession = null;
    this.displayDepth = 0;
  }

  private releaseSession(displayId: DisplayRequestId): void {
    if (!this.activeSession || this.activeSession.displayId !== displayId) {
      return;
    }

    this.displayDepth = Math.max(0, this.displayDepth - 1);
    if (this.displayDepth > 0) {
      debugLog("display session retained", { displayId, depth: this.displayDepth });
      return;
    }

    debugLog("releasing display", { displayId });
    this.childApi.emit(
      OWS_RELEASE_DISPLAY_EVENT,
      serializeRpc({ displayId } satisfies { displayId: DisplayRequestId }),
    );
    this.clearActiveSession(displayId);
  }

  private clearActiveSession(displayId?: DisplayRequestId): void {
    if (displayId && this.activeSession?.displayId !== displayId) {
      return;
    }
    this.activeSession = null;
    this.displayDepth = 0;
  }
}

export const DISPLAY_READY_MODEL_METHOD = OWS_DISPLAY_READY_MODEL_METHOD;
export const HIDE_READY_MODEL_METHOD = OWS_HIDE_READY_MODEL_METHOD;
