/**
 * @typedef {(event: string, correlationId: string | undefined, data: Record<string, unknown>) => void} EmitFn
 */

/**
 * @param {Window} target
 * @param {string} targetOrigin
 * @param {string} event
 * @param {string | undefined} correlationId
 * @param {Record<string, unknown>} data
 */
export function emitEvent(target, targetOrigin, event, correlationId, data) {
  target.postMessage(
    {
      v: 1,
      kind: "event",
      event,
      correlationId,
      data,
    },
    targetOrigin,
  );
}

/**
 * @param {MessageEvent} event
 * @returns {boolean}
 */
export function isValidParentMessage(event) {
  if (event.source !== window.parent) return false;
  if (window.parent === window.top) return false;
  if (event.source === window) return false;
  return true;
}

/**
 * @param {unknown} data
 * @returns {data is { v: number, kind: 'request', method: string, correlationId?: string, params?: Record<string, unknown> }}
 */
export function parseRequest(data) {
  if (!data || typeof data !== "object") return false;
  const msg = /** @type {Record<string, unknown>} */ (data);
  return (
    msg.v === 1 &&
    msg.kind === "request" &&
    typeof msg.method === "string"
  );
}
