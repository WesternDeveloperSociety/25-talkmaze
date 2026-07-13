import { NextRequest, NextResponse } from "next/server";
import { nextCookies } from "@tests/helpers/nextHeadersMock";

type RouteHandler = (
  req: NextRequest,
  // Route handlers declare their own `params` shape (e.g. Promise<{ courseId:
  // string }>), which is narrower than Record<string, string> and would make
  // every typed handler unassignable here. `any` keeps them assignable; the
  // runtime value is always the Record<string, string> from CallOptions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { params: Promise<any> },
) => Promise<NextResponse> | NextResponse;

interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * Multipart form body. When provided, `body` is ignored and Content-Type is
   * set by FormData itself (with its multipart boundary). Use this for routes
   * that read via `request.formData()` (e.g. file uploads).
   */
  formData?: FormData;
  /** URL path params e.g. { id: "abc" } for a [id] segment. */
  params?: Record<string, string>;
  /** Raw Cookie header string from signSessionFor(). */
  cookies?: string;
  /** Query string params appended to the URL. */
  query?: Record<string, string>;
}

interface CallResult {
  status: number;
  json: <T = unknown>() => Promise<T>;
  headers: Headers;
}

/**
 * Call a Next.js App Router route handler directly — no HTTP server required.
 * Sets the next/headers cookie context before each call so that route handlers
 * that call createClient() (which reads cookies()) see the right session.
 *
 * Usage:
 *   const res = await call(GET, { cookies: session, query: { id: "1" } });
 *   expect(res.status).toBe(200);
 *   const body = await res.json();
 */
export async function call(
  handler: RouteHandler,
  opts: CallOptions = {},
): Promise<CallResult> {
  const { method = "GET", body, formData, params = {}, cookies, query } = opts;

  // Wire up the cookie context so next/headers cookies() reads the right session.
  nextCookies.header = cookies ?? "";

  const url = new URL("http://localhost:3000/test");
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {};
  if (formData === undefined && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (cookies) headers["Cookie"] = cookies;

  // FormData wins when both are present; it carries its own multipart boundary
  // via the underlying Request, so we don't set Content-Type ourselves.
  const requestBody: BodyInit | undefined = formData
    ? formData
    : body !== undefined
      ? JSON.stringify(body)
      : undefined;

  const req = new NextRequest(url, {
    method,
    body: requestBody,
    headers,
  });

  const response = await handler(req, {
    params: Promise.resolve(params),
  });

  return {
    status: response.status,
    json: <T>() => response.json() as Promise<T>,
    headers: response.headers,
  };
}
