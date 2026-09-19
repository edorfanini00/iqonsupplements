"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Sparkles,
  ShieldCheck,
  FlaskConical,
  Microscope,
  Repeat,
  Search,
  ChevronRight,
  BadgeCheck,
  Beaker,
  HeartPulse,
  Brain,
  Dna,
  Flame,
  Droplets,
  Zap,
  Lightbulb,
  MessageCircle,
  AlertTriangle,
  Target,
  CheckCircle2,
  Lock,
  RotateCcw,
  ClipboardCheck,
  Megaphone,
  Mountain,
  XCircle,
  ArrowRight,
  Syringe,
  Ruler,
  Snowflake,
} from "lucide-react";
import { PageHeader } from "@/components/affiliates/shared/ui";

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */

type ModuleKey =
  | "start"
  | "edge"
  | "library"
  | "recon"
  | "sell"
  | "social"
  | "rules"
  | "guide";

/** Modules an affiliate must complete to finish the course (unlocks the guide). */
const COURSE_MODULES: Exclude<ModuleKey, "start" | "guide" | "recon">[] = [
  "edge",
  "library",
  "sell",
  "social",
  "rules",
];

const MODULES: {
  key: ModuleKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "start", label: "Start here", icon: Sparkles },
  { key: "edge", label: "The IQON edge", icon: ShieldCheck },
  { key: "library", label: "Peptide library", icon: FlaskConical },
  { key: "recon", label: "Reconstitution", icon: Syringe },
  { key: "sell", label: "How to sell", icon: MessageCircle },
  { key: "social", label: "Content & socials", icon: Megaphone },
  { key: "rules", label: "Play it safe", icon: AlertTriangle },
];

const STORAGE_KEY = "iqon_affiliate_learn_progress_v1";

/* ------------------------------------------------------------------ */
/* Content: course                                                     */
/* ------------------------------------------------------------------ */

const KEY_NUMBERS = [
  { value: ">99%", label: "Purity by HPLC" },
  { value: "100%", label: "Batches third-party tested" },
  { value: "10%", label: "Subscribe & Save discount" },
  { value: "cGMP", label: "Manufacturing standard" },
];

const EDGE_POINTS: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tldr: string;
  body: string;
}[] = [
  {
    icon: Microscope,
    title: "Proof, not promises",
    tldr: "Every product has a public COA — skeptics can look it up themselves.",
    body: "Every compound has a Certificate of Analysis (COA), and we publish all of our product COAs on our website. Identity and purity are confirmed by HPLC and mass spectrometry, the same analytics used to set international reference methods. If someone is skeptical about purity or asks 'how do I know it's real?', let them know we have COAs for all our products on the website, they don't need to take your word for it.",
  },
  {
    icon: ShieldCheck,
    title: "Swiss-standard rigor",
    tldr: "Swissmedic-grade, cGMP, audited — not someone's back room.",
    body: "Our manufacturing partners operate to Swissmedic-grade documentation and cGMP standards. Every batch is made under strict, audited process controls, not in someone's back room.",
  },
  {
    icon: Droplets,
    title: "Built clean from step one",
    tldr: "Pharma-grade inputs, nitrogen-sealed, cold-chain to the door.",
    body: "Pharmaceutical-grade water, solvents, and reagents. Peptides are lyophilized, nitrogen-sealed, and cold-chain handled so they stay stable from synthesis to the customer's door.",
  },
  {
    icon: BadgeCheck,
    title: "Made in the USA, verified",
    tldr: "Fast, tracked shipping — reliability drives reorders.",
    body: "100% U.S. verified, fast shipping with tracking on every order. Reliability is a feature: reorders come from people who got exactly what they expected.",
  },
];

const SOURCING_POINTS: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tldr: string;
  body: string;
}[] = [
  {
    icon: Mountain,
    title: "Why Switzerland",
    tldr: "The world's benchmark for pharma precision — home of Roche and Novartis.",
    body: "Switzerland is the world's benchmark for pharmaceutical precision. Basel alone gave rise to Roche and Novartis and sits beside research powerhouses like ETH Zürich and EPFL. That mix of heritage, expertise, and supply chains took over a century to build and can't be copied overnight.",
  },
  {
    icon: ShieldCheck,
    title: "What that means for you",
    tldr: "Your answer to 'where is this made?' — the strictest reputation in medicine.",
    body: "It's your answer to 'where is this made?'. We hold our compounding and verification to that Swiss standard, so you're not selling a random vial. You're selling a place with the strictest reputation in medicine behind it.",
  },
];

type Category =
  | "Metabolic"
  | "Recovery"
  | "Longevity"
  | "Cognitive"
  | "Beauty"
  | "Growth Hormone"
  | "Essentials";

const CATEGORY_META: Record<
  Category,
  { icon: React.ComponentType<{ className?: string }> }
> = {
  Metabolic: { icon: Flame },
  Recovery: { icon: HeartPulse },
  Longevity: { icon: Dna },
  Cognitive: { icon: Brain },
  Beauty: { icon: Sparkles },
  "Growth Hormone": { icon: Zap },
  Essentials: { icon: Beaker },
};

/**
 * The four desires the audience actually buys. Glow and Optimize are the
 * safest, most repeatable lanes; Recover and Lean convert hardest but need the
 * tightest phrasing discipline.
 */
type Desire = "Glow" | "Recover" | "Lean" | "Optimize" | "Essential";

/**
 * Content risk level. "safe" = compliant lane to lean into; "care" = fine to
 * discuss at the science/mechanism level only; "high" = highest ban risk,
 * mechanism talk only, never protocols or drug-brand comparisons.
 */
type Risk = "safe" | "care" | "high";

interface SellAngle {
  /** The name of the angle. */
  title: string;
  /** The on-camera hook line to open with. */
  hook: string;
  /** Who it's for and why it lands, in plain terms. */
  detail: string;
}

interface Peptide {
  name: string;
  aka?: string;
  category: Category;
  desire: Desire;
  risk: Risk;
  /** How people search for it, plus nicknames. */
  searchedAs: string;
  /** Plain-English explanation for someone who has never heard of it. */
  whatItIs: string;
  /** The real mechanism in plain English, the "say this" line for camera. */
  howItWorks?: string;
  /** Compliant, education-first framing of what it's studied for. */
  researchedFor: string;
  /** Who is really buying and the desire underneath it. */
  whoBuys?: string;
  /** Multiple selling angles to rotate through. */
  angles: SellAngle[];
  /** Folk / community uses that quietly drive sales. Report, never promise. */
  whatPeopleSay?: string;
  /** Phrasing that keeps the account alive. */
  compliantLine: string;
}

