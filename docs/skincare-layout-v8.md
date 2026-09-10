# Skincare comparison and review layouts — v8

The supplied 13:07 and 13:08 screenshots define this revision. Both requested sections are now visible on the existing skincare page in development and Vercel draft previews. Production continues to require actual IQON content.

## Reviews

An edge-to-edge horizontal rail alternates 232px media cards and 282px cream quote cards, with 22px gaps, 346px media height, 34px serif quotes, small author/verification text inside the quote panel, square overlay arrows and a centered Read all reviews button. Phone cards use 68vw, 330px panels and 30px serif type; the arrows move below the rail. All cards remain accessible through scrolling and directional controls. Ratings use proportional star fills. Genuine video media retains native playback controls.

The draft rail has eight clearly labeled sample cards using existing IQON brand photographs and brand copy. These are not testimonials: no customer names, verification badges, clinical statements or fake video controls are present. The real customerReviews dataset remains empty and unchanged.

## Comparison

A large square comparison viewer sits beside four vertical thumbnails and a results column. The column uses a large sans-serif headline, dotted dividers and four measurement positions. The viewer has Before/After labels, an accessible draggable slider and a linked product tag. On phone, thumbnails run horizontally and results follow underneath.

The draft comparison is explicitly labeled as a layout sample with identical photographs on both sides. There is no generated transformation. Measurements are em dashes and the missing study data is stated. sampleSkinResults cannot pass the approval/consent filter and is stored separately from approved evidence.

## Publication boundary

The server enables layout samples only for NODE_ENV=development or VERCEL_ENV=preview. The default production render hides the unpopulated comparison and uses the existing pending-review state. When genuine results or reviews are supplied, those records take precedence over samples, including on previews.

## Validation

Reviewed the comparison and carousel at desktop and 345px/375px phone content widths. No page overflow or broken images. Keyboard End moved the comparison to 100; choosing another thumbnail reset it to 50 and updated selection. Carousel navigation moved the rail. A regression verifies sample labeling and absence from default public rendering. The temporary responsive QA harness was removed before the final build.

Next.js preview and managed Sites production builds passed. All 14 tests passed. Worker-rendered checks verified that production hides all sample ratings/comparisons, Vercel preview shows both sections and eight labeled cards, related shopping/review routes respond, and the QA harness returns 404. The standalone TypeScript invocation reports existing Cloudflare ambient-type errors; the Next.js production type-check passed.
