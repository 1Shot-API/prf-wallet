import {
  OWS_EIP1193_EVENT,
  serializeRpc,
  type IOWSEip1193EventNotification,
} from "@1shotapi/ows-types";
import type Postmate from "postmate";
import { debugLog } from "../debug.js";

/**
 * Branding → Host EIP-1193 notifications (fire-and-forget Postmate emit).
 * Failures are logged and never thrown into wallet UX.
 */
export class Eip1193EventChildClient {
  private readonly childApi: Postmate.ChildAPI;

  constructor(childApi: Postmate.ChildAPI) {
    this.childApi = childApi;
  }

  emit(event: string, ...params: unknown[]): void {
    const payload: IOWSEip1193EventNotification = { event, params };
    try {
      this.childApi.emit(OWS_EIP1193_EVENT, serializeRpc(payload));
    } catch (error) {
      debugLog("eip1193 event emit failed", {
        event,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}
