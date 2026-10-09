/** Client-side JSON requests with one error shape for network, HTTP and parse failures. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new HttpError("network", 0, "network");
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: string } })
    | null;
  if (!res.ok) {
    throw new HttpError(data?.error?.message ?? res.statusText ?? "request_failed", res.status, data?.error?.code);
  }
  return (data ?? {}) as T;
}

export function jsonInit(method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): RequestInit {
  return {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