const PEPTIDES: Peptide[] = [
  {
    name: "GHK-Cu",
    aka: "Copper peptide",
    category: "Beauty",
    desire: "Glow",
    risk: "safe",
    searchedAs: "copper peptide, GHK-Cu, 'blue serum', copper tripeptide-1",
    whatItIs:
      "A 'copper peptide': three amino acids clamped onto a single copper atom. Your body makes it naturally and makes less of it with age. In skincare it's the blue-tinted 'copper serum' everyone's talking about.",
    howItWorks:
      "Think of it as a copper delivery truck. Your skin's collagen-making cells need copper to run the enzyme that locks fresh collagen into place. GHK-Cu drives copper straight into those cells, tells them to pump out new collagen and elastin, and at the same time slows the demolition enzymes that chew up old collagen. So it does two things at once: it builds new scaffolding while protecting the good scaffolding you still have, and it nudges thousands of genes toward a 'younger skin' pattern. That dual action is why it out-performed retinol on collagen in a head-to-head.",
    researchedFor:
      "Collagen and firmness, skin repair, evening skin tone, and increasingly hair.",
    whoBuys:
      "25 to 55, already done retinol and vitamin C, and want the next-level anti-aging thing. They're buying glow, firmness, and looking like they don't age.",
    angles: [
      {
        title: "It beat retinol in a head-to-head",
        hook: "Your retinol and your vitamin C both lost to this in a real study.",
        detail: "In a 12-week study copper peptide raised collagen in 70% of women, versus 50% for vitamin C and 40% for retinoic acid. Aim it at the buyer who thinks retinol is the ceiling: a concrete number plus the 'you're using the losers' twist.",
      },
      {
        title: "You're refilling what age drained",
        hook: "Your skin made tons of this at 20. By 40 you've lost most of it.",
        detail: "For the 'clean and natural, not chemicals' buyer. It reframes a product as restoring your own biology instead of adding something foreign.",
      },
      {
        title: "The molecule that talks to 4,000 genes",
        hook: "This one ingredient signals over 4,000 of your genes. Retinol talks to a handful.",
        detail: "For the science-curious. A jaw-drop text-on-screen stat.",
      },
      {
        title: "Isolated from young blood in 1973",
        hook: "In 1973 a scientist saw young people's blood make old skin act young. This was the molecule.",
        detail: "For the skincare-lore audience. A cinematic 30-second story.",
      },
    ],
    whatPeopleSay:
      "Users report thicker hair and regrowth, plus fading of scars and post-breakout marks. Phrase it as 'people are also using it for hair and scars,' never as a promise.",
    compliantLine:
      "'Supports skin firmness and radiance.' Never 'erases wrinkles in 14 days' or 'treats [condition].'",
  },
  {
    name: "GLOW",
    aka: "GHK-Cu + BPC-157 + TB-500",
    category: "Beauty",
    desire: "Glow",
    risk: "safe",
    searchedAs: "GLOW peptide, glass skin protocol",
    whatItIs:
      "A named blend that pairs the glow peptide with the two recovery peptides, so one product does skin and bounce-back at once. Named routines sell because they feel complete and giftable.",
    howItWorks:
      "It's a team, not a single player, and each peptide has a different job. GHK-Cu rebuilds collagen (the glow). BPC-157 re-opens blood flow so nutrients and repair reach the tissue. TB-500 moves the repair cells to where the work is. Say it as: 'GHK-Cu does the glow, BPC and TB do the recovery.' One shot, several signals working the same goal from different angles.",
    researchedFor: "Radiance and firmness, plus tissue recovery.",
    whoBuys:
      "People who want a named routine, not a lonely ingredient. It feels complete, and it's easy to gift.",
    angles: [
      {
        title: "Glow while you recover",
        hook: "Your serum makes your skin glow. This makes your skin glow while your body recovers.",
        detail: "Most beauty products only sit on the skin; GLOW folds in the recovery peptides too. Aim it at the beauty buyer who also trains or is always a bit sore. It beats every skin-only competitor, so lead here.",
      },
      {
        title: "Which one are you, GLOW or KLOW?",
        hook: "Two blends, one question: do you also want the calm layer?",
        detail: "GLOW is glow plus recovery; KLOW adds the calming layer for reactive skin or a sensitive gut. Great for undecided shoppers because the question funnels straight to a purchase.",
      },
      {
        title: "The gift that isn't a candle",
        hook: "Skincare gift that actually does something: glow they'll see in the mirror.",
        detail: "For gift-buyers around the holidays, Valentine's, and Mother's Day. Named kits feel premium and lift order value.",
      },
    ],
    whatPeopleSay:
      "People report 'glass skin,' faster post-workout recovery, and calmer, less-reactive skin. Report the trend, don't promise the result.",
    compliantLine:
      "'A glow-and-recovery routine people are talking about.' No skin-lightening, healing, or treatment claims.",
  },
  {
    name: "KLOW",
    aka: "GLOW + KPV",
    category: "Beauty",
    desire: "Glow",
    risk: "safe",
    searchedAs: "KLOW, KLOW peptide blend",
    whatItIs:
      "The GLOW blend plus KPV: the do-it-all upgrade. It's glow plus recovery plus a calming layer in one.",
    howItWorks:
      "Everything GLOW does, plus KPV, a tiny fragment of your body's natural calming hormone, which turns down the inflammation signal so skin and gut run calmer. Say it as: 'GHK-Cu does the glow, BPC and TB do the recovery, and the K (KPV) does the calm.'",
    researchedFor:
      "Radiance and recovery, plus KPV's calming and skin/gut pathways.",
    whoBuys:
      "GLOW fans who want the premium, do-everything option, especially people with reactive skin or a sensitive gut.",
    angles: [
      {
        title: "What does the K in KLOW add?",
        hook: "Everyone asks what the K is. It's KPV, the calm-and-soothe upgrade on top of GLOW.",
        detail: "KPV is a fragment of your body's natural calming hormone (alpha-MSH), the turn-down-inflammation layer for gut and skin. A clean explainer that upsells GLOW into KLOW.",
      },
      {
        title: "The reason KLOW beats GLOW",
        hook: "GLOW is great. KLOW adds the calm-and-soothe layer, and that's the whole upgrade.",
        detail: "For existing GLOW buyers. It powers the upsell.",
      },
    ],
    whatPeopleSay:
      "People report calmer, less-reactive skin and a calmer gut alongside the glow. Report the trend, don't promise it.",
    compliantLine:
      "'The upgraded glow, recovery, and calm blend people ask about.' No treatment claims.",
  },
  {
    name: "KPV",
    aka: "The K in KLOW",
    category: "Recovery",
    desire: "Recover",
    risk: "care",
    searchedAs: "KPV, KPV peptide, the K in KLOW",
    whatItIs:
      "A tiny three-amino-acid peptide, the business end of your body's natural calming hormone (alpha-MSH). It keeps the 'turn down inflammation' action without touching your hormones. It's also the K in KLOW.",
    howItWorks:
      "Most anti-inflammatories work from the outside; KPV gets inside the cell and quiets NF-kB, the master switch that turns inflammation on, so it dials down the inflammatory messengers at the source instead of after the fact. Because that same switch runs in both your gut lining and your skin, one tiny peptide is discussed for a calmer gut and calmer, less-reactive skin, and because it's just a fragment it does this without moving your hormones. Say it as: 'it's a dimmer switch for inflammation, and it works from inside the cell where the switch actually is.'",
    researchedFor:
      "Calming inflammation, gut-lining research, and skin pathways, often paired with BPC-157 for 'repair plus calm.'",
    whoBuys:
      "The gut-health and sensitive or reactive-skin crowds, and KLOW buyers who want the upgrade.",
    angles: [
      {
        title: "The inflammation dimmer switch",
        hook: "Think of it as a dimmer switch for the inflammation your gut and skin throw off, and it works from inside the cell.",
        detail: "A concrete mental image the 'everything flares up' buyer can repeat.",
      },
      {
        title: "Gut and skin, one little peptide",
        hook: "The same tiny peptide people talk about for a calmer gut AND calmer skin.",
        detail: "Two audiences from one video, so it doubles your market.",
      },
      {
        title: "The reason KLOW beats GLOW",
        hook: "GLOW is great. KLOW adds this, the calm-and-soothe layer, and that's the whole upgrade.",
        detail: "For existing GLOW buyers. It powers the upsell.",
      },
    ],
    whatPeopleSay:
      "People report a calmer gut and less red, less reactive skin. Community experience, not a claim.",
    compliantLine:
      "'An anti-inflammatory-pathway research peptide people pair for gut and skin.' No treatment claims for IBD or colitis.",
  },
  {
    name: "Glutathione",
    aka: "Master antioxidant",
    category: "Longevity",
    desire: "Glow",
    risk: "safe",
    searchedAs: "glutathione, master antioxidant, glow, detox",
    whatItIs:
      "Your body's 'master antioxidant': a three-amino-acid molecule your cells use to clean up damage and your liver leans on to clear toxins.",
    howItWorks:
      "It's your body's built-in cleanup and recycling crew. Free radicals from stress, sun, pollution, and alcohol damage cells; glutathione neutralizes them, and it even recharges other antioxidants like vitamin C so they keep working. It's also the workhorse of your liver's detox: it grabs toxins and tags them for removal, including acetaldehyde, the byproduct of alcohol that drives the flushing and the rough next morning. That acetaldehyde link is exactly why the 'before a night out' crowd swears by it. On skin, damping that oxidative load is what's tied to a brighter, more even tone. Say it as: 'it's the mop your cells already use, and you make less of it under stress, age, and alcohol.'",
    researchedFor:
      "Antioxidant support, liver and detox support, and skin brightening or even tone.",
    whoBuys:
      "The glow and beauty crowd for brightening, the wellness crowd for detox and antioxidants, and a huge 'night out' crowd.",
    angles: [
      {
        title: "The 'before a night out' secret",
        hook: "People are taking this BEFORE drinks, not after. Here's why they swear by it.",
        detail: "People take it before drinking because they say it helps clear acetaldehyde, the toxin behind the rough morning. A massive, non-obvious audience, and it's relatable and shareable. Phrase it as 'people swear by it,' never 'cures hangovers.'",
      },
      {
        title: "The antioxidant your body already runs on",
        hook: "Your body's number-one antioxidant, and you're just making less than you used to.",
        detail: "For the wellness and longevity buyer. Familiar, credible, low skepticism.",
      },
      {
        title: "The K-beauty brightening secret",
        hook: "The reason your favorite K-beauty routine glows? This is usually in it.",
        detail: "Paired with vitamin C it's a staple in even, glowy skin routines. Ties to an aesthetic the buyer already chases.",
      },
      {
        title: "Attach Hospira water, not BAC water",
        hook: "Glutathione is the one you don't reconstitute with regular bacteriostatic water.",
        detail: "Most peptides reconstitute fine with bacteriostatic water, but glutathione is different. It's a delicate antioxidant with a reactive thiol group, and the benzyl alcohol preservative in BAC water can interact with it and speed its breakdown, so it's prepared with preservative-free sterile water for injection (Hospira). It's also used in larger volumes where a preservative-free diluent is preferred. So the attach-sale for glutathione is Hospira sterile water, the same way BAC water attaches to the others. Getting this right is also a trust signal: it shows you actually know the products.",
      },
    ],
    whatPeopleSay:
      "By far the biggest word-of-mouth driver is the 'take it before drinking, bounce back faster' angle, plus brighter, more even skin. Report the trend, don't promise the result.",
    compliantLine:
      "'Antioxidant support', kept to topical or oral framing. Avoid skin-lightening treatment claims and never say 'cures hangovers.'",
  },
  {
    name: "BPC-157",
    aka: "Body Protection Compound",
    category: "Recovery",
    desire: "Recover",
    risk: "care",
    searchedAs: "BPC-157, 'body protection compound', Wolverine (with TB-500)",
    whatItIs:
      "The 'Body Protection Compound,' originally isolated from a protein in stomach juice, which is why it's tied to both gut and tissue repair. It's the compound that started the whole niche, with Joe Rogan as the demand engine.",
    howItWorks:
      "Think plumbing and supply lines. Its signature move is growing new blood vessels into an area that's stuck healing, and boosting nitric oxide, which widens vessels and increases blood flow. A stubborn tendon or an irritated gut lining is often 'stuck' because it's under-supplied with blood; BPC-157 re-opens the delivery route so oxygen, nutrients, and repair cells actually reach the damaged spot. It also signals cells to lay down fresh collagen, and it interacts with gut-brain pathways, which is why some people report mood and clarity shifts alongside the physical stuff. Say it as: 'it re-opens the supply lines to the part of you that's stuck healing.'",
    researchedFor:
      "Tendon, ligament, and joint recovery, gut-lining repair, blood flow, and inflammation. It comes oral (gut goals) and injectable (a specific site), a built-in 'which one are you?' angle.",
    whoBuys:
      "Lifters and weekend athletes with nagging tendon or joint issues, and the gut-health crowd. They want to train through pain and not feel broken.",
    angles: [
      {
        title: "The injury that wouldn't heal",
        hook: "Still babying that shoulder 8 months later? Here's what people turn to when physio stalls.",
        detail: "The highest-intent buyer: someone with one named chronic injury (runner's knee, shoulder, elbow, Achilles). Name their injury and they feel seen.",
      },
      {
        title: "Rogan fought this injury for years",
        hook: "The biggest podcaster on earth said this finally helped an injury he'd fought for years.",
        detail: "For the skeptical mainstream buyer. Tell the story so the narrative carries the credibility.",
      },
      {
        title: "Why one compound touches your gut AND your knee",
        hook: "People use the exact same thing for their bloating and their bad knee. Here's why, it started in your stomach.",
        detail: "Opens both the gut and the injury buyer in one video. A real curiosity gap gets shares.",
      },
      {
        title: "Oral or injectable, which one are you?",
        hook: "Two people buy this for opposite reasons. Here's which version is yours.",
        detail: "Gut goals point to oral; a specific injury points to injectable. Interactive, high-save, and funnels to a product choice.",
      },
      {
        title: "You're running the Wolverine stack on one leg",
        hook: "Bought BPC but skipped the other half? You're doing the Wolverine stack on one leg.",
        detail: "BPC plus TB-500 is the Wolverine stack: BPC builds the blood supply, TB brings the repair cells. Upsell owners of BPC into the stack, or into GLOW and KLOW, which contain both.",
      },
    ],
    whatPeopleSay:
      "Beyond injuries, people report less bloating, better digestion, 'leaky gut' and IBS relief, and even calmer mood and clearer thinking through the gut-brain axis. These are the fastest-growing search angles. Be honest that a minority report low mood or fatigue; everyone's different.",
    compliantLine:
      "'The most-discussed recovery research peptide.' Never 'heals your injury' or 'cures IBS.'",
  },
  {
    name: "TB-500",
    aka: "Thymosin Beta-4 fragment",
    category: "Recovery",
    desire: "Recover",
    risk: "care",
    searchedAs: "TB-500, thymosin, Wolverine stack",
    whatItIs:
      "A lab-made fragment related to a natural protein that helps move cells around to repair tissue. It's rarely sold alone; it's the second half of the Wolverine recovery stack.",
    howItWorks:
      "If BPC-157 re-opens the blood supply, TB-500 brings the workers. It helps repair cells migrate to where the damage is and supports the growth of new blood vessels, so the pair is described as 'infrastructure plus workers.' It acts more systemically (whole-body) than BPC's more local action. Say it as: 'BPC builds the supply lines, TB brings the repair crew.'",
    researchedFor:
      "Flexibility, recovery, and tissue healing, usually alongside BPC-157.",
    whoBuys:
      "People who already bought into BPC-157 and want the complete recovery stack.",
    angles: [
      {
        title: "Complete the stack",
        hook: "BPC without TB is half the Wolverine.",
        detail: "Pure upsell logic. The memorable line: BPC builds the infrastructure, TB brings the workers.",
      },
      {
        title: "The systemic partner",
        hook: "One works on the spot, the other works everywhere. That's why people run both.",
        detail: "Frame TB-500 as the whole-body partner to BPC's local action, a clear reason to add it.",
      },
    ],
    whatPeopleSay:
      "People report smoother, faster recovery when it's paired with BPC-157. Community experience.",
    compliantLine:
      "'Discussed as the systemic partner in the Wolverine stack.' No healing claims.",
  },
  {
    name: "Wolverine Stack",
    aka: "BPC-157 + TB-500",
    category: "Recovery",
    desire: "Recover",
    risk: "care",
    searchedAs: "Wolverine stack, BPC-157 + TB-500",
    whatItIs:
      "The two most popular recovery peptides sold together as one bundle. The nickname comes from the comic-book character who heals fast.",
    howItWorks:
      "The two halves cover different jobs: BPC-157 re-opens the blood supply to a stuck area, and TB-500 brings the repair cells and supports new blood vessels. 'Infrastructure plus workers.' Say it as: 'one re-opens the supply lines, the other sends in the repair crew.'",
    researchedFor:
      "The pair is frequently studied together for connective-tissue and recovery research.",
    whoBuys:
      "The gym-recovery crowd who want the complete, no-guesswork option.",
    angles: [
      {
        title: "The recovery stack",
        hook: "The two-peptide combo the recovery world is built around.",
        detail: "Sell it as one memorable, complete package. Named stacks feel finished and lift order value.",
      },
      {
        title: "Better value, less decision fatigue",
        hook: "One choice instead of two, and nothing missing.",
        detail: "A great first recommendation for newcomers.",
      },
    ],
    whatPeopleSay:
      "People report faster bounce-back running both halves together rather than BPC alone. Community experience.",
    compliantLine:
      "'The recovery stack people talk about.' Discuss that it exists, never how to run it.",
  },
  {
    name: "Retatrutide",
    aka: "Triple agonist",
    category: "Metabolic",
    desire: "Lean",
    risk: "high",
    searchedAs: "'reta', 'ratatouille', 'Triple-G', 'GLP-3', 'Godzilla' of weight loss",
    whatItIs:
      "An experimental 'triple agonist' that pulls three metabolic levers at once, where the older shots pull one or two. Still in trials, not on the shelf. Treat it purely as an investigational research compound.",
    howItWorks:
      "Three switches. GLP-1 slows how fast your stomach empties and tells your brain you're full, that's the 'food noise off.' GIP helps your body handle blood sugar and adds to the appetite effect. The third one is the difference-maker: glucagon actually turns up your energy expenditure, so your body spends more, and it helps clear liver fat. The older shots just make you eat less; this one makes you eat less and burn more. Say it as: 'one and two switches turn off hunger, the third turns up the burn, that's why it hits harder.'",
    researchedFor:
      "Studied in the research setting for weight regulation, appetite signaling, and metabolic markers. It's the most-searched compound in the space right now.",
    whoBuys:
      "People who plateaued on the current shots and want the next level. What they crave isn't the scale, it's silence from 'food noise.'",
    angles: [
      {
        title: "When the food noise finally goes quiet",
        hook: "Imagine not thinking about food all day. That silence is what people won't shut up about.",
        detail: "'Food noise' is the constant background chatter about eating, and people say this drops it to near zero. The most relatable, most-searched hook in the niche, so lead here.",
      },
      {
        title: "One switch, two switches... this hits three",
        hook: "Everyone's shot flips one or two switches. This flips three.",
        detail: "For the informed buyer who wants the newest, strongest thing. Novelty plus a built-in hierarchy.",
      },
      {
        title: "For when your shot stopped working",
        hook: "Scale stopped moving? Here's what people switch to when they plateau.",
        detail: "Names the exact frustration of the stalled current user.",
      },
      {
        title: "Why the internet calls it Godzilla",
        hook: "There's a reason people call this the Godzilla of weight loss.",
        detail: "For the curious scroller. The nickname is a pattern-interrupt.",
      },
    ],
    whatPeopleSay:
      "People describe appetite going nearly silent and cravings vanishing, the 'food noise off' experience they say beats the weight loss itself.",
    compliantLine:
      "Tightest discipline of any compound. Frame it as an investigational research compound and talk mechanism only. No before/afters, never name prescription GLP-1 brands (the Rx names hurt reach and trip filters), no dosing.",
  },
  {
    name: "Tesamorelin",
    category: "Growth Hormone",
    desire: "Lean",
    risk: "care",
    searchedAs: "tesamorelin, visceral fat peptide",
    whatItIs:
      "A growth-hormone-releasing peptide people discuss specifically for deep belly fat, the visceral kind around your organs, not the pinchable kind. That specificity is its edge.",
    howItWorks:
      "It taps your pituitary to release your own growth hormone in natural pulses (it mimics the GHRH signal your brain already uses), which raises IGF-1 downstream. The key part: growth hormone preferentially mobilizes visceral fat, the deep fat wrapped around your organs, so it's talked about for the gut specifically, not all-over weight. Say it as: 'you're not injecting a fat burner, you're nudging your own growth hormone, and that hormone goes after deep belly fat first.'",
    researchedFor:
      "Visceral belly fat, body composition, growth-hormone support, and energy.",
    whoBuys:
      "The cautious 35 to 55 buyer, often men, lean-ish everywhere but carrying a stubborn midsection, who wants a real track record, not the flavor of the week.",
    angles: [
      {
        title: "For the belly fat that won't budge",
        hook: "Lean everywhere but the gut? That's a different kind of fat, and here's the compound people talk about for exactly that.",
        detail: "It's discussed for visceral fat, the deep belly fat diet and cardio barely touch. A sharp, specific promise beats generic 'weight loss.'",
      },
      {
        title: "The one with the longest track record",
        hook: "Everyone's chasing the newest compound. This is the one with the longest track record.",
        detail: "For the burned, skeptical buyer. It de-risks the category. Reach tip: saying the approval status out loud can shadowban the post, so sell the trust and skip the acronyms, framing it as 'the most-studied, longest-used one.'",
      },
      {
        title: "Grown-up biohacking",
        hook: "Biohacking for adults, less hype, more results you can measure.",
        detail: "For the 40+ higher-spend buyer. It flatters the audience and matches the identity.",
      },
    ],
    whatPeopleSay:
      "People report a flatter midsection over time, better energy, and improved sleep. Reference it as experience.",
    compliantLine:
      "Avoid approval and prescription keywords (both reach and policy). Don't promote specific off-label medical use as a claim.",
  },
  {
    name: "CJC-1295",
    aka: "GHRH analog",
    category: "Growth Hormone",
    desire: "Optimize",
    risk: "high",
    searchedAs: "CJC-1295, ipamorelin, GH peptides",
    whatItIs:
      "A peptide that nudges your own body to release more growth hormone, run with ipamorelin (which triggers growth hormone through a second door). You're not injecting growth hormone, you're asking your body to make more of its own.",
    howItWorks:
      "Your body releases growth hormone in pulses, controlled by two switches, and this stack presses both. CJC-1295 copies GHRH, the 'make growth hormone and get ready to release it' signal, the accelerator. Ipamorelin copies ghrelin, the 'release it now' signal, which lifts the brake, and it's selective, so it does this without spiking stress hormones like cortisol. They hit two different receptors, so together they produce a bigger, cleaner pulse than either alone. Say it as: 'CJC tells the pituitary to make growth hormone, ipamorelin tells it to release it, accelerator plus letting off the brake, one bigger pulse.' The first thing people feel is deeper sleep, where most recovery happens.",
    researchedFor:
      "Deeper sleep, recovery, body composition, and 'anti-aging.'",
    whoBuys:
      "Bodybuilders crossing into longevity, and 35 to 55 optimizers whose number-one complaint is bad sleep and slow recovery.",
    angles: [
      {
        title: "Accelerator plus brakes, deeper sleep by night one",
        hook: "People run these two together for one reason they feel by night one: they finally sleep deep.",
        detail: "Aim it at the exhausted 40-something who wakes up tired. Sleep is the most relatable, repeatable benefit, so sell waking up rebuilt.",
      },
      {
        title: "Ask your body to make it, don't inject it",
        hook: "There's the sledgehammer way to raise growth hormone, and the smart way. This is the smart way.",
        detail: "For the buyer nervous about 'juicing.' It reframes the stack as measured and mature.",
      },
      {
        title: "Recover like you're 25 again",
        hook: "Remember training hard and feeling fine the next day? People chase that feeling with this.",
        detail: "For the aging lifter. Nostalgia plus identity.",
      },
    ],
    whatPeopleSay:
      "People report deeper sleep, faster recovery, better skin, and 'feeling younger.' Keep expectations honest: even Bryan Johnson found it didn't work for him.",
    compliantLine:
      "'A growth-hormone-releasing research peptide people discuss for recovery and sleep.' Handle with extra care: the class carries flagged concerns. No protocols, soft language.",
  },
  {
    name: "NAD+",
    category: "Longevity",
    desire: "Optimize",
    risk: "safe",
    searchedAs: "NAD+, cellular energy, longevity IV",
    whatItIs:
      "A coenzyme in every one of your cells. It's the molecule behind the $500 longevity-clinic IV drips.",
    howItWorks:
      "NAD+ does three jobs at once, and you run low on all three with age. First, energy: it's the electron shuttle your mitochondria use to turn food into fuel, no NAD+, no energy production. Second, longevity genes: it powers the sirtuins, the 'longevity enzymes' that keep pro-aging genes switched off, so when NAD+ drops those brakes come off. Third, DNA repair: it feeds the crew that fixes DNA damage. Here's the line that sells it: 'your NAD+ falls about 50% between 40 and 60, so your energy, your longevity genes, and your DNA repair all lose their fuel at the same time, and topping it up is refilling that tank.'",
    researchedFor:
      "Cellular energy, mitochondrial function, DNA repair, and longevity.",
    whoBuys:
      "The 'run my body like software' crowd: biohackers, execs, and longevity chasers who'll pay for the best.",
    angles: [
      {
        title: "Clean energy from the cell up, no crash",
        hook: "Not a coffee buzz. This is energy from your cells up, no 2pm crash.",
        detail: "It fuels the mitochondria, so it's baseline energy, not a caffeine spike. Aim it at the tired-but-wired professional, and contrast the thing they're sick of.",
      },
      {
        title: "The $500 IV drip, in your routine",
        hook: "That IV drip your favorite biohacker pays $500 for? This is what's in the bag.",
        detail: "For aspirational longevity buyers priced out of the clinic. Access plus status.",
      },
      {
        title: "You're down 50% by 60, and it fuels three things",
        hook: "One molecule runs your energy, your longevity genes, AND your DNA repair, and you're losing it every year.",
        detail: "For the 35+ 'I don't feel as sharp' buyer. A real, compliant urgency built on the mechanism.",
      },
    ],
    whatPeopleSay:
      "People report more energy, sharper clarity, better sleep, 'glow,' and faster hangover recovery. Phrase it as 'people swear by it for...'",
    compliantLine:
      "'A coenzyme central to cellular energy that people are exploring for longevity.'",
  },
  {
    name: "MOTS-c",
    aka: "Mitochondrial peptide",
    category: "Longevity",
    desire: "Optimize",
    risk: "care",
    searchedAs: "MOTS-c, mitochondrial peptide",
    whatItIs:
      "A peptide your own mitochondria (the cell's power plants) make. It's an insider longevity pick most people haven't heard of yet.",
    howItWorks:
      "It's the 'you just exercised' signal. Your mitochondria actually release it during a workout (levels can jump sharply), and it flips AMPK, the master switch that tells cells to build more mitochondria, burn fat for fuel, and handle glucose better. It pairs with SS-31, which protects the power plants MOTS-c tells you to build. Say it as: 'MOTS-c tells your cells to build more power plants.'",
    researchedFor:
      "Metabolic health, cellular energy, exercise-like effects, and healthy aging, mostly in animal models so far.",
    whoBuys:
      "Deep biohackers who want what the crowd doesn't know yet. Being early is the sell.",
    angles: [
      {
        title: "Exercise, in a molecule",
        hook: "Your body makes this when you exercise. What if you got that signal on a rest day?",
        detail: "It flips the same AMPK switch training does. Irresistible curiosity for the fitness-optimizer, flag that human data is still early.",
      },
      {
        title: "Build the engine",
        hook: "One peptide tells your cells to build more power plants. That's the whole pitch.",
        detail: "Half of the mito duo with SS-31: MOTS-c drives demand, SS-31 protects efficiency.",
      },
      {
        title: "The peptides the crowd hasn't found yet",
        hook: "Everyone knows BPC and copper peptides. Almost nobody's talking about these two.",
        detail: "For the early-adopter. Sells status and being ahead.",
      },
    ],
    whatPeopleSay:
      "Early adopters report better endurance, energy, and recovery. Flag that human data is emerging.",
    compliantLine:
      "'An emerging mitochondrial research peptide.' Flag that it's early-stage and keep it curiosity-driven.",
  },
  {
    name: "SS-31",
    aka: "Elamipretide",
    category: "Longevity",
    desire: "Optimize",
    risk: "care",
    searchedAs: "SS-31, elamipretide, mitochondrial peptide",
    whatItIs:
      "A lab-made peptide that homes in on the inner lining of your mitochondria, the cell's power plants, and protects how efficiently they run. It's the natural partner to MOTS-c.",
    howItWorks:
      "It's the maintenance crew. Your power plants have a delicate inner lining held together by a lipid called cardiolipin; with age and stress it oxidizes and starts 'leaking' electrons, so the plant runs dirty. SS-31 concentrates in that membrane and binds cardiolipin, sealing the leak and keeping the energy chain organized. It's a structural fix, not a bulk antioxidant. Say it as: 'MOTS-c tells your cells to build more power plants, SS-31 keeps the ones you've got from leaking, build plus protect.'",
    researchedFor:
      "Mitochondrial function and cellular resilience, still early-stage.",
    whoBuys: "The same insider longevity crowd that likes MOTS-c.",
    angles: [
      {
        title: "Protect the engine",
        hook: "One peptide keeps your power plants from leaking and burning out.",
        detail: "'MOTS-c revs the engine, SS-31 protects and tunes it.' A clean, memorable stack story that justifies buying two.",
      },
      {
        title: "The insider's insider",
        hook: "Even most biohackers haven't heard of this one.",
        detail: "It rewards the early-adopter identity.",
      },
    ],
    whatPeopleSay:
      "Early adopters report steadier energy and endurance. Flag limited human data.",
    compliantLine:
      "'An emerging mitochondrial research peptide.' Flag limited human data.",
  },
  {
    name: "Semax",
    category: "Cognitive",
    desire: "Optimize",
    risk: "care",
    searchedAs: "Semax, Selank, nootropic peptides",
    whatItIs:
      "Nasal-spray 'brain' peptides. Semax for focus and drive; Selank for calm. Together they're 'calm focus.'",
    howItWorks:
      "Semax is a fragment of a natural brain-signaling molecule (ACTH) that raises BDNF, which you can think of as fertilizer for your neurons, driving new connections, and it nudges dopamine, the drive and focus you feel. Selank modulates your calm-and-steady systems (GABA and serotonin) and also lifts BDNF, so it takes the edge off without sedating you. Say it as: 'Semax adds the drive and the focus, Selank keeps you from tipping into anxiety, one's the gas, one's the brakes, run together you get locked-in without the jitter.'",
    researchedFor:
      "Focus, memory, and neuroplasticity (Semax); stress and anxiety modulation (Selank).",
    whoBuys:
      "Founders, students, and knowledge-workers chasing 'calm focus.' A small but high-intent, high-repeat audience.",
    angles: [
      {
        title: "Focus without the jitter",
        hook: "Coffee gives you focus AND the shakes. This crowd runs two peptides: one for focus, one for calm.",
        detail: "Names the exact downside of their current fix, caffeine.",
      },
      {
        title: "Founder mode, bottled",
        hook: "The 'lock in for 4 hours' stack people talk about in founder circles.",
        detail: "Sells an aspirational identity to the productivity buyer.",
      },
      {
        title: "The brain peptides almost nobody's heard of",
        hook: "You know the recovery peptides. Here are the two your brain would pick.",
        detail: "Novelty plus curiosity for the biohacker completist.",
      },
    ],
    whatPeopleSay:
      "People report sharper focus, smoother mood, and 'calm productivity' without jitters. Community experience.",
    compliantLine:
      "'Nootropic research peptides people use for focus.' Note region-specific legality.",
  },
  {
    name: "Bacteriostatic Water",
    aka: "BAC water",
    category: "Essentials",
    desire: "Essential",
    risk: "care",
    searchedAs: "bacteriostatic water, BAC water",
    whatItIs:
      "Sterile water with a preservative, used as a lab reconstitution consumable. Not exciting on its own, and that's the point: it's the quiet attach-item on almost every order.",
    researchedFor:
      "The essential lab companion; it's the 'don't forget' item on every order.",
    angles: [
      {
        title: "Don't cheap out on the last step",
        hook: "Don't pair a premium peptide with generic water.",
        detail: "A simple quality attach-item: lab-grade, batch-tested water. Bundle it at checkout to lift cart value; don't build content around it.",
      },
    ],
    compliantLine:
      "Frame it strictly as a lab supply. It's safe on its own, but it becomes a red flag inside reconstitution or injection footage, so never put it in 'how to mix or inject' content.",
  },
];

