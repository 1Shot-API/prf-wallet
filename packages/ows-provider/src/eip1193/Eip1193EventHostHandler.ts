import {
  OWS_EIP1193_EVENT,
  deserializeEip1193EventNotification,
} from "@1shotapi/ows-types";
import type Postmate from "postmate";
import type { EIP1193Provider } from "./EIP1193Provider.js";

/**
 * Host-side delivery for Branding→Host `ows:eip1193` notifications.
 * Forwards into {@link EIP1193Provider} listeners (`chainChanged`, …).
 */
export class Eip1193EventHostHandler {
  private destroyed = false;

  constructor(
    parent: Postmate.ParentAPI,
    private readonly provider: EIP1193Provider,
  ) {
    parent.on(OWS_EIP1193_EVENT, (data: unknown) => {
      this.handleNotification(data);
    });
  }

  destroy(): void {
    this.destroyed = true;
  }

  private handleNotification(data: unknown): void {
    if (this.destroyed) {
      return;
    }

    let notification;
    try {
      notification = deserializeEip1193EventNotification(data);
    } catch {
      return;
    }

    this.provider.emit(notification.event, ...notification.params);
  }
}
