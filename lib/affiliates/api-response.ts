/**
 * Normalized API responses for affiliates routes.
 */

import { NextResponse } from "next/server";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiSuccessBody<T = unknown> {
  ok: true;
  data?: T;
  [key: string]: unknown;
}

export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  init?: ResponseInit
): NextResponse {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function apiError(
  code: string,
  message: string,
  status = 400
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      errorDetail: { code, message },
    },
    { status }
  );
}
