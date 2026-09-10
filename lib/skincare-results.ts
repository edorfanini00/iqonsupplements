export type SkinResult = {
  id: string;
  productId: string;
  label: string;
  before: { src: string; alt: string };
  after: { src: string; alt: string };
  headline: string;
  timeframe: string;
  methodology: string;
  source: { label: string; url: string };
  metrics: { value: string; description: string }[];
  approvedForPublication: boolean;
  photographyConsentConfirmed: boolean;
};

// Add only permissioned photographs and substantiated results for the actual IQON product.
// Competitor results, synthetic transformations and illustrative percentages do not belong here.
export const skincareResults: SkinResult[] = [];

export const approvedSkincareResults = skincareResults.filter(result =>
  result.approvedForPublication && result.photographyConsentConfirmed &&
  result.before.src && result.after.src && result.source.url && result.methodology
);
