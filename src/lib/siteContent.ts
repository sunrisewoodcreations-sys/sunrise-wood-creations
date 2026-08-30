export type ProductKey = "cornhole-boards" | "wooden-signs" | "planter-boxes" | "cutting-boards";

// FAQ categories deliberately reuse the exact same slug values as
// ProductKey, plus "general" — this makes mapping a category to its
// matching product page a direct, trivial lookup, not a separate
// translation table that could drift out of sync.
export type FaqCategory = "general" | ProductKey;
export const FAQ_CATEGORY_ORDER: FaqCategory[] = ["general", "cornhole-boards", "wooden-signs", "planter-boxes", "cutting-boards"];
export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  "general": "General",
  "cornhole-boards": "Cornhole Boards",
  "wooden-signs": "Wooden Signs",
  "planter-boxes": "Planter Boxes",
  "cutting-boards": "Cutting Boards"
};

// Bridges the public site's product slugs to the internal ProductType
// values already used by the order system and QuoteRequestForm's
// dropdown (see statusSteps.ts) — lets a product page pre-select the
// right category on the quote form without either side needing to
// know about the other's naming.
export const PRODUCT_KEY_TO_ORDER_TYPE: Record<ProductKey, string> = {
  "cornhole-boards": "cornhole",
  "wooden-signs": "sign",
  "planter-boxes": "planter",
  "cutting-boards": "cutting_board"
};


export interface ProductContent {
  enabled: boolean;
  name: string;
  tagline: string;
  description: string;
  shortDesc: string;
  // No real product photography exists in the project yet. This stays
  // null until a real photo is actually added — the homepage card
  // component checks this and falls back to a clean, clearly-labeled
  // placeholder rather than ever inventing or guessing at an image.
  // Once a real URL is set here, the card automatically shows the
  // real photo — nothing else about the section needs to change.
  // Used only for the small homepage grid card thumbnail — the
  // product detail page's carousel uses `images` below instead.
  imageUrl: string | null;
  // A real multi-photo gallery for this product's own detail page,
  // same shape as hero.carouselSlides so the exact same HeroCarousel
  // component can be reused unmodified — swipe, autoplay, dots, and
  // arrows all appear automatically once more than one slide has a
  // real photo, exactly like the homepage carousel already does.
  images: { src: string | null; alt: string }[];
}

export interface SiteContent {
  // "live" if unset — matches middleware's fail-open default, so a
  // brand new site_settings row (or one saved before this field
  // existed) never accidentally locks visitors out.
  websiteStatus?: "coming_soon" | "live";
  hero: {
    heading: string;
    subheading: string;
    ctaText: string;
    secondaryCtaText: string;
    // Same null-until-real pattern as ProductContent.imageUrl above —
    // shows an honest placeholder per slide until a real photo is set,
    // never a stock or invented image.
    carouselSlides: { src: string | null; alt: string }[];
  };
  contact: {
    phone: string;
    email: string;
  };
  products: Record<ProductKey, ProductContent>;
  howItWorks: {
    heading: string;
    steps: { title: string; description: string }[];
  };
  whyUs: {
    heading: string;
    items: { title: string; description: string }[];
  };
  customCta: {
    heading: string;
    subheading: string;
    ctaText: string;
  };
}

export const PRODUCT_ORDER: ProductKey[] = ["cornhole-boards", "wooden-signs", "planter-boxes", "cutting-boards"];

