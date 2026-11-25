import {
  OWS_ANALYTICS_EVENT,
  deserializeAnalyticsEvent,
  type IOWSAnalyticsEvent,
} from "@1shotapi/ows-types";
import type Postmate from "postmate";

export type AnalyticsListener = (event: IOWSAnalyticsEvent) => void;

/**
 * Host-side fan-out for Branding→Host `ows:analytics` events.
 * Delivers the full rich payload (OWS base fields typed; extras untyped).
 */
export class AnalyticsHostHandler {
  private readonly allListeners = new Set<AnalyticsListener>();
  private readonly namedListeners = new Map<string, Set<AnalyticsListener>>();
  private destroyed = false;

  constructor(parent: Postmate.ParentAPI) {
    parent.on(OWS_ANALYTICS_EVENT, (data: unknown) => {
      this.handleAnalytics(data);
    });
  }

  /**
   * Subscribe to all analytics events, or only those matching `name`.
   * Returns an unsubscribe function.
   */
  on(listener: AnalyticsListener): () => void;
  on(name: string, listener: AnalyticsListener): () => void;
  on(
    nameOrListener: string | AnalyticsListener,
    maybeListener?: AnalyticsListener,
  ): () => void {
    if (typeof nameOrListener === "function") {
      const listener = nameOrListener;
      this.allListeners.add(listener);
      return () => {
        this.allListeners.delete(listener);
      };
    }

    const name = nameOrListener;
    const listener = maybeListener;
    if (!listener) {
      throw new Error("analytics.on(name, listener) requires a listener");
    }
    let set = this.namedListeners.get(name);
    if (!set) {
      set = new Set();
      this.namedListeners.set(name, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) {
        this.namedListeners.delete(name);
      }
    };
  }

  off(listener: AnalyticsListener): void {
    this.allListeners.delete(listener);
    for (const [name, set] of this.namedListeners) {
      set.delete(listener);
      if (set.size === 0) {
        this.namedListeners.delete(name);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.allListeners.clear();
    this.namedListeners.clear();
  }

  private handleAnalytics(data: unknown): void {
    if (this.destroyed) {
      return;
    }

    let event: IOWSAnalyticsEvent;
    try {
      event = deserializeAnalyticsEvent(data);
    } catch {
      return;
    }

    for (const listener of this.allListeners) {
      try {
        listener(event);
      } catch {
        // Host listener errors must not break the proxy.
      }
    }

    const named = this.namedListeners.get(event.name);
    if (!named) {
      return;
    }
    for (const listener of named) {
      try {
        listener(event);
      } catch {
        // Host listener errors must not break the proxy.
      }
    }
  }
}
