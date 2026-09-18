/** Exact nine-method boundary, shared by relay and unchanged form helpers. */
export function nonproviderTarget(path:string,method:string):string|null {
 const fixed:Record<string,string>={'POST /api/affiliates/admin/app':'app','POST /api/affiliates/tiktok':'tiktok','PATCH /api/affiliates/admin/tiktok':'tiktok-settings','PATCH /api/affiliates/admin/rankings':'rankings'};
 const target=fixed[method+' '+path];if(target)return '/api/integrations/body/native/nonprovider/'+target;
 if(method==='DELETE'){
  const m=/^\/api\/affiliates\/admin\/(messages|notes|affiliates|commissions|tiktok)\/([A-Za-z0-9_-]{1,100})$/.exec(path);
  if(m)return '/api/integrations/body/native/nonprovider/'+m[1]+'/'+m[2];
 }
 return null;
}
