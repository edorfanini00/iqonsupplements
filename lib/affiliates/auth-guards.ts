/**
 * Auth guard helpers for affiliates API routes.
 * Server-only.
 */

import {
  getAffiliateSession,
  getLightSession,
  type AffiliateSession,
} from "@/lib/affiliates/session";
import { apiError } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";
import type { NextResponse } from "next/server";

const DB_UNAVAILABLE_MESSAGE = "The affiliate portal is temporarily unavailable. Please try again later.";

async function loadAffiliateSession(): Promise<AffiliateSession | null> {
  try {
    return await getAffiliateSession();
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      throw Object.assign(new Error(DB_UNAVAILABLE_MESSAGE), {
        code: "SERVICE_UNAVAILABLE",
      });
    }
    throw err;
  }
}

export async function requireAffiliateSession(): Promise<
  AffiliateSession | NextResponse
> {
  let session: AffiliateSession | null;
  try {
    session = await loadAffiliateSession();
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { code?: string }).code === "SERVICE_UNAVAILABLE"
    ) {
      return apiError("SERVICE_UNAVAILABLE", err.message, 503);
    }
    throw err;
  }
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  if (session.role !== "affiliate" && session.role !== "admin") {
    return apiError("FORBIDDEN", "Forbidden", 403);
  }
  if (!session.profile && session.role === "affiliate") {
    return apiError("FORBIDDEN", "Affiliate profile not found.", 403);
  }
  return session;
}

export async function requireShopManagerSession(): Promise<
  AffiliateSession | NextResponse
> {
  let session: AffiliateSession | null;
  try {
    session = await loadAffiliateSession();
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { code?: string }).code === "SERVICE_UNAVAILABLE"
    ) {
      return apiError("SERVICE_UNAVAILABLE", err.message, 503);
    }
    throw err;
  }
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  if (session.role !== "shop_manager") {
    return apiError("FORBIDDEN", "Forbidden", 403);
  }
  return session;
}

export async function requireAdminSession(): Promise<AffiliateSession | NextResponse> {
  let session: AffiliateSession | null;
  try {
    session = await loadAffiliateSession();
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { code?: string }).code === "SERVICE_UNAVAILABLE"
    ) {
      return apiError("SERVICE_UNAVAILABLE", err.message, 503);
    }
    throw err;
  }
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  if (session.role !== "admin") {
    return apiError("FORBIDDEN", "Forbidden", 403);
  }
  return session;
}

export async function requireAffiliateOnlySession(): Promise<
  AffiliateSession | NextResponse
> {
  let session: AffiliateSession | null;
  try {
    session = await loadAffiliateSession();
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { code?: string }).code === "SERVICE_UNAVAILABLE"
    ) {
      return apiError("SERVICE_UNAVAILABLE", err.message, 503);
    }
    throw err;
  }
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  if (session.role !== "affiliate" || !session.profile) {
    return apiError("FORBIDDEN", "Forbidden", 403);
  }
  if (session.profile.status !== "active") {
    return apiError("FORBIDDEN", "Account is not active.", 403);
  }
  return session;
}

/**
 * Authorize an active affiliate for a high-frequency endpoint (badge/poll) using
 * only the signed snapshot cookie — no DB query. Falls back to the full session
 * (one DB lookup) for older cookies issued before the profileId was cached.
 * Returns the affiliate's profile id.
 */
export async function requireAffiliateBadgeSession(): Promise<
  { profileId: string } | NextResponse
> {
  const light = await getLightSession();
  if (light) {
    if (light.role !== "affiliate" || !light.profileId) {
      // Admins (or incomplete snapshots) fall through to the full check below.
    } else if (light.status === "active") {
      return { profileId: light.profileId };
    } else if (light.status) {
      return apiError("FORBIDDEN", "Account is not active.", 403);
    }
  }

  const session = await requireAffiliateOnlySession();
  if (isNextResponse(session)) return session;
  return { profileId: session.profile!.id };
}

/**
 * Authorize an admin for a high-frequency endpoint using only the signed
 * snapshot cookie — no DB query. Falls back to the full admin session for older
 * cookies.
 */
export async function requireAdminBadgeSession(): Promise<true | NextResponse> {
  const light = await getLightSession();
  if (light?.role === "admin") return true;

  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;
  return true;
}

export function isNextResponse(value: unknown): value is NextResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as NextResponse).json === "function"
  );
}

export function sessionProfileId(session: AffiliateSession): string {
  return session.profile?.id ?? String(session.portalUserId);
}
