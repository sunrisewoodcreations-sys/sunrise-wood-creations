export type ProductKey = "cornhole-boards" | "wooden-signs" | "planter-boxes" | "cutting-boards";

export interface ProductContent {
  enabled: boolean;
  name: string;
  tagline: string;
  description: string;
  shortDesc: string;
}

export interface SiteContent {
  hero: {
    heading: string;
    subheading: string;
    ctaText: string;
  };
  contact: {
    phone: string;
    email: string;
  };
  products: Record<ProductKey, ProductContent>;
}

export const PRODUCT_ORDER: ProductKey[] = ["cornhole-boards", "wooden-signs", "planter-boxes", "cutting-boards"];

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    heading: "Built by hand.\nMade to last.",
    subheading: "Custom cornhole boards, wooden signs, planter boxes, and cutting boards — crafted to order, one piece at a time.",
    ctaText: "Request a custom order"
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
      shortDesc: "Regulation-size sets, custom painted tops, your logo or design."
    },
    "wooden-signs": {
      enabled: true,
      name: "Wooden signs",
      tagline: "Personalized signs for your home or business.",
      description: "From farmhouse-style family name signs to business signage, each piece is cut, sanded, and finished by hand.",
      shortDesc: "Personalized family names, farmhouse decor, business signage."
    },
    "planter-boxes": {
      enabled: true,
      name: "Planter boxes",
      tagline: "Cedar and pine planters built to last outdoors.",
      description: "Built with weather-resistant wood and finished to hold up season after season.",
      shortDesc: "Cedar and pine planters built for porches, gardens, and patios."
    },
    "cutting-boards": {
      enabled: true,
      name: "Cutting boards",
      tagline: "End-grain and edge-grain boards, personalized.",
      description: "A functional piece and a keepsake — great for everyday use or as a gift.",
      shortDesc: "End-grain and edge-grain boards, engraved names and dates."
    }
  }
};
