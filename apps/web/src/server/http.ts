import { NextResponse } from 'next/server';
import { ZodError, type z, type ZodTypeAny } from 'zod';

/**
 * Thin HTTP helpers for the route handlers. Keeps every endpoint to its happy
 * path: parse → call the domain → respond, with a single place that turns
 * validation and domain errors into clean status codes.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

/** Parse + validate a JSON body, throwing a ZodError that `withErrors` maps. */
export async function readJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'invalid JSON body');
  }
  return schema.parse(raw);
}

/**
 * Wrap a handler so thrown errors become responses:
 *  - ZodError        → 422 with field details
 *  - HttpError       → its status + message
 *  - anything else   → 500 (logged)
 */
export function withErrors<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail(422, 'validation_error', { details: err.flatten() });
      }
      if (err instanceof HttpError) {
        return fail(err.status, err.message);
      }
      console.error('[api] unhandled error:', err);
      return fail(500, 'internal_error');
    }
  };
}