const DESIRE_META: Record<
  Desire,
  { label: string; blurb: string; tone: string }
> = {
  Glow: {
    label: "Glow",
    blurb:
      "Beauty and skincare, women 25 to 55. The identity: the person with unfairly good skin.",
    tone: "bg-pink-500/10 text-pink-700 border-pink-500/20",
  },
  Recover: {
    label: "Recover",
    blurb:
      "Lifters, injured athletes, gut health. The identity: the person who bounces back fast.",
    tone: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  },
  Lean: {
    label: "Lean",
    blurb:
      "The weight-loss and GLP-1 crowd. The identity: the person food noise doesn't control.",
    tone: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  },
  Optimize: {
    label: "Optimize",
    blurb:
      "Longevity, biohackers, founders. The identity: running your body like software.",
    tone: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  },
  Essential: {
    label: "Essential",
    blurb: "The lab consumable that completes every order.",
    tone: "bg-[#242526]/5 text-[#64717a] border-[#242526]/10",
  },
};

const RISK_META: Record<Risk, { label: string; tone: string }> = {
  safe: {
    label: "Safe lane",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  care: {
    label: "Handle with care",
    tone: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  high: {
    label: "High risk",
    tone: "bg-red-500/10 text-red-600 border-red-500/20",
  },
};

/** Named stacks the community discusses. Awareness only, never protocols. */
const STACKS: {
  name: string;
  composition: string;
  desire: Desire;
  sellAs: string;
  crossSell: string;
}[] = [
  {
    name: "Wolverine",
    composition: "BPC-157 + TB-500",
    desire: "Recover",
    sellAs: "The recovery stack",
    crossSell: "Buy BPC, attach TB.",
  },
  {
    name: "GLOW",
    composition: "GHK-Cu + BPC-157 + TB-500",
    desire: "Glow",
    sellAs: "Glow and recovery in one",
    crossSell: "Bundle for a higher order value.",
  },
  {
    name: "KLOW",
    composition: "GLOW + KPV",
    desire: "Glow",
    sellAs: "Glow, recovery, and calm",
    crossSell: "Upsell from GLOW (the KPV layer).",
  },
  {
    name: "GH duo",
    composition: "CJC-1295 + Ipamorelin",
    desire: "Optimize",
    sellAs: "Sleep and recovery, two speeds",
    crossSell: "Sell as a pair only.",
  },
  {
    name: "Mito duo",
    composition: "MOTS-c + SS-31",
    desire: "Optimize",
    sellAs: "Rev and protect the engine",
    crossSell: "The insider bundle.",
  },
  {
    name: "Nootropic",
    composition: "Semax + Selank",
    desire: "Optimize",
    sellAs: "Calm focus, founder mode",
    crossSell: "Sell as a pair.",
  },
];

/* ------------------------------------------------------------------ */
/* Content: reconstitution & dosing reference                          */
/* ------------------------------------------------------------------ */

interface ReconProduct {
  name: string;
  aka?: string;
  contents?: string[];
  reconstitution: string[];
  concentration?: string[];
  dosage: string[];
  uses?: string[];
}

const RECON_PRODUCTS: ReconProduct[] = [
  {
    name: "GHK-Cu",
    aka: "Copper Peptide",
    contents: ["GHK-Cu \u2013 50 mg"],
    reconstitution: [
      "Add 2 mL bacteriostatic water.",
      "Inject slowly down the side of the vial.",
      "Swirl gently until fully dissolved.",
    ],
    concentration: ["50 mg + 2 mL = 25 mg/mL", "Per 0.10 mL (10 units): 2.5 mg"],
    dosage: ["1\u20132 mg daily"],
    uses: ["Skin rejuvenation", "Hair support", "Tissue repair"],
  },
  {
    name: "GLOW",
    aka: "GHK-Cu + BPC-157 + TB-500",
    contents: ["GHK-Cu \u2013 50 mg", "BPC-157 \u2013 10 mg", "TB-500 \u2013 10 mg"],
    reconstitution: [
      "Add 2 mL bacteriostatic water.",
      "Swirl gently until dissolved.",
    ],
    concentration: [
      "Per mL \u2014 GHK-Cu: 25 mg \u00b7 BPC-157: 5 mg \u00b7 TB-500: 5 mg",
      "Per 0.10 mL (10 units) \u2014 GHK-Cu: 2.5 mg \u00b7 BPC-157: 500 mcg \u00b7 TB-500: 500 mcg",
    ],
    dosage: [
      "10 units (0.10 mL) once daily.",
      "May increase to 20 units (0.20 mL) daily depending on protocol.",
    ],
    uses: [
      "Skin rejuvenation",
      "Hair support",
      "Injury recovery",
      "Connective tissue healing",
    ],
  },
  {
    name: "KLOW",
    aka: "GHK-Cu + BPC-157 + TB-500 + KPV",
    contents: [
      "GHK-Cu \u2013 50 mg",
      "BPC-157 \u2013 10 mg",
      "TB-500 \u2013 10 mg",
      "KPV \u2013 10 mg",
    ],
    reconstitution: [
      "Add 2 mL bacteriostatic water.",
      "Swirl gently until dissolved.",
    ],
    concentration: [
      "Per mL \u2014 GHK-Cu: 25 mg \u00b7 BPC-157: 5 mg \u00b7 TB-500: 5 mg \u00b7 KPV: 5 mg",
      "Per 0.10 mL (10 units) \u2014 GHK-Cu: 2.5 mg \u00b7 BPC-157: 500 mcg \u00b7 TB-500: 500 mcg \u00b7 KPV: 500 mcg",
    ],
    dosage: [
      "10 units (0.10 mL) once daily.",
      "May increase to 20 units (0.20 mL) daily depending on protocol.",
    ],
    uses: [
      "Recovery",
      "Skin health",
      "Gut support",
      "Inflammation support",
      "Tissue repair",
    ],
  },
  {
    name: "Glutathione",
    contents: ["Glutathione \u2013 600 mg"],
    reconstitution: [
      "Add 7.5 mL bacteriostatic water.",
      "Some protocols prefer preservative-free sterile water (Hospira) for glutathione.",
    ],
    concentration: ["600 mg + 7.5 mL = 80 mg/mL", "Per 0.50 mL (50 units): 40 mg"],
    dosage: ["200\u2013600 mg", "2\u20133 times weekly"],
    uses: ["Antioxidant support", "Liver support", "Skin brightness", "Recovery"],
  },
  {
    name: "BPC-157",
    contents: ["BPC-157 \u2013 10 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: ["10 mg + 2 mL = 5 mg/mL", "Per 0.10 mL (10 units): 500 mcg"],
    dosage: ["250\u2013500 mcg", "Once or twice daily"],
    uses: ["Joint recovery", "Tendon injuries", "Muscle recovery", "Gut support"],
  },
  {
    name: "TB-500",
    contents: ["TB-500 \u2013 10 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: ["10 mg + 2 mL = 5 mg/mL", "Per 0.10 mL (10 units): 500 mcg"],
    dosage: [
      "Loading: 2\u20132.5 mg twice weekly",
      "Maintenance: 2\u20134 mg every 2\u20134 weeks",
    ],
    uses: ["Muscle recovery", "Tendon repair", "Ligament healing"],
  },
  {
    name: "Wolverine Stack",
    aka: "BPC-157 + TB-500",
    contents: ["BPC-157 \u2013 10 mg", "TB-500 \u2013 10 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: [
      "Per mL \u2014 BPC-157: 5 mg \u00b7 TB-500: 5 mg",
      "Per 0.10 mL (10 units) \u2014 BPC-157: 500 mcg \u00b7 TB-500: 500 mcg",
    ],
    dosage: ["10 units (0.10 mL) once or twice daily"],
    uses: [
      "Muscle recovery",
      "Tendon injuries",
      "Ligament healing",
      "Joint support",
    ],
  },
  {
    name: "Retatrutide",
    reconstitution: ["Add 2 mL bacteriostatic water."],
    dosage: [
      "Typical titration:",
      "Weeks 1\u20134: 1\u20132 mg weekly",
      "Weeks 5\u20138: 4 mg weekly",
      "Weeks 9+: 6\u201312 mg weekly (depending on tolerance)",
    ],
    uses: ["Weight management", "Appetite regulation", "Metabolic health"],
  },
  {
    name: "Tesamorelin",
    contents: ["Tesamorelin \u2013 10 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: ["10 mg + 2 mL = 5 mg/mL", "Per 0.10 mL (10 units): 500 mcg"],
    dosage: ["1\u20132 mg daily", "Usually taken before bed, on an empty stomach"],
  },
  {
    name: "CJC-1295 + Ipamorelin",
    contents: ["CJC-1295 \u2013 5 mg", "Ipamorelin \u2013 5 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: [
      "Per mL \u2014 CJC-1295: 2.5 mg \u00b7 Ipamorelin: 2.5 mg",
      "Per 0.10 mL (10 units) \u2014 CJC-1295: 250 mcg \u00b7 Ipamorelin: 250 mcg",
    ],
    dosage: [
      "10 units (0.10 mL) once daily",
      "Usually before bed",
      "May be used twice daily depending on protocol",
    ],
    uses: [
      "Growth hormone support",
      "Recovery",
      "Lean muscle",
      "Sleep",
      "Fat metabolism",
    ],
  },
  {
    name: "NAD+",
    contents: ["NAD+ \u2013 500 mg"],
    reconstitution: ["Add 5 mL bacteriostatic water."],
    concentration: ["500 mg + 5 mL = 100 mg/mL", "Per 0.10 mL (10 units): 10 mg"],
    dosage: ["25\u2013100 mg", "Daily or several times weekly"],
    uses: ["Cellular energy", "Recovery", "Healthy aging"],
  },
  {
    name: "MOTS-c",
    contents: ["MOTS-c \u2013 10 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: ["10 mg + 2 mL = 5 mg/mL", "Per 0.10 mL (10 units): 500 mcg"],
    dosage: ["5\u201310 mg", "2\u20133 times weekly"],
    uses: ["Metabolic health", "Energy production", "Exercise performance"],
  },
  {
    name: "SS-31",
    aka: "Elamipretide",
    contents: ["SS-31 \u2013 10 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: ["10 mg + 2 mL = 5 mg/mL", "Per 0.10 mL (10 units): 500 mcg"],
    dosage: ["2\u20135 mg daily"],
    uses: ["Mitochondrial health", "Recovery", "Cellular energy"],
  },
  {
    name: "Semax",
    contents: ["Semax \u2013 10 mg"],
    reconstitution: ["Add 2 mL bacteriostatic water."],
    concentration: ["10 mg + 2 mL = 5 mg/mL", "Per 0.10 mL (10 units): 500 mcg"],
    dosage: ["200\u2013600 mcg", "Once or twice daily"],
    uses: ["Focus", "Memory", "Mental clarity", "Cognitive performance"],
  },
];

const RECON_TIPS: string[] = [
  "Wash your hands thoroughly before handling peptides.",
  "Clean the vial stopper with an alcohol swab before every use.",
  "Inject bacteriostatic water slowly down the inside wall of the vial.",
  "Swirl gently until fully dissolved, do not shake.",
  "Store reconstituted peptides in the refrigerator (2\u20138\u00b0C / 36\u201346\u00b0F).",
  "Protect from excessive heat and direct sunlight.",
  "Use a new sterile syringe and needle for every injection.",
  "Discard the solution if it becomes cloudy, changes color, or contains visible particles.",
];

const BAC_STORAGE: string[] = [
  "Refrigerate after opening.",
  "Discard 28 days after first puncture.",
  "Always use a new sterile syringe and needle.",
  "Do not inject bacteriostatic water by itself unless directed by a healthcare professional.",
];

const TRUST_WEDGE: string[] = [
  "'Third-party tested. COA on every batch. Swiss pharmaceutical standard.' That's a quality claim, not a health claim, so it's compliant AND it's exactly what an anxious buyer wants to hear.",
  "Position IQON as the grown-up in a sketchy room. The whole market is full of 'gray-market vials from who-knows-where' fear, so 'you can actually look up what's in it' is a killer, honest hook.",
  "Every selling angle should land on the trust wedge as the close. Desire opens the sale; trust closes it.",
];

const SELL_STEPS: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tldr: string;
  body: string;
}[] = [
  {
    icon: Target,
    title: "Lead with the person, not the product",
    tldr: "Ask what they're chasing first, then match one product — never the catalog.",
    body: "When you get them into your DMs, don't open with a product. Ask what they're actually chasing: recovery, energy, skin, focus, metabolic goals. Once you know that, match them to one category from the library instead of dumping the whole catalog on them.",
  },
  {
    icon: Lightbulb,
    title: "Tell the origin story",
    tldr: "Swiss standard + COA-backed is your differentiator — sell the proof.",
    body: "The Swiss-standard, third-party-tested, COA-backed story is your differentiator. Anyone can sell a vial; you're selling proof and consistency.",
  },
  {
    icon: Repeat,
    title: "Turn one order into a subscription",
    tldr: "'Never run out, pay 10% less' — and you earn commission on every renewal.",
    body: "Subscribe & Save gives 10% off every order and locks in repeat commission for you. Frame it as 'never run out, pay less', since most peptide use is ongoing anyway.",
  },
  {
    icon: MessageCircle,
    title: "Handle the trust question head-on",
    tldr: "'Is it legit?' → point to the public COAs. Never give medical advice.",
    body: "'How do I know it's legit?' → if they're skeptical about purity, let them know we publish COAs for all our products on our website. 'Is it safe?' → it's research-use-only, share the documentation, never give medical advice. Confidence + honesty closes.",
  },
];

const OBJECTIONS: { q: string; a: string }[] = [
  {
    q: "\u201cWhy is it more than the cheap stuff online?\u201d",
    a: "Because you're paying for verified purity and consistency. Cheap vials skip third-party testing, so you have no idea what's actually inside. Every IQON batch has a COA. You get what the label says, every time.",
  },
  {
    q: "\u201cHow do I know it's real?\u201d",
    a: "If they're skeptical about purity, let them know we publish COAs for all our products on our website. Identity and concentration are confirmed by HPLC and mass spectrometry. That's the whole point of our brand: proof anyone can look up.",
  },
  {
    q: "\u201cWhat does it actually do?\u201d",
    a: "Point them to the research category (recovery, metabolic, skin, etc.) and stick to what it's been studied for. Everything is for research use only, so share documentation and never make medical or dosing claims.",
  },
  {
    q: "\u201cCan I just buy once?\u201d",
    a: "Absolutely, but Subscribe & Save is 10% cheaper and they'll never run mid-protocol. Most people reorder anyway, so it's the smarter default.",
  },
];

const CONVERSION_TACTICS: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tldr: string;
  body: string;
}[] = [
  {
    icon: MessageCircle,
    title: "DM automation beats the bio link",
    tldr: "'Comment GLOW and I'll send it' converts — bio links get ignored.",
    body: "The pattern that converts is 'comment a word and I'll send it', which triggers an auto-DM with your link. A bio link is an afterthought most people never tap. Move the action into the comments and DMs.",
  },
  {
    icon: Target,
    title: "Codes on screen, links in the description",
    tldr: "Show and say your code. Count redemptions, not likes.",
    body: "Show your discount code on screen for a few seconds and repeat it out loud. Measure redemptions per 1,000 views, not likes. Views that don't redeem aren't paying you.",
  },
  {
    icon: Lightbulb,
    title: "Use a quiz as your lead magnet",
    tldr: "'What does the research say for your goal?' captures leads on autopilot.",
    body: "'What does the research say for your goal?' captures leads and doubles as SEO. Education-led and quiz-led funnels are the durable acquisition engine in this category, and they route people into your DMs and link.",
  },
  {
    icon: Repeat,
    title: "Make restock and bundle content",
    tldr: "'Restock day' posts + named bundles normalize repeat buying.",
    body: "'Restock day' posts normalize repeat buying, and a named bundle (the GLOW kit) lifts the average order. Pair this with Subscribe & Save to lock in recurring commission.",
  },
];

const RULES: string[] = [
  "Everything is sold For Research Use Only, not for human consumption. Always keep your language in that frame.",
  "Never give medical, dosing, or treatment advice.",
  "Don't make disease, cure, or guaranteed-result claims.",
  "Point customers to Certificates of Analysis for proof rather than making purity claims off the top of your head.",
  "When in doubt, under-promise. Trust and honesty create reorders; hype creates refunds and chargebacks.",
];

/* ------------------------------------------------------------------ */
/* Content: social / platform safety                                   */
/* ------------------------------------------------------------------ */

const SOCIAL_WHY: string[] = [
  "Peptides sit in a restricted category. TikTok Shop bans selling them outright, and YouTube can terminate an entire channel for posting links to buy them. Creators have lost channels permanently.",
  "You sell organically, through posts, Reels, and DMs. The real line is claims, not the topic. Telling your own story or explaining the science is generally fine; what gets content pulled is disease and cure claims ('cured my gut', 'melts fat'), dosing, and injection how-tos, which also break the research-use-only frame for IQON.",
];

/** The non-negotiable platform walls, taught verbatim. */
const HARD_WALLS: { platform: string; rule: string }[] = [
  {
    platform: "TikTok Shop",
    rule: "You cannot sell the catalog here. Peptide hormones and 'research chemicals' are banned outright.",
  },
  {
    platform: "YouTube",
    rule: "Posting links or contact info to buy peptides without a prescription can get your whole channel terminated, and 'it's educational' does not save you. Keep YouTube education-only, no purchase links.",
  },
];

/** Hook templates that repeat across the top-performing content. */
const SOCIAL_HOOKS: { name: string; body: string }[] = [
  {
    name: "Named stack",
    body: "'The Wolverine stack.' 'The GLOW protocol.' Memorable and searchable, and you can build a whole series on one name. Discuss that people talk about it, never how to run it.",
  },
  {
    name: "Food noise",
    body: "Explain what 'food noise' is (the intrusive food thoughts people describe), with no product push. It's the most relatable, most searched phrase in the metabolic space.",
  },
  {
    name: "Myth-buster",
    body: "'What nobody tells you about TB-500.' Correcting a common misunderstanding drives saves and shares and is inherently claim-free.",
  },
  {
    name: "Mechanism explainer",
    body: "'Here's what it actually does inside a cell.' The safest high performer: pure education, zero outcome claims.",
  },
  {
    name: "Did-you-know stat",
    body: "'This peptide was first isolated in 1973 and influences thousands of genes.' Perfect for a text-on-screen GHK-Cu hook.",
  },
];

/** Content format vs. reach vs. IQON compliance. */
const FORMAT_GRID: { format: string; reach: string; safe: Risk }[] = [
  { format: "Mechanism / did-you-know explainer", reach: "Med to high", safe: "safe" },
  { format: "GHK-Cu / GLOW topical routine", reach: "High", safe: "safe" },
  { format: "Myth-buster / skeptic take", reach: "High (saves)", safe: "safe" },
  { format: "Named-stack discussion, no protocol", reach: "High", safe: "care" },
  { format: "Before/after transformation", reach: "Very high", safe: "high" },
  { format: "Injection or reconstitution footage", reach: "Very high", safe: "high" },
  { format: "'Cured my ___' testimonial", reach: "High", safe: "high" },
];

const TRENDS_RISING: string[] = [
  "GHK-Cu and copper-peptide beauty content, the single biggest compliant lane.",
  "NAD+ and longevity 'cellular energy' framing.",
  "Credentialed, long-form 'what the science actually says' fact-checks.",
  "Topical and oral peptide products (serums, hair, collagen) as the industry moves away from injectables.",
  "Female and older-adult audiences.",
];

const TRENDS_FADING: string[] = [
  "Injection and reconstitution how-tos, the top ban magnet.",
  "Naming prescription GLP-1 brands.",
  "Pure 'buy peptides' hard-sell. Demand already exists, so the market moved to education and SEO.",
];

/** Words/phrases that trip filters, paired with a safer, compliant alternative. */
const WORD_SWAPS: { avoid: string; instead: string; why: string }[] = [
  {
    avoid: "Ozempic / Wegovy / Mounjaro (brand drug names)",
    instead: "\u201cthe GLP-1 category\u201d or \u201cresearch compounds in this space\u201d",
    why: "Brand pharma names trip the drug-name filter on every platform. A category reference sits in a gap the filters haven't closed.",
  },
  {
    avoid: "\u201cworks like Ozempic\u201d / \u201calternative to [drug]\u201d",
    instead: "describe the research category on its own terms, no drug comparison",
    why: "TikTok Shop explicitly bans implied comparisons to prescription weight-loss drugs, even \u201csimilar to\u201d or \u201csame effect as.\u201d",
  },
  {
    avoid: "\u201ccures / treats / heals [condition]\u201d",
    instead: "\u201cresearched for,\u201d \u201cstudied in the context of,\u201d \u201cinvestigated for\u201d",
    why: "Disease/treatment claims are prohibited medical claims (platform + FTC + FDA structure-function rules).",
  },
  {
    avoid: "\u201cinject,\u201d \u201cdose,\u201d \u201chow much to take,\u201d \u201cprotocol\u201d",
    instead: "\u201cfor research use only\u201d and point to the product page / COA",
    why: "Dosing and human-use language reads as medical advice and flags fastest of all.",
  },
  {
    avoid: "\u201cmiracle,\u201d \u201cguaranteed,\u201d \u201cclinically proven,\u201d \u201cFDA-approved\u201d",
    instead: "\u201cthird-party tested,\u201d \u201cCOA-verified purity,\u201d \u201cresearch-grade\u201d",
    why: "Guarantees and false approval claims trigger automated rejection and erode trust.",
  },
  {
    avoid: "\u201cstruggling with belly fat?\u201d (personal-attribute framing)",
    instead: "neutral third person: \u201cthe research looks at\u2026\u201d",
    why: "Copy that calls out a viewer's personal attributes or insecurities reads as predatory and gets flagged.",
  },
];

const SOCIAL_DO: string[] = [
  "Lead with the science and sourcing story: Swiss-standard, third-party tested, COA-verified. That's on-brand and platform-safe.",
  "Keep everything in the research-use-only frame. Say what a compound is 'researched for,' never what it will do to a person.",
  "Turn on the platform's branded-content / partnership label AND add a clear #ad disclosure. It keeps the algorithm from quietly hiding your reach and keeps you FTC-compliant.",
  "For video, put the disclosure on-screen and say it out loud in the first 30 seconds. A caption alone isn't enough for Reels/TikToks.",
  "Drive people to your IQON link or the product page for details and the COA, instead of making claims in the caption.",
  "Talk in categories (recovery, metabolic, skin, longevity) rather than naming prescription drugs.",
];

const SOCIAL_DONT: string[] = [
  "Don't name prescription drug brands (Ozempic, Wegovy, Mounjaro) or say a product 'works like' or is an 'alternative to' them.",
  "Don't give dosing, injection, or 'how to use it' instructions; that's medical advice and it's the top thing enforcement hunts for.",
  "Don't claim it cures, treats, or heals anything, and never say 'FDA-approved' or 'clinically proven.'",
  "Don't use before/afters or personal-attribute hooks ('struggling with belly fat?'); outcome and body-callout content is the fastest way to get suppressed.",
  "Don't post purchase links on YouTube. That specific move gets whole channels terminated.",
  "Don't lean on deliberate misspellings or symbols to dodge filters. Research shows it often doesn't help reach and it signals intent to evade, which is off-brand for a Swiss-standard, COA-backed brand.",
];

/* ------------------------------------------------------------------ */
/* Quizzes                                                             */
/* ------------------------------------------------------------------ */

interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

const QUIZZES: Record<Exclude<ModuleKey, "start" | "guide" | "recon">, QuizQuestion[]> = {
  edge: [
    {
      q: "A customer is skeptical about purity and asks how they can trust a vial is what the label says. What do you tell them?",
      options: [
        "Send a screenshot of the product page",
        "We publish COAs for all our products on our website",
        "Offer a discount code",
        "Nothing, just reassure them",
      ],
      answer: 1,
    },
    {
      q: "Which two analytical methods confirm our peptides' identity and purity?",
      options: [
        "Taste and smell tests",
        "HPLC and mass spectrometry",
        "Weighing and eyeballing color",
        "Customer reviews",
      ],
      answer: 1,
    },
    {
      q: "What manufacturing standard do our partners follow?",
      options: ["cGMP", "No standard", "DIY", "FDA-approved for human use"],
      answer: 0,
    },
  ],
  library: [
    {
      q: "Which peptide is the 'triple agonist' acting on GLP-1, GIP, and glucagon?",
      options: ["BPC-157", "GHK-Cu", "Retatrutide", "Semax"],
      answer: 2,
    },
    {
      q: "The Wolverine stack combines which two peptides?",
      options: [
        "NAD+ and MOTS-c",
        "BPC-157 and TB-500",
        "GHK-Cu and KPV",
        "CJC-1295 and Tesamorelin",
      ],
      answer: 1,
    },
    {
      q: "GHK-Cu is best known in research for which area?",
      options: [
        "Skin, collagen, and wound healing",
        "Appetite regulation",
        "Focus and memory",
        "Antioxidant detox",
      ],
      answer: 0,
    },
    {
      q: "Why should you always attach Bacteriostatic (BAC) water to a peptide order?",
      options: [
        "It's a free gift",
        "It's required to reconstitute lyophilized peptides",
        "It extends shelf life indefinitely",
        "It replaces the peptide",
      ],
      answer: 1,
    },
  ],
  sell: [
    {
      q: "What discount does Subscribe & Save give the customer on every order?",
      options: ["5%", "10%", "20%", "No discount"],
      answer: 1,
    },
    {
      q: "What should you lead a conversation with?",
      options: [
        "The full product catalog",
        "The cheapest option",
        "The person's actual goal",
        "A hard deadline",
      ],
      answer: 2,
    },
    {
      q: "Best response to 'how do I know it's real?'",
      options: [
        "Let them know we have COAs for all our products on our website",
        "Say 'trust me'",
        "Offer a refund up front",
        "Change the subject",
      ],
      answer: 0,
    },
    {
      q: "Which two desires are the safest, most repeatable lanes to build content in?",
      options: [
        "Recover and Lean",
        "Glow and Optimize",
        "Lean and Optimize",
        "Recover and Glow",
      ],
      answer: 1,
    },
  ],
  social: [
    {
      q: "You're posting a Reel about a metabolic compound. What's the safest way to reference it?",
      options: [
        "Say it 'works like Ozempic'",
        "Name the GLP-1 category and skip drug brand names",
        "Promise it melts fat fast",
        "Compare it to Mounjaro",
      ],
      answer: 1,
    },
    {
      q: "Which of these will most likely get a post suppressed or your account actioned?",
      options: [
        "Talking about Swiss sourcing and COAs",
        "A before/after weight-loss photo with 'fat burning' in the caption",
        "Linking to the product page",
        "Saying 'for research use only'",
      ],
      answer: 1,
    },
    {
      q: "A follower asks how much to inject and how often. On social you should:",
      options: [
        "Post a dosing protocol",
        "DM them a schedule",
        "Keep it research-use-only and point them to the product page, noting we publish all product COAs on our site, no dosing talk",
        "Guess based on their weight",
      ],
      answer: 2,
    },
    {
      q: "Why do we add a branded-content label and #ad to affiliate posts?",
      options: [
        "It's optional and just looks professional",
        "It lets us skip the research-use-only frame",
        "It keeps us FTC-compliant and stops the algorithm from hiding our reach",
        "It guarantees the post goes viral",
      ],
      answer: 2,
    },
    {
      q: "Which move can get your entire channel terminated?",
      options: [
        "Explaining how a peptide works on YouTube",
        "Posting links to buy peptides without a prescription on YouTube",
        "Tagging a branded-content partnership",
        "Talking about Swiss sourcing",
      ],
      answer: 1,
    },
    {
      q: "On social, what actually gets content pulled?",
      options: [
        "Talking about the science or sourcing",
        "Disease/cure claims, dosing, and injection how-tos",
        "Using the research-use-only frame",
        "Mentioning a COA",
      ],
      answer: 1,
    },
  ],
  rules: [
    {
      q: "How are all IQON products sold?",
      options: [
        "For human consumption",
        "As dietary supplements",
        "For research use only",
        "As prescription drugs",
      ],
      answer: 2,
    },
    {
      q: "A customer asks you how much to take and how often. You should:",
      options: [
        "Give them a dosing schedule",
        "Not give medical or dosing advice",
        "Guess based on their weight",
        "Copy a protocol from a forum",
      ],
      answer: 1,
    },
    {
      q: "For proof of quality, what do you tell a skeptical customer?",
      options: [
        "Your personal opinion",
        "Random online reviews",
        "We publish COAs for all our products on our website",
        "The lowest price",
      ],
      answer: 2,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AffiliateLearnPage() {
  const [module, setModule] = useState<ModuleKey>("start");
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  // Progress is stored locally per browser (no server round-trip). Load once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setCompleted(new Set(arr));
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // storage may be unavailable (private mode); progress just won't persist
    }
  }, []);

  const markComplete = useCallback(
    (key: string) => {
      setCompleted((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetProgress = useCallback(() => {
    setCompleted(new Set());
    persist(new Set());
  }, [persist]);

  const doneCount = COURSE_MODULES.filter((k) => completed.has(k)).length;

  return (
    <>
      <PageHeader
        eyebrow="Affiliate Academy"
        title="Learn IQON"
        description="Everything you need to talk about IQON and our peptides with confidence. Work through the modules at your own pace."
      />

      {/* Module switcher + progress */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {MODULES.map((m) => {
          const active = module === m.key;
          const isCourse = (COURSE_MODULES as string[]).includes(m.key);
          const done = completed.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => setModule(m.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
                active
                  ? "bg-[#242526] text-white"
                  : "glass-surface text-[#64717a] hover:text-[#20282c]"
              }`}
            >
              {isCourse && done ? (
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${active ? "text-white" : "text-emerald-600"}`}
                />
              ) : (
                <m.icon className="h-3.5 w-3.5" />
              )}
              {m.label}
            </button>
          );
        })}

        {hydrated && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              {doneCount}/{COURSE_MODULES.length} complete
            </span>
            <div className="hidden sm:block w-28 h-1.5 rounded-full bg-[#242526]/10 overflow-hidden">
              <div
                className="h-full bg-[#242526] transition-all"
                style={{
                  width: `${(doneCount / COURSE_MODULES.length) * 100}%`,
                }}
              />
            </div>
            {doneCount > 0 && (
              <button
                onClick={resetProgress}
                title="Reset progress"
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {module === "start" && (
        <StartModule onJump={setModule} completed={completed} />
      )}
      {module === "edge" && (
        <EdgeModule
          done={completed.has("edge")}
          onComplete={() => markComplete("edge")}
          onNext={() => setModule("library")}
        />
      )}
      {module === "library" && (
        <LibraryModule
          done={completed.has("library")}
          onComplete={() => markComplete("library")}
          onNext={() => setModule("sell")}
        />
      )}
      {module === "recon" && <ReconModule />}
      {module === "sell" && (
        <SellModule
          done={completed.has("sell")}
          onComplete={() => markComplete("sell")}
          onNext={() => setModule("social")}
        />
      )}
      {module === "social" && (
        <SocialModule
          done={completed.has("social")}
          onComplete={() => markComplete("social")}
          onNext={() => setModule("rules")}
        />
      )}
      {module === "rules" && (
        <RulesModule
          done={completed.has("rules")}
          onComplete={() => markComplete("rules")}
          onNext={() => setModule("start")}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Completion panel (quiz OR mark complete)                            */
/* ------------------------------------------------------------------ */

function CompletionPanel({
  moduleKey,
  done,
  onComplete,
  onNext,
  nextLabel,
}: {
  moduleKey: Exclude<ModuleKey, "start" | "guide" | "recon">;
  done: boolean;
  onComplete: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const [quizOpen, setQuizOpen] = useState(false);
  const questions = QUIZZES[moduleKey];
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  const correctCount = questions.reduce(
    (n, q, i) => (answers[i] === q.answer ? n + 1 : n),
    0
  );
  const allCorrect = correctCount === questions.length;

  function checkAnswers() {
    setChecked(true);
    if (Object.keys(answers).length === questions.length) {
      const passed = questions.every((q, i) => answers[i] === q.answer);
      if (passed) onComplete();
    }
  }

  function resetQuiz() {
    setAnswers({});
    setChecked(false);
  }

  if (done) {
    return (
      <section className="glass-surface rounded-lg p-6 md:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-medium">Module complete</p>
            <p className="text-sm text-[#64717a]">
              Nice work, this one&apos;s checked off.
            </p>
          </div>
        </div>
        <button
          onClick={onNext}
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
        >
          {nextLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </section>
    );
  }

  return (
    <section className="glass-surface rounded-lg p-6 md:p-7">
      {!quizOpen ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-[#64717a] shrink-0" />
            <div>
              <p className="font-medium">Ready to move on?</p>
              <p className="text-sm text-[#64717a]">
                Test yourself with a quick check, or just mark it complete.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setQuizOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Take the quick check
            </button>
            <button
              onClick={onComplete}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark complete
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              Quick check · {questions.length} questions
            </p>
            <button
              onClick={() => {
                setQuizOpen(false);
                resetQuiz();
              }}
              className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c]"
            >
              Close
            </button>
          </div>

          {questions.map((q, qi) => (
            <div key={qi}>
              <p className="font-medium mb-2">
                {qi + 1}. {q.q}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isRight = q.answer === oi;
                  let tone =
                    "border-[#242526]/10 hover:bg-[#242526]/[0.03] text-[#20282c]";
                  if (checked && selected && isRight)
                    tone = "border-emerald-500/40 bg-emerald-50 text-emerald-800";
                  else if (checked && selected && !isRight)
                    tone = "border-red-400/40 bg-red-50 text-red-700";
                  else if (checked && isRight)
                    tone = "border-emerald-500/40 bg-emerald-50/60 text-emerald-800";
                  else if (selected)
                    tone = "border-[#242526]/40 bg-[#242526]/[0.04] text-[#20282c]";
                  return (
                    <button
                      key={oi}
                      onClick={() =>
                        !checked &&
                        setAnswers((a) => ({ ...a, [qi]: oi }))
                      }
                      disabled={checked}
                      className={`text-left text-sm rounded-xl border px-4 py-2.5 transition-colors ${tone} disabled:cursor-default`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {checked ? (
            <div className="space-y-3">
              <div
                className={`rounded-lg p-4 text-sm ${
                  allCorrect
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-amber-50 text-amber-900 border border-amber-200"
                }`}
              >
                {allCorrect ? (
                  <p className="font-medium">
                    Perfect, {correctCount}/{questions.length}. Module marked
                    complete.
                  </p>
                ) : (
                  <p>
                    You got {correctCount}/{questions.length}. Review the
                    highlighted answers above, then retry, or mark it complete
                    to move on.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!allCorrect && (
                  <>
                    <button
                      onClick={resetQuiz}
                      className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                    <button
                      onClick={onComplete}
                      className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark complete anyway
                    </button>
                  </>
                )}
                {allCorrect && (
                  <button
                    onClick={onNext}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
                  >
                    {nextLabel}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={checkAnswers}
                disabled={Object.keys(answers).length !== questions.length}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check answers
              </button>
              <button
                onClick={onComplete}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
              >
                Skip & mark complete
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */

function StartModule({
  onJump,
  completed,
}: {
  onJump: (m: ModuleKey) => void;
  completed: Set<string>;
}) {
  return (
    <div className="space-y-6">
      <section className="glass-accent rounded-lg p-7 md:p-9 text-white">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 mb-4">
          <GraduationCap className="h-3.5 w-3.5 text-white/70" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/70">
            5-minute crash course
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight max-w-2xl">
          You&apos;re not just selling peptides. You&apos;re selling proof,
          consistency, and trust.
        </h2>
        <p className="text-white/70 mt-3 max-w-2xl leading-relaxed">
          IQON makes research-grade peptides that are third-party tested,
          COA-backed, and built to a Swiss pharmaceutical standard. Your job is
          simple: match a person to what they care about, and back it up with
          our proof. Work through the modules below at your own pace.
        </p>
      </section>

      {/* Key numbers */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {KEY_NUMBERS.map((n) => (
          <div key={n.label} className="glass-surface rounded-lg p-5">
            <p className="text-2xl md:text-3xl font-medium font-sans tracking-tight">
              {n.value}
            </p>
            <p className="text-xs text-[#64717a] mt-1.5">{n.label}</p>
          </div>
        ))}
      </section>

      {/* Modules checklist */}
      <section className="glass-surface rounded-lg p-6 md:p-7">
        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-4">
          The course
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {COURSE_MODULES.map((key) => {
            const m = MODULES.find((x) => x.key === key)!;
            const done = completed.has(key);
            return (
              <button
                key={key}
                onClick={() => onJump(key)}
                className="group flex items-center gap-4 text-left rounded-lg border border-[#242526]/8 bg-[#242526]/[0.02] hover:bg-[#242526]/[0.05] transition-colors p-4"
              >
                {done ? (
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-600 text-white shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#242526] text-white shrink-0">
                    <m.icon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.label}</p>
                  <p className="text-xs text-[#64717a] mt-0.5">
                    {LEARN_BLURB[key]}
                  </p>
                </div>
                {done ? (
                  <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-emerald-600">
                    Done
                  </span>
                ) : (
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-[#64717a] rounded-full border border-[#242526]/10 px-2 py-0.5">
                      {LEARN_MINUTES[key]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#64717a] group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const LEARN_BLURB: Record<Exclude<ModuleKey, "start" | "guide" | "recon">, string> = {
  edge: "Sourcing, Swiss standard, and why we win on trust",
  library: "Every peptide, what it is, and what it's researched for",
  sell: "Scripts, subscriptions, and objection handling",
  social: "What to say (and not say) online without getting banned",
  rules: "Stay compliant and keep customers for life",
};

const LEARN_MINUTES: Record<Exclude<ModuleKey, "start" | "guide" | "recon">, string> = {
  edge: "2 min",
  library: "Browse",
  sell: "3 min",
  social: "3 min",
  rules: "1 min",
};

function EdgeModule({
  done,
  onComplete,
  onNext,
}: {
  done: boolean;
  onComplete: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <QuickTake
        points={[
          "Every product has a public COA — proof anyone can look up.",
          "Made to a Swiss pharmaceutical standard, shipped fast from the USA.",
          "When someone asks 'is it legit?', the answer is proof, not promises.",
        ]}
      />

      <p className="text-[#64717a] max-w-2xl">
        Anyone can put peptides in a vial. Here&apos;s what makes IQON
        different — every card is something you can say out loud with a
        straight face, because we can prove it.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {EDGE_POINTS.map((p) => (
          <ExpandableCard
            key={p.title}
            icon={p.icon}
            title={p.title}
            tldr={p.tldr}
            body={p.body}
          />
        ))}
      </div>

      {/* Sourcing / Why Switzerland */}
      <section className="glass-surface rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Mountain className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Where it comes from
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mb-2">
          Our sourcing &amp; the Swiss standard
        </h2>
        <p className="text-sm text-[#64717a] max-w-2xl mb-5 leading-relaxed">
          When someone asks &ldquo;where is this made?&rdquo; this is your
          answer — it&apos;s the most persuasive story you have.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOURCING_POINTS.map((p) => (
            <ExpandableCard
              key={p.title}
              icon={p.icon}
              title={p.title}
              tldr={p.tldr}
              body={p.body}
            />
          ))}
        </div>
      </section>

      <CompletionPanel
        moduleKey="edge"
        done={done}
        onComplete={onComplete}
        onNext={onNext}
        nextLabel="Next: Peptide library"
      />
    </div>
  );
}

function LibraryModule({
  done,
  onComplete,
  onNext,
}: {
  done: boolean;
  onComplete: () => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [openName, setOpenName] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...Object.keys(CATEGORY_META)] as (Category | "All")[],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PEPTIDES.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.aka?.toLowerCase().includes(q) ?? false) ||
        p.category.toLowerCase().includes(q) ||
        p.searchedAs.toLowerCase().includes(q) ||
        p.whatItIs.toLowerCase().includes(q) ||
        p.researchedFor.toLowerCase().includes(q)
      );
    });
  }, [query, cat]);

  return (
    <div className="space-y-5">
      <QuickTake
        points={[
          "You don't need to memorize this — search it when a customer asks.",
          "Match the person to one desire (Glow, Recover, Lean, Optimize), then pick from that shelf.",
          "Open any peptide for the plain-English pitch, selling angles, and the compliant line.",
        ]}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a]" />
          <input
            type="text"
            placeholder="Search peptides by name, category, or what it does"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full glass-surface rounded-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[#64717a] focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const active = cat === c;
          const Icon = c === "All" ? FlaskConical : CATEGORY_META[c].icon;
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] font-sans transition-colors ${
                active
                  ? "bg-[#242526] text-white"
                  : "glass-surface text-[#64717a] hover:text-[#20282c]"
              }`}
            >
              <Icon className="h-3 w-3" />
              {c}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="glass-surface rounded-lg p-10 text-center text-sm text-[#64717a]">
          No peptides match that search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((p) => {
            const open = openName === p.name;
            const Icon = CATEGORY_META[p.category].icon;
            return (
              <div key={p.name} className="glass-surface rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenName(open ? null : p.name)}
                  className="w-full text-left p-5 flex items-start gap-4 hover:bg-[#242526]/[0.03] transition-colors"
                  aria-expanded={open}
                >
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#242526] text-white shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium tracking-tight">{p.name}</h3>
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-0.5 rounded-full border ${DESIRE_META[p.desire].tone}`}
                      >
                        {DESIRE_META[p.desire].label}
                      </span>
                    </div>
                    {p.aka && (
                      <p className="text-xs text-[#64717a] mt-0.5">{p.aka}</p>
                    )}
                    {!open && (
                      <p className="text-sm text-[#64717a] mt-2 line-clamp-2">
                        {p.whatItIs}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 text-[#64717a] shrink-0 transition-transform ${
                      open ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-5 pt-0 space-y-4">
                    <Detail label="What it is (in plain English)" body={p.whatItIs} />
                    {p.howItWorks && (
                      <div className="rounded-lg bg-[#242526] text-white p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/55 mb-1.5 flex items-center gap-1.5">
                          <Lightbulb className="h-3 w-3" /> How it works (say
                          this)
                        </p>
                        <p className="text-sm text-white/90 leading-relaxed">
                          {p.howItWorks}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Detail label="Researched / talked-about for" body={p.researchedFor} />
                      {p.whoBuys && (
                        <Detail label="Who's buying, and why" body={p.whoBuys} />
                      )}
                    </div>
                    <div className="rounded-lg border border-[#242526]/8 bg-[#242526]/[0.02] p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3 flex items-center gap-1.5">
                        <Megaphone className="h-3 w-3" /> Selling angle ideas
                        (rotate these)
                      </p>
                      <ul className="space-y-4">
                        {p.angles.map((a, ai) => (
                          <li key={ai} className="border-l-2 border-[#242526]/15 pl-3">
                            <p className="text-sm font-medium text-[#20282c]">
                              {a.title}
                            </p>
                            <p className="text-sm text-[#20282c] italic mt-1 leading-relaxed">
                              &ldquo;{a.hook}&rdquo;
                            </p>
                            <p className="text-xs text-[#64717a] mt-1 leading-relaxed">
                              {a.detail}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {p.whatPeopleSay && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-amber-700 mb-1.5 flex items-center gap-1.5">
                          <Megaphone className="h-3 w-3" /> What people say
                          (anecdotal, report don&apos;t promise)
                        </p>
                        <p className="text-sm text-[#20282c] leading-relaxed">
                          {p.whatPeopleSay}
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-emerald-700 mb-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" /> Keep it compliant
                      </p>
                      <p className="text-sm text-[#20282c] leading-relaxed">
                        {p.compliantLine}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Named stacks (awareness only) */}
      <section className="glass-surface rounded-lg p-6 md:p-7">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Stacks people talk about
          </p>
        </div>
        <h2 className="text-xl font-medium tracking-tight mb-2">
          Named stacks are content gold
        </h2>
        <p className="text-sm text-[#64717a] max-w-2xl mb-5 leading-relaxed">
          They&apos;re memorable and searchable, so you can build a whole series
          on one name. Discuss that these are talked about, never how to run
          them. No dosing, no timing, no protocols.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {STACKS.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-[#242526]/8 bg-[#242526]/[0.02] p-4"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium tracking-tight">{s.name}</p>
                <span
                  className={`text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-0.5 rounded-full border ${DESIRE_META[s.desire].tone}`}
                >
                  {DESIRE_META[s.desire].label}
                </span>
                <span className="text-xs text-[#64717a] font-sans">
                  {s.composition}
                </span>
              </div>
              <p className="text-sm text-[#20282c] mt-2 leading-relaxed">
                Sell it as{" "}
                <span className="font-medium">&ldquo;{s.sellAs}&rdquo;</span>.{" "}
                {s.crossSell}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-[#64717a] leading-relaxed">
        All products are for research use only and not for human consumption.
        Descriptions summarize what each compound has been researched or studied
        for. They are not medical claims, dosing guidance, or treatment advice.
      </p>

      <CompletionPanel
        moduleKey="library"
        done={done}
        onComplete={onComplete}
        onNext={onNext}
        nextLabel="Next: How to sell"
      />
    </div>
  );
}

function Detail({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1">
        {label}
      </p>
      <p className="text-sm text-[#20282c] leading-relaxed">{body}</p>
    </div>
  );
}

/** Dark "if you only read one thing" card at the top of a module. */
function QuickTake({ points }: { points: string[] }) {
  return (
    <section className="rounded-lg bg-[#242526] text-white p-6 md:p-7">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-3.5 w-3.5 text-[#D4FF9E]" />
        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/60">
          The 10-second version
        </p>
      </div>
      <ul className="space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="font-sans text-[#D4FF9E] text-sm leading-6 shrink-0">
              {i + 1}
            </span>
            <p className="text-sm md:text-[15px] text-white/90 leading-relaxed">
              {p}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-white/45 mt-4">
        That&apos;s the gist. The cards below go deeper — tap any of them to
        expand.
      </p>
    </section>
  );
}

/** Card that shows a punchy one-liner and reveals the full detail on tap. */
function ExpandableCard({
  icon: Icon,
  title,
  tldr,
  body,
  step,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tldr: string;
  body: string;
  /** Optional step number shown instead of the icon. */
  step?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-surface rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-5 flex items-start gap-4 hover:bg-[#242526]/[0.03] transition-colors"
        aria-expanded={open}
      >
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#242526] text-white shrink-0">
          {step != null ? (
            <span className="font-sans text-sm">{step}</span>
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium tracking-tight">{title}</h3>
          <p className="text-sm text-[#64717a] mt-1 leading-relaxed">{tldr}</p>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-[#64717a] shrink-0 mt-1 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 sm:pl-[76px]">
          <p className="text-sm text-[#20282c] leading-relaxed">{body}</p>
        </div>
      )}
    </div>
  );
}

/** Objection as a flash card: read the question, think, tap for the answer. */
function ObjectionCard({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-surface rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-5 flex items-center gap-4 hover:bg-[#242526]/[0.03] transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#20282c]">{q}</p>
          {!open && (
            <p className="text-[11px] uppercase tracking-[0.14em] font-sans text-[#64717a] mt-1.5">
              Think of your answer, then tap
            </p>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 text-[#64717a] shrink-0 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] font-sans text-emerald-700 mb-1.5">
              Your answer
            </p>
            <p className="text-sm text-[#20282c] leading-relaxed">{a}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ReconSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </p>
      {children}
    </div>
  );
}

function ReconModule() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RECON_PRODUCTS;
    return RECON_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.aka?.toLowerCase().includes(q) ?? false) ||
        (p.uses?.some((u) => u.toLowerCase().includes(q)) ?? false)
    );
  }, [query]);

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="glass-surface rounded-lg p-5 md:p-6 flex items-start gap-3 border border-amber-500/20 bg-amber-500/[0.05]">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-[#20282c] leading-relaxed">
          This is for customer education and general guidance only. Customers
          should always follow the instructions provided with their specific
          product and consult a licensed healthcare professional before using
          any peptide.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64717a]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a product or goal..."
          className="w-full glass-surface rounded-full pl-11 pr-4 py-3 text-sm outline-none placeholder:text-[#64717a]/70"
        />
      </div>

      {/* Product cards */}
      {filtered.length === 0 ? (
        <div className="glass-surface rounded-lg p-10 text-center text-sm text-[#64717a]">
          No products match that search.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div key={p.name} className="glass-surface rounded-lg p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#242526] text-white shrink-0">
                  <Syringe className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-medium tracking-tight leading-tight">
                    {p.name}
                  </h3>
                  {p.aka && (
                    <p className="text-xs text-[#64717a] mt-0.5">{p.aka}</p>
                  )}
                </div>
              </div>

              {p.contents && (
                <ReconSection icon={FlaskConical} label="Contents">
                  <ul className="text-sm text-[#20282c] space-y-0.5">
                    {p.contents.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </ReconSection>
              )}

              <ReconSection icon={Droplets} label="Reconstitution">
                <ul className="text-sm text-[#20282c] space-y-1">
                  {p.reconstitution.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#242526]/40 shrink-0" />
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </ReconSection>

              {p.concentration && (
                <ReconSection icon={Ruler} label="Concentration">
                  <ul className="text-sm text-[#20282c] space-y-0.5 font-sans">
                    {p.concentration.map((c) => (
                      <li key={c} className="leading-relaxed">
                        {c}
                      </li>
                    ))}
                  </ul>
                </ReconSection>
              )}

              <div className="rounded-lg bg-[#242526] text-white p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/55 mb-1.5">
                  Typical dosage
                </p>
                <ul className="text-sm text-white/90 space-y-0.5">
                  {p.dosage.map((d) => (
                    <li key={d} className="leading-relaxed">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {p.uses && (
                <ReconSection icon={Sparkles} label="Common uses">
                  <div className="flex flex-wrap gap-1.5">
                    {p.uses.map((u) => (
                      <span
                        key={u}
                        className="text-xs px-2.5 py-1 rounded-full border border-[#242526]/10 bg-[#242526]/[0.03] text-[#20282c]"
                      >
                        {u}
                      </span>
                    ))}
                  </div>
                </ReconSection>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bacteriostatic water */}
      <section className="glass-surface rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Droplets className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            The essential companion
          </p>
        </div>
        <h2 className="text-xl font-medium tracking-tight mb-3">
          Bacteriostatic Water
        </h2>
        <p className="text-sm text-[#20282c] leading-relaxed max-w-2xl mb-5">
          Bacteriostatic water is sterile water containing 0.9% benzyl alcohol,
          which helps inhibit bacterial growth and allows for multiple
          withdrawals from the vial.
        </p>
        <ReconSection icon={Snowflake} label="Storage">
          <ul className="text-sm text-[#20282c] space-y-1.5">
            {BAC_STORAGE.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#242526]/40 shrink-0" />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </ReconSection>
      </section>

      {/* General tips */}
      <section className="glass-surface rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="h-4 w-4 text-[#64717a]" />
          <h2 className="text-xl font-medium tracking-tight">
            General reconstitution tips
          </h2>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
          {RECON_TIPS.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-sm text-[#20282c]">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#242526] shrink-0" />
              <span className="leading-relaxed">{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-[#64717a] leading-relaxed">
        This guide is for educational purposes and general reference. Dosing
        protocols may vary based on the individual&apos;s health status, goals,
        and guidance from a licensed healthcare professional. All products are
        for research use only.
      </p>
    </div>
  );
}

function SellModule({
  done,
  onComplete,
  onNext,
}: {
  done: boolean;
  onComplete: () => void;
  onNext: () => void;
}) {
  const desires: Desire[] = ["Glow", "Recover", "Lean", "Optimize"];
  return (
    <div className="space-y-6">
      <QuickTake
        points={[
          "Sell desire (glow, recovery, lean, longevity) + trust (COA, Swiss standard). Never medical claims.",
          "Content's only job: get people into your DMs or onto your link. The sale happens there.",
          "Close every sale on the trust wedge, then nudge Subscribe & Save for repeat commission.",
        ]}
      />

      {/* Core principle */}
      <section className="glass-accent rounded-lg p-6 md:p-8 text-white">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-white/70" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/70">
            The one principle
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight max-w-2xl">
          You&apos;re not selling &ldquo;a drug that treats X.&rdquo; You&apos;re
          selling a desire and an identity, wrapped in trust.
        </h2>
        <p className="text-white/70 mt-3 max-w-2xl leading-relaxed">
          Glow, recovery, leanness, longevity, being early: that&apos;s the
          desire. The COA, third-party testing, and Swiss standard are the
          trust. Sell hard on desire and trust; never touch the medical claim,
          because that&apos;s what moves accounts to the banned list.
        </p>
      </section>

      {/* Trust wedge */}
      <section className="glass-surface rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Teach this before any compound
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mb-2">
          The IQON trust wedge
        </h2>
        <p className="text-sm text-[#64717a] max-w-2xl mb-5 leading-relaxed">
          This is the actual differentiator and the safest high-converting
          message in the niche. Every affiliate should be able to say it in one
          breath.
        </p>
        <ul className="space-y-3 max-w-2xl">
          {TRUST_WEDGE.map((t, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm text-[#20282c] leading-relaxed">{t}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Four desires framework */}
      <section className="glass-surface rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            The whole catalog maps here
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mb-2">
          The four desires you&apos;re selling to
        </h2>
        <p className="text-sm text-[#64717a] max-w-2xl mb-5 leading-relaxed">
          This is how the audience already thinks. Match a person to one desire,
          then pick from that shelf. Glow and Optimize are your safest and most
          repeatable lanes; Recover and Lean convert hardest but need the
          tightest phrasing, so there you sell the desire and never the
          protocol.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {desires.map((j) => (
            <div
              key={j}
              className={`rounded-lg border p-4 ${DESIRE_META[j].tone}`}
            >
              <p className="font-medium tracking-tight">{DESIRE_META[j].label}</p>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {DESIRE_META[j].blurb}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How the sale actually happens */}
      <section className="glass-surface rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Read this first
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mb-2">
          Your content&apos;s only job is to drive people to your DMs or your
          link in bio
        </h2>
        <p className="text-sm text-[#64717a] max-w-2xl mb-5 leading-relaxed">
          You almost never sell inside the video itself. A post or Reel exists
          to get someone curious enough to raise their hand, and then the real
          selling happens in the DM or on the page behind your link. If your
          content doesn&apos;t send people somewhere, it doesn&apos;t make you
          money. Every post needs one clear next step.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#242526]/8 bg-[#242526]/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1">
              Step 1 &middot; The content
            </p>
            <p className="text-sm text-[#20282c] leading-relaxed">
              Hook them with the desire or the mechanism. End with a clear call
              to action: &ldquo;comment GLOW and I&apos;ll send it&rdquo; or
              &ldquo;link in bio.&rdquo;
            </p>
          </div>
          <div className="rounded-lg border border-[#242526]/8 bg-[#242526]/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1">
              Step 2 &middot; The DM or bio link
            </p>
            <p className="text-sm text-[#20282c] leading-relaxed">
              This is where you actually sell. Answer the trust question, match
              them to one product, and hand them your discount code and link.
              Comment-to-DM automation converts far better than a bio link
              alone.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-emerald-700 mb-1">
              Step 3 &middot; The sale
            </p>
            <p className="text-sm text-[#20282c] leading-relaxed">
              They buy with your code, so it&apos;s tracked to you. Nudge
              Subscribe &amp; Save to lock in recurring commission.
            </p>
          </div>
        </div>
        <p className="text-xs text-[#64717a] mt-4 leading-relaxed">
          Keep this flow in mind for everything below. The steps and tactics
          that follow are all in service of getting someone into your DMs or
          onto your link, and then closing them there.
        </p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="h-4 w-4 text-[#64717a]" />
          <h2 className="text-xl font-medium tracking-tight">
            The four moves of every sale
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SELL_STEPS.map((s, i) => (
            <ExpandableCard
              key={s.title}
              icon={s.icon}
              step={i + 1}
              title={s.title}
              tldr={s.tldr}
              body={s.body}
            />
          ))}
        </div>
      </section>

      {/* Conversion tactics */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-[#64717a]" />
          <h2 className="text-xl font-medium tracking-tight">
            What actually converts
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONVERSION_TACTICS.map((t) => (
            <ExpandableCard
              key={t.title}
              icon={t.icon}
              title={t.title}
              tldr={t.tldr}
              body={t.body}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-4 w-4 text-[#64717a]" />
          <h2 className="text-xl font-medium tracking-tight">Objection handling</h2>
        </div>
        <p className="text-sm text-[#64717a] mb-4">
          Treat these like flash cards: read the objection, say your answer out
          loud, then tap to compare.
        </p>
        <div className="space-y-3">
          {OBJECTIONS.map((o) => (
            <ObjectionCard key={o.q} q={o.q} a={o.a} />
          ))}
        </div>
      </section>

      <CompletionPanel
        moduleKey="sell"
        done={done}
        onComplete={onComplete}
        onNext={onNext}
        nextLabel="Next: Content & socials"
      />
    </div>
  );
}

function SocialModule({
  done,
  onComplete,
  onNext,
}: {
  done: boolean;
  onComplete: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <QuickTake
        points={[
          "The line is claims, not the topic. Educate freely; never promise outcomes, dosing, or cures.",
          "No purchase links on YouTube. No selling on TikTok Shop. Ever.",
          "Swap flagged words: say 'researched for', never 'treats' — and never name prescription drugs.",
        ]}
      />

      {/* Why it matters */}
      <section className="rounded-lg p-6 md:p-7 bg-amber-50/80 border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-4 w-4 text-amber-700" />
          <h2 className="text-lg font-medium tracking-tight text-amber-900">
            Why this matters (people are getting banned)
          </h2>
        </div>
        <ul className="space-y-2.5 max-w-2xl">
          {SOCIAL_WHY.map((w, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" />
              <p className="text-sm text-amber-900/85 leading-relaxed">{w}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Hard walls */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            The hard walls
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mb-4">
          Platform lines you can&apos;t cross
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {HARD_WALLS.map((w) => (
            <div
              key={w.platform}
              className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <h3 className="font-medium tracking-tight">{w.platform}</h3>
              </div>
              <p className="text-sm text-[#64717a] leading-relaxed">{w.rule}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Word swaps */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Say this, not that
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mb-2">
          Swap the words that get you flagged
        </h2>
        <p className="text-sm text-[#64717a] max-w-2xl mb-5 leading-relaxed">
          Platforms moderate on words and behavior. These swaps keep you in the
          compliant, research-use lane, which is also what keeps your reach and
          your account alive.
        </p>
        <div className="space-y-3">
          {WORD_SWAPS.map((s, i) => (
            <div key={i} className="glass-surface rounded-lg p-5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:items-center">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-[#20282c]">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-red-500 block mb-0.5">
                      Avoid
                    </span>
                    {s.avoid}
                  </p>
                </div>
                <ArrowRight className="hidden md:block h-4 w-4 text-[#64717a] mx-auto" />
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-[#20282c]">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-emerald-600 block mb-0.5">
                      Say instead
                    </span>
                    {s.instead}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-[#64717a] mt-3 pt-3 border-t border-[#242526]/5 leading-relaxed">
                {s.why}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Do / Don't */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-surface rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-lg font-medium tracking-tight">Do</h3>
          </div>
          <ul className="space-y-3">
            {SOCIAL_DO.map((d, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-[#20282c] leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-surface rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-4 w-4 text-red-500" />
            <h3 className="text-lg font-medium tracking-tight">Don&apos;t</h3>
          </div>
          <ul className="space-y-3">
            {SOCIAL_DONT.map((d, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-[#20282c] leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Winning hooks */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="h-4 w-4 text-[#64717a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Steal these hooks
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mb-4">
          Hook templates that actually perform
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOCIAL_HOOKS.map((h) => (
            <div key={h.name} className="glass-surface rounded-lg p-5">
              <h3 className="font-medium tracking-tight">{h.name}</h3>
              <p className="text-sm text-[#64717a] mt-1.5 leading-relaxed">
                {h.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Format vs compliance */}
      <section className="glass-surface rounded-lg p-2 md:p-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
              <th className="px-3 py-3">Format</th>
              <th className="px-3 py-3">Reach</th>
              <th className="px-3 py-3">IQON-safe?</th>
            </tr>
          </thead>
          <tbody>
            {FORMAT_GRID.map((f) => (
              <tr key={f.format} className="border-t border-[#242526]/5">
                <td className="px-3 py-3 text-[#20282c]">{f.format}</td>
                <td className="px-3 py-3 text-[#64717a] whitespace-nowrap">
                  {f.reach}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] font-sans ${RISK_META[f.safe].tone}`}
                  >
                    {f.safe === "safe" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {f.safe === "safe"
                      ? "Yes"
                      : f.safe === "care"
                        ? "Only if claim-free"
                        : "No"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Trends */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-surface rounded-lg p-6">
          <h3 className="text-lg font-medium tracking-tight mb-3">Rising</h3>
          <ul className="space-y-2.5">
            {TRENDS_RISING.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-sm text-[#20282c] leading-relaxed">{t}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-surface rounded-lg p-6">
          <h3 className="text-lg font-medium tracking-tight mb-3">
            Fading or dangerous
          </h3>
          <ul className="space-y-2.5">
            {TRENDS_FADING.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <p className="text-sm text-[#20282c] leading-relaxed">{t}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="text-[11px] text-[#64717a] leading-relaxed">
        Platform rules change often and differ by country and account type. This
        is general brand-safety guidance, not legal advice. When a platform
        gives you a specific policy or warning, follow it. The goal isn&apos;t
        to trick moderation; it&apos;s to stay genuinely compliant by keeping
        everything in the research-use-only frame.
      </p>

      <CompletionPanel
        moduleKey="social"
        done={done}
        onComplete={onComplete}
        onNext={onNext}
        nextLabel="Next: Play it safe"
      />
    </div>
  );
}

function RulesModule({
  done,
  onComplete,
  onNext,
}: {
  done: boolean;
  onComplete: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg p-6 md:p-7 bg-amber-50/80 border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <h2 className="text-lg font-medium tracking-tight text-amber-900">
            The golden rule
          </h2>
        </div>
        <p className="text-sm text-amber-900/80 leading-relaxed max-w-2xl">
          Everything IQON sells is <strong>For Research Use Only</strong>. Your
          credibility, and ours, depends on staying in that lane. Sell the
          proof and the science, never a medical outcome.
        </p>
      </section>

      <section className="glass-surface rounded-lg p-6 md:p-7">
        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-4">
          Keep it clean
        </p>
        <ul className="space-y-3">
          {RULES.map((r, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#242526]/5 text-[#64717a] font-sans text-xs shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-[#20282c] leading-relaxed">{r}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass-accent rounded-lg p-7 text-white">
        <ShieldCheck className="h-6 w-6 text-white/70 mb-3" />
        <h3 className="text-xl font-medium tracking-tight max-w-xl">
          Trust compounds faster than any single sale.
        </h3>
        <p className="text-white/70 mt-2 max-w-xl leading-relaxed">
          The affiliates who win biggest are the ones customers come back to. Be
          the honest, knowledgeable source, and the reorders and referrals take
          care of the rest.
        </p>
      </section>

      <CompletionPanel
        moduleKey="rules"
        done={done}
        onComplete={onComplete}
        onNext={onNext}
        nextLabel="Finish the course"
      />
    </div>
  );
}
