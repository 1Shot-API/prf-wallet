import {
  OWS_ANALYTICS_EVENT,
  serializeRpc,
  type IOWSAnalyticsEvent,
} from "@1shotapi/ows-types";
import type Postmate from "postmate";
import { debugLog } from "../debug.js";

/**
 * Branding → Host analytics push (fire-and-forget Postmate emit).
 * Failures are logged and never thrown into wallet UX.
 */
export class AnalyticsChildClient {
  private readonly childApi: Postmate.ChildAPI;

  constructor(childApi: Postmate.ChildAPI) {
    this.childApi = childApi;
  }

  emit(event: IOWSAnalyticsEvent): void {
    try {
      this.childApi.emit(OWS_ANALYTICS_EVENT, serializeRpc(event));
    } catch (error) {
      debugLog("analytics emit failed", {
        name: event.name,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}
