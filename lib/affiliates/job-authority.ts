/** Supplements never owns shared jobs. No env toggle can enable duplicate writes. */
export function sharedJobAuthorityGuard(): Response | null {
  return Response.json({ok:false,error:'This job is owned by IQON Health'}, {status:410,headers:{'cache-control':'no-store'}});
}
