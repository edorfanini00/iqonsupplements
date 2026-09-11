# Skincare macro comparison — v9

Replaces the repeated full-face portrait with four Higgsfield-generated skin pairs: a terracotta-framed macro skin patch, fair cheek, warm-toned cheek, and eye-area detail. Eight optimized WebP images are bundled in the repo; the comparison and its thumbnail both composite the actual corresponding pair. Each thumbnail changes the image, headline, description and linked product, and resets the reveal to 50%.

The supplied 13:46 reference drives the desktop geometry: approximately 620px square viewer, 80px thumbnail rail, 146px gap and 584px copy column at a 1776px viewport. Removed inherited section padding that shrank the earlier viewer and stopped the gallery rows stretching vertically. Kept the centered drag handle, product tag, dotted rules and two-column supporting copy. Below 760px, the viewer spans the content width and the thumbnails become a horizontal row.

These images are explicitly labeled AI-generated illustrations, not clinical photographs or IQON results. The headline and supporting cells describe skin features rather than borrowing Timeline’s study percentages. The existing development/Vercel preview gate remains intact; approved IQON evidence takes priority when present. No changes to reviews, other page sections or production evidence approval.

Image provenance and processing are recorded in creative/skincare-macro-v9.json. Synthetic pairs have approximate anatomical alignment and should not be used as documentation of treatment results.

Validation: all eight images decoded successfully; all 14 existing tests passed, including the updated synthetic-image disclosure and production-gating regression. Managed production build passed. Vercel/Next.js production build and TypeScript validation passed.
