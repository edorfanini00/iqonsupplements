// Extend the existing synthetic catalog boundary; never contact real commerce services.
await import('../seo/fake-shopify-hook.mjs');
const fixtureFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const response = await fixtureFetch(input, init);
  if (!String(init?.body || '').includes('IQONCatalog')) return response;
  const data = await response.clone().json();
  const products = data.data?.products?.nodes;
  if (!products) return response;
  products.find(p => p.handle === 'colostrum-powder').variants.nodes[0].title = '69 g';
  const creatine = products.find(p => p.handle === 'creatine-monohydrate');
  creatine.variants.nodes[0].title = '300 g';
  creatine.variants.nodes.push({...creatine.variants.nodes[0], id: 'gid://shopify/ProductVariant/101', title: '600 g'});
  products.find(p => p.handle === 'nmn').variants.nodes[0].title = '60 capsules';
  const generic = products.find(p => p.handle === 'daily-travel-kit');
  for (const [handle, available, multiple] of [
    ['generic-sized', true, false], ['generic-unavailable', false, false], ['generic-variants', true, true],
  ]) {
    const product = structuredClone(generic);
    product.handle = handle;
    product.title = `Synthetic ${handle}`;
    product.availableForSale = available;
    product.variants.nodes[0].title = 'Travel size';
    product.variants.nodes[0].availableForSale = available;
    if (multiple) product.variants.nodes.push({...product.variants.nodes[0], id: 'gid://shopify/ProductVariant/102', title: 'Large size'});
    products.push(product);
  }
  return Response.json(data);
};
