/** Exact source-bound marketing methods. Never a prefix/provider proxy. */
export function nativeProviderTarget(path:string,method:string):string|null {
 if(method==='POST'&&path==='/api/affiliates/admin/test-email')return '/api/integrations/body/native/test-email';
 if(method==='POST'&&path==='/api/affiliates/admin/customers/email')return '/api/integrations/body/native/customers/email';
 if(method==='POST'&&path==='/api/affiliates/admin/woocommerce-sync')return '/api/integrations/body/native/woocommerce-sync';
 if(method==='POST'&&path==='/api/affiliates/admin/portal-commerce-sync')return '/api/integrations/body/native/portal-commerce-sync';
 const subscription=method==='POST'?/^\/api\/affiliates\/admin\/subscriptions\/([A-Za-z0-9_-]{1,100})$/.exec(path):null;
 if(subscription)return '/api/integrations/body/native/subscriptions/'+subscription[1];
 const order=/^\/api\/affiliates\/admin\/orders\/([1-9]\d*)\/(attribute|refund)$/.exec(path);
 if(order&&((order[2]==='attribute'&&['POST','DELETE'].includes(method))||(order[2]==='refund'&&method==='POST')))return '/api/integrations/body/native/orders/'+order[1]+'/'+order[2];
 const base='/api/affiliates/admin/marketing/campaigns';
 if(path===base&&method==='POST')return '/api/integrations/body/native/marketing/campaigns';
 const match=/^\/api\/affiliates\/admin\/marketing\/campaigns\/([A-Za-z0-9_-]{1,100})(\/run)?$/.exec(path);
 if(match&&((!match[2]&&['PATCH','DELETE'].includes(method))||(match[2]&&method==='POST')))return '/api/integrations/body/native/marketing/campaigns/'+match[1]+(match[2]??'');
 return null;
}
