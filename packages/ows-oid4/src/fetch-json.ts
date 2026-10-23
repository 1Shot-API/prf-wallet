export type FetchLike = typeof fetch;

/**
 * Fetch helpers for OID4 HTTP clients (JSON / form POST with clear HTTP errors).
 */
export interface IFetchUtils {
  fetchJson<T>(url: string, init?: RequestInit): Promise<T>;
  fetchFormJson<T>(
    url: string,
    fields: Record<string, string>,
  ): Promise<T>;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/**
 * Default {@link IFetchUtils} backed by global `fetch` (or a test double).
 */
export class FetchUtils implements IFetchUtils {
  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    // Do not store unbound `window.fetch` — calling it later throws Illegal invocation.
    this.fetchImpl =
      fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  /** Fetch JSON with a clear error when the response is not OK. */
  public async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(url, init);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status} ${response.statusText} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`,
      );
    }
    return (await response.json()) as T;
  }

  /** POST form-urlencoded body (OID4VCI token endpoint). */
  public async fetchFormJson<T>(
    url: string,
    fields: Record<string, string>,
  ): Promise<T> {
    const body = new URLSearchParams(fields);
    return this.fetchJson<T>(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  /** Raw fetch using the configured implementation. */
  public async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return this.fetchImpl(input, init);
  }
}
