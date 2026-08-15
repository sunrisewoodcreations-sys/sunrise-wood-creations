export type ProductKey = "cornhole-boards" | "wooden-signs" | "planter-boxes" | "cutting-boards";

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
  imageUrl: string | null;
}

export interface SiteContent {
  hero: {
    heading: string;
    subheading: string;
    ctaText: string;
    secondaryCtaText: string;
  };
  contact: {
    phone: string;
    email: string;
  };
  products: Record<ProductKey, ProductContent>;
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
  hero: {
    heading: "Built by hand.\nMade to last.",
    subheading: "Custom cornhole boards, wooden signs, planter boxes, and cutting boards — crafted to order, one piece at a time.",
    ctaText: "Request a Custom Order",
    secondaryCtaText: "View Our Work"
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
      imageUrl: null
    },
    "wooden-signs": {
      enabled: true,
      name: "Wooden signs",
      tagline: "Personalized signs for your home or business.",
      description: "From farmhouse-style family name signs to business signage, each piece is cut, sanded, and finished by hand.",
      shortDesc: "Personalized family names, farmhouse decor, business signage.",
      imageUrl: null
    },
    "planter-boxes": {
      enabled: true,
      name: "Planter boxes",
      tagline: "Cedar and pine planters built to last outdoors.",
      description: "Built with weather-resistant wood and finished to hold up season after season.",
      shortDesc: "Cedar and pine planters built for porches, gardens, and patios.",
      imageUrl: null
    },
    "cutting-boards": {
      enabled: true,
      name: "Cutting boards",
      tagline: "End-grain and edge-grain boards, personalized.",
      description: "A functional piece and a keepsake — great for everyday use or as a gift.",
      shortDesc: "End-grain and edge-grain boards, engraved names and dates.",
      imageUrl: null
    }
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
    heading: "Have something else in mind?",
    subheading: "Tell us what you're looking for and we'll work with you to create it.",
    ctaText: "Request a Custom Order"
  }
};