export const DEFAULT_SITE_CONTENT: SiteContent = {
  websiteStatus: "live",
  hero: {
    heading: "Built by hand.\nMade to last.",
    subheading: "Custom cornhole boards, wooden signs, planter boxes, and cutting boards — crafted to order, one piece at a time.",
    ctaText: "Request a Custom Order",
    secondaryCtaText: "View Our Work",
    // 5 slides matching the 4 product categories plus one general
    // finished-project shot — replace each src with a real photo when
    // available; alt text is a hint for which photo goes where.
    carouselSlides: [
      { src: null, alt: "Custom cornhole boards built by Sunrise Wood Creations" },
      { src: null, alt: "Personalized wooden sign built by Sunrise Wood Creations" },
      { src: null, alt: "Cedar planter box built by Sunrise Wood Creations" },
      { src: null, alt: "Custom cutting board built by Sunrise Wood Creations" },
      { src: null, alt: "A finished Sunrise Wood Creations project" }
    ]
  },
  contact: {
    phone: "(269) 762-1460",
    email: "sunrisewoodcreations@gmail.com"
  },
  products: {
    "cornhole-boards": {
      enabled: true,
      name: "Cornhole boards",
      tagline: "Regulation-size sets, built and painted to order.",
      description: "Every set is built from scratch and finished with your custom design.",
      shortDesc: "Regulation-size sets, custom painted tops, your logo or design.",
      imageUrl: null,
      images: [
        { src: null, alt: "Cornhole boards built by Sunrise Wood Creations" },
        { src: null, alt: "Cornhole boards built by Sunrise Wood Creations" },
        { src: null, alt: "Cornhole boards built by Sunrise Wood Creations" },
        { src: null, alt: "Cornhole boards built by Sunrise Wood Creations" }
      ]
    },
    "wooden-signs": {
      enabled: true,
      name: "Wooden signs",
      tagline: "Personalized signs for your home or business.",
      description: "From farmhouse-style family name signs to business signage, each piece is cut, sanded, and finished by hand.",
      shortDesc: "Personalized family names, farmhouse decor, business signage.",
      imageUrl: null,
      images: [
        { src: null, alt: "Wooden signs built by Sunrise Wood Creations" },
        { src: null, alt: "Wooden signs built by Sunrise Wood Creations" },
        { src: null, alt: "Wooden signs built by Sunrise Wood Creations" },
        { src: null, alt: "Wooden signs built by Sunrise Wood Creations" }
      ]
    },
    "planter-boxes": {
      enabled: true,
      name: "Planter boxes",
      tagline: "Cedar and pine planters built to last outdoors.",
      description: "Built with weather-resistant wood and finished to hold up season after season.",
      shortDesc: "Cedar and pine planters built for porches, gardens, and patios.",
      imageUrl: null,
      images: [
        { src: null, alt: "Planter boxes built by Sunrise Wood Creations" },
        { src: null, alt: "Planter boxes built by Sunrise Wood Creations" },
        { src: null, alt: "Planter boxes built by Sunrise Wood Creations" },
        { src: null, alt: "Planter boxes built by Sunrise Wood Creations" }
      ]
    },
    "cutting-boards": {
      enabled: true,
      name: "Cutting boards",
      tagline: "End-grain and edge-grain boards, personalized.",
      description: "A functional piece and a keepsake — great for everyday use or as a gift.",
      shortDesc: "End-grain and edge-grain boards, engraved names and dates.",
      imageUrl: null,
      images: [
        { src: null, alt: "Cutting boards built by Sunrise Wood Creations" },
        { src: null, alt: "Cutting boards built by Sunrise Wood Creations" },
        { src: null, alt: "Cutting boards built by Sunrise Wood Creations" },
        { src: null, alt: "Cutting boards built by Sunrise Wood Creations" }
      ]
    }
  },
  howItWorks: {
    heading: "How It Works",
    steps: [
      { title: "Tell Us What You Want", description: "Reach out with what you're picturing — size, style, and any customization." },
      { title: "We Work Out the Details", description: "We'll go over sizing, wood type, and design before anything gets built." },
      { title: "We Build Your Order", description: "Every piece is built to order, by hand, one at a time." },
      { title: "Pick It Up", description: "We'll let you know as soon as it's ready to pick up." }
    ]
  },
  whyUs: {
    heading: "Why Sunrise Wood Creations?",
    items: [
      { title: "Handmade, locally", description: "Every piece is built right here in Michigan, not mass-produced." },
      { title: "Built to order", description: "Nothing sits on a shelf — your piece is made specifically for you." },
      { title: "Custom designs", description: "Sizes, colors, and personalization worked out with you directly." },
      { title: "Quality materials", description: "Real wood, finished to hold up to actual daily use." }
    ]
  },
  customCta: {
    heading: "Have an idea? Let's build it.",
    subheading: "Tell us what you're looking for and we'll work with you to create it.",
    ctaText: "Request a Custom Order"
  }
};
