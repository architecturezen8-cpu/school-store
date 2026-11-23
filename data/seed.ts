/* ------------------------------------------------------------------ *
 *  SEED CONTENT — the catalogue the store ships with.
 *  The database is seeded from this file (npm run db:seed), and every page
 *  falls back to it when DATABASE_URL is not configured, so the site can
 *  never render empty.
 * ------------------------------------------------------------------ */

const catBadges = "/images/cat-badges.jpg";
const catUniform = "/images/cat-uniform.jpg";
const catTickets = "/images/cat-tickets.jpg";
const hero1 = "/images/hero-1.jpg";
const hero2 = "/images/hero-2.jpg";
const hero3 = "/images/hero-3.jpg";
const productHoodie = "/images/product-hoodie.jpg";
const productMug = "/images/product-mug.jpg";
const productScarf = "/images/product-scarf.jpg";
const productCap = "/images/product-cap.jpg";

/* ---- stock imagery for the newer collections ---- */
const imgPaper1 =
  "https://images.pexels.com/photos/20140155/pexels-photo-20140155.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const imgPaper2 =
  "https://images.pexels.com/photos/13583358/pexels-photo-13583358.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const imgPaper3 =
  "https://images.pexels.com/photos/37793421/pexels-photo-37793421.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const imgShirts =
  "https://images.pexels.com/photos/8146450/pexels-photo-8146450.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const imgMedals =
  "https://images.pexels.com/photos/11659349/pexels-photo-11659349.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export type Category = {
  slug: string;
  title: string;
  desc: string;
  image: string;
  count: string;
};

export type Product = {
  slug: string;
  name: string;
  price: number;
  image: string;
  tag?: string;
  category: string; // category slug
  rating: number;
  reviews: number;
  description: string;
  details: string[];
  options?: { label: string; values: string[] };
  isFeatured?: boolean;
  isNew?: boolean;
  gallery?: string[];
  colours?: string[];
};

export const lkr = (n: number) => `LKR ${n.toLocaleString("en-US")}`;

/** Extra product angles — reused across the catalogue. */
const shotA = imgShirts;
const shotB = imgMedals;
const shotC = catUniform;
const shotD = imgPaper2;
const shotE = imgPaper3;

/* ------------------------------------------------------------------ */
/*  HERO                                                              */
/* ------------------------------------------------------------------ */
export const heroSlides = [
  { image: hero1, caption: "The College at dusk" },
  { image: hero2, caption: "The long corridor" },
  { image: hero3, caption: "The crest we wear" },
];

/* ------------------------------------------------------------------ */
/*  SELLING CATEGORIES                                                */
/* ------------------------------------------------------------------ */
export const categories: Category[] = [
  {
    slug: "badges",
    title: "Badges",
    desc: "Prefect, host & society badges — small pieces of metal, worn with honour.",
    image: catBadges,
    count: "16 badges",
  },
  {
    slug: "uniforms",
    title: "Uniforms",
    desc: "Regulation uniforms, shirts and ties — tailored to the college standard.",
    image: catUniform,
    count: "24 essentials",
  },
  {
    slug: "event-clothings",
    title: "Event Clothings",
    desc: "Big Match hoodies, scarves and caps for the occasions that matter.",
    image: catTickets,
    count: "18 pieces",
  },
  {
    slug: "exam-writing-papers",
    title: "Exam Writing Papers",
    desc: "Ruled pads, answer booklets and pens — exam-ready, every single time.",
    image: imgPaper1,
    count: "12 items",
  },
  {
    slug: "batch-shirts",
    title: "Batch Shirts",
    desc: "Class of ’25 batch tees and shirts — your year, printed with pride.",
    image: imgShirts,
    count: "9 designs",
  },
];

/* ------------------------------------------------------------------ */
/*  PRODUCTS                                                          */
/* ------------------------------------------------------------------ */
export const products: Product[] = [
  /* ---- Badges ---- */
  {
    slug: "prefect-badge",
    gallery: [shotB, shotC, shotD],
    colours: ["Gold", "Silver"],
    name: "Prefect Badge — Gold",
    price: 850,
    image: catBadges,
    tag: "Official",
    category: "badges",
    rating: 5,
    reviews: 41,
    description:
      "The full college crest in polished gold, issued to serving prefects. Pin-back clasp with a protective lacquer finish.",
    details: ["Polished gold-tone alloy", "Pin-back clasp", "Individually boxed", "Issued on college approval"],
  },
  {
    slug: "crest-lapel-badge",
    gallery: [shotC, shotD, shotB],
    colours: ["Gold", "Silver"],
    name: "Crest Lapel Badge",
    price: 450,
    image: imgMedals,
    category: "badges",
    rating: 5,
    reviews: 12,
    description:
      "A miniature crest for the blazer lapel — the quiet way to carry the college anywhere.",
    details: ["22mm miniature crest", "Butterfly clutch fitting", "Enamel fill", "Suitable for blazers"],
  },
  {
    slug: "house-badge-set",
    gallery: [shotD, shotB, shotC],
    colours: ["Gold"],
    name: "House Badge Set",
    price: 1200,
    image: imgMedals,
    tag: "Set of 4",
    category: "badges",
    rating: 4,
    reviews: 8,
    description:
      "All four house badges in one presentation set, each in its own house colour.",
    details: ["Four house crests", "Velvet presentation tray", "Colour-matched enamel", "Gift boxed"],
  },

  /* ---- Uniforms ---- */
  {
    slug: "regulation-white-shirt",
    gallery: [shotC, shotA, shotE],
    colours: ["White", "Sky", "Khaki"],
    name: "Regulation White Shirt",
    price: 2200,
    image: catUniform,
    tag: "Official",
    category: "uniforms",
    rating: 5,
    reviews: 63,
    description:
      "The standard college shirt in crisp white poplin, cut to the regulation pattern with a crest-ready pocket.",
    details: ["White cotton poplin", "Regulation college cut", "Crest-ready chest pocket", "Sizes S – XXL"],
    options: { label: "Size", values: ["S", "M", "L", "XL", "XXL"] },
  },
  {
    slug: "college-tie",
    gallery: [shotC, shotB, shotD],
    colours: ["Navy", "Maroon"],
    name: "College Tie",
    price: 1450,
    image: catUniform,
    category: "uniforms",
    rating: 5,
    reviews: 27,
    description:
      "The college stripe tie, woven in the official colours and finished with a weighted tip.",
    details: ["Woven silk-blend", "Official college stripe", "Weighted tip", "Length 148cm"],
  },
  {
    slug: "navy-blazer",
    gallery: [shotC, shotA, shotB],
    colours: ["Navy", "Black"],
    isNew: true,
    name: "Navy College Blazer",
    price: 9800,
    image: catUniform,
    tag: "Premium",
    category: "uniforms",
    rating: 5,
    reviews: 19,
    description:
      "The formal blazer in deep college navy, crest-embroidered on the breast pocket.",
    details: ["Wool-blend navy shell", "Embroidered crest", "Satin lining", "Sizes 32 – 46"],
    options: { label: "Size", values: ["32", "34", "36", "38", "40", "42", "44", "46"] },
  },

  /* ---- Event Clothings ---- */
  {
    slug: "crest-hoodie",
    gallery: [shotA, shotC, shotB],
    colours: ["Navy", "Black", "Grey"],
    isFeatured: true,
    name: "Crest Hoodie — Navy",
    price: 4500,
    image: productHoodie,
    tag: "Best Seller",
    category: "event-clothings",
    rating: 5,
    reviews: 34,
    description:
      "Heavyweight fleece hoodie in college navy with the crest embroidered across the chest. Built for cold Big Match mornings.",
    details: ["320gsm brushed fleece", "Embroidered gold crest", "Kangaroo pocket", "Sizes S – XXL"],
    options: { label: "Size", values: ["S", "M", "L", "XL", "XXL"] },
  },
  {
    slug: "animo-et-fide-scarf",
    gallery: [shotC, shotA, shotD],
    colours: ["Navy"],
    isFeatured: true,
    name: "Animo et Fide Scarf",
    price: 2100,
    image: productScarf,
    tag: "Official",
    category: "event-clothings",
    rating: 5,
    reviews: 27,
    description:
      "The college scarf in woven wool, striped in the official colours with the motto woven into the hem.",
    details: ["Woven wool blend", "Official college stripes", "Woven motto hem", "180cm × 22cm"],
  },
  {
    slug: "1873-crest-cap",
    gallery: [shotA, shotB, shotC],
    colours: ["Navy", "Black"],
    isFeatured: true,
    name: "1873 Crest Cap",
    price: 1800,
    image: productCap,
    tag: "Limited",
    category: "event-clothings",
    rating: 5,
    reviews: 3,
    description:
      "Six-panel cap in college navy with the founding year and crest embroidered on the front panel.",
    details: ["Six-panel construction", "Embroidered 1873 crest", "Adjustable strap", "One size"],
  },
  {
    slug: "heritage-crest-mug",
    gallery: [shotD, shotB, shotA],
    colours: ["Navy", "White"],
    isFeatured: true,
    name: "Heritage Crest Mug",
    price: 1250,
    image: productMug,
    tag: "New",
    category: "event-clothings",
    rating: 4,
    reviews: 18,
    description:
      "A matte navy ceramic mug carrying the full college crest in gold — for the staff room and the study desk alike.",
    details: ["330ml matte ceramic", "Gold crest decal", "Dishwasher safe", "Gift boxed"],
  },

  /* ---- Exam Writing Papers ---- */
  {
    slug: "exam-answer-booklet",
    gallery: [shotE, shotD, shotB],
    colours: ["White"],
    isNew: true,
    name: "Exam Answer Booklet",
    price: 120,
    image: imgPaper1,
    tag: "Exam Ready",
    category: "exam-writing-papers",
    rating: 5,
    reviews: 210,
    description:
      "The standard 16-page answer booklet, ruled to the college examination format and staple-bound.",
    details: ["16 pages", "College exam ruling", "Staple-bound", "Sold in packs of 10"],
  },
  {
    slug: "ruled-writing-pad",
    gallery: [shotD, shotE, shotA],
    colours: ["White"],
    name: "Ruled Writing Pad",
    price: 340,
    image: imgPaper3,
    category: "exam-writing-papers",
    rating: 4,
    reviews: 54,
    description:
      "A50 writing pad with a college crest watermark, glued along the top edge for a clean tear.",
    details: ["A50 pad, 100 sheets", "Crest watermark", "Top-edge glue binding", "70gsm paper"],
  },
  {
    slug: "exam-pen-pack",
    gallery: [shotD, shotE, shotB],
    colours: ["Blue", "Black"],
    isNew: true,
    name: "Exam Pen Pack",
    price: 480,
    image: imgPaper2,
    tag: "Set of 3",
    category: "exam-writing-papers",
    rating: 5,
    reviews: 88,
    description:
      "Three smooth-flow ballpoint pens in college navy, chosen for a full three-hour paper without a refill.",
    details: ["Three ballpoint pens", "0.7mm blue ink", "Soft-touch barrel", "Crest printed"],
  },
  {
    slug: "geometry-set",
    gallery: [shotE, shotD, shotA],
    colours: ["Navy"],
    name: "Geometry Set",
    price: 690,
    image: imgPaper2,
    category: "exam-writing-papers",
    rating: 4,
    reviews: 31,
    description:
      "A complete geometry set in a college-navy tin — ruler, protractor, compass and set squares.",
    details: ["Metal tin case", "Ruler & protractor", "Compass & set squares", "Crest embossed"],
  },

  /* ---- Batch Shirts ---- */
  {
    slug: "batch-tee-2025",
    gallery: [shotA, shotC, shotB],
    colours: ["Navy", "Black", "White"],
    isNew: true,
    name: "Batch Tee — Class of 2025",
    price: 2600,
    image: imgShirts,
    tag: "Batch Exclusive",
    category: "batch-shirts",
    rating: 5,
    reviews: 74,
    description:
      "The official Class of 2025 batch tee, printed with every name on the back panel.",
    details: ["220gsm cotton tee", "Back name panel", "Front crest print", "Sizes S – XXL"],
    options: { label: "Size", values: ["S", "M", "L", "XL", "XXL"] },
  },
  {
    slug: "batch-polo",
    gallery: [shotC, shotA, shotD],
    colours: ["Navy", "Maroon", "Black"],
    name: "Batch Polo Shirt",
    price: 3200,
    image: imgShirts,
    category: "batch-shirts",
    rating: 5,
    reviews: 22,
    description:
      "A collared batch polo in college navy — the smarter option for batch photographs and events.",
    details: ["Pique cotton polo", "Embroidered crest", "Three-button placket", "Sizes S – XXL"],
    options: { label: "Size", values: ["S", "M", "L", "XL", "XXL"] },
  },
  {
    slug: "batch-classroom-shirt",
    gallery: [shotA, shotE, shotC],
    colours: ["White", "Navy"],
    name: "Batch Class Shirt",
    price: 2400,
    image: catTickets,
    category: "batch-shirts",
    rating: 4,
    reviews: 15,
    description:
      "The everyday class shirt, printed with the batch year and crest on the chest.",
    details: ["180gsm cotton shirt", "Chest crest print", "Batch year on sleeve", "Sizes S – XXL"],
    options: { label: "Size", values: ["S", "M", "L", "XL", "XXL"] },
  },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */
export const getCategory = (slug?: string) =>
  categories.find((c) => c.slug === slug);

export const getCategoryProducts = (slug?: string) =>
  slug ? products.filter((p) => p.category === slug) : products;

export const getProduct = (slug: string) =>
  products.find((p) => p.slug === slug);

export const getCategoryName = (slug: string) =>
  categories.find((c) => c.slug === slug)?.title ?? slug;

export const featuredProducts = products.filter((p) => p.isFeatured);

/** Home page only shows these four collections — not the full shop. */
export const homeCategorySlugs = [
  "badges",
  "uniforms",
  "event-clothings",
  "batch-shirts",
];
export const homeCategories = homeCategorySlugs
  .map((slug) => categories.find((c) => c.slug === slug))
  .filter(Boolean) as Category[];

/* ------------------------------------------------------------------ */
/*  REVIEWS                                                           */
/* ------------------------------------------------------------------ */
export const reviews = [
  {
    name: "Shenal Rajapaksa",
    role: "Old Thomian · Class of 2011",
    text: "The crest hoodie is easily the finest college merch I have owned. Quality that truly matches the badge it carries.",
    rating: 5,
  },
  {
    name: "Dinithi Perera",
    role: "Parent · Grade 9",
    text: "Ordered the full uniform set online — delivered in two days, perfect fit, and beautifully wrapped in college colours.",
    rating: 5,
  },
  {
    name: "Sanjula Herath",
    role: "Head Prefect · 2024",
    text: "Big Match tickets sorted in under a minute. The store makes game day completely effortless for the whole school.",
    rating: 5,
  },
  {
    name: "Naveen Fernando",
    role: "Old Thomian · Class of 1998",
    text: "From Matale to Melbourne, this scarf keeps Animo et Fide close. It has become my favourite gift to give.",
    rating: 4,
  },
];

export const searchChips = ["Badges", "Uniforms", "Hoodie", "Batch Tee", "Exam Papers", "Tie"];

/* ------------------------------------------------------------------ */
/*  EVENTS (Big Match, Prize Day, the Ball)                             */
/* ------------------------------------------------------------------ */

export type Tier = {
  id: string;
  name: string;
  price: number;
  perks: string[];
  note?: string;
};

export type CollegeEvent = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  venue: string;
  city: string;
  date: Date;
  doors: string;
  image: string;
  tag?: string;
  featured?: boolean;
  tiers: Tier[];
};

/** Dates are generated relative to today so the countdown never expires. */
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

export const events: CollegeEvent[] = [
  {
    slug: "the-big-match",
    title: "The Big Match",
    subtitle: "St. Thomas’ College Matale vs St. Anthony’s College Kandy",
    description:
      "The 71st encounter. A full day of cricket at the college grounds — the stands, the tent, the band and everything that makes it the one day of the year.",
    venue: "College Grounds",
    city: "Matale",
    date: inDays(46),
    doors: "Gates open 8:00 AM",
    image: hero1,
    tag: "Flagship Event",
    featured: true,
    tiers: [
      {
        id: "standard",
        name: "Standard Entrance",
        price: 500,
        perks: ["Ground access all day", "Standing area behind the bowler's arm"],
      },
      {
        id: "grandstand",
        name: "Grandstand Seat",
        price: 1500,
        perks: ["Reserved numbered seat", "Shaded stand", "Match programme included"],
        note: "Most popular",
      },
      {
        id: "pavilion",
        name: "VIP Pavilion",
        price: 5000,
        perks: [
          "Air seated pavilion",
          "Lunch & refreshments included",
          "Private washrooms",
          "Paired parking",
        ],
        note: "Limited",
      },
    ],
  },
  {
    slug: "big-match-ball",
    title: "The Big Match Ball",
    subtitle: "The official after-match dinner dance",
    description:
      "The evening that follows the match — dinner, the band, and the whole Thomian family in one room. Formal attire.",
    venue: "Hotel Suisse",
    city: "Kandy",
    date: inDays(46),
    doors: "Doors open 7:00 PM",
    image: catTickets,
    tag: "Formal",
    tiers: [
      {
        id: "single",
        name: "Single Entry",
        price: 3500,
        perks: ["Dinner & drinks included", "Reserved seating on request"],
      },
      {
        id: "couple",
        name: "Couple Entry",
        price: 6000,
        perks: ["Two entries", "Reserved couple table", "Dinner & drinks included"],
        note: "Save LKR 1,000",
      },
      {
        id: "table",
        name: "Corporate Table of 10",
        price: 25000,
        perks: ["Prime position table", "Bottle service", "Signage at the table"],
      },
    ],
  },
  {
    slug: "prize-day",
    title: "Prize Day 2027",
    subtitle: "Annual prize giving & awards ceremony",
    description:
      "The college honours its scholars and sportsmen for the year. Two guests per prize winner.",
    venue: "College Main Hall",
    city: "Matale",
    date: inDays(24),
    doors: "Seating from 8:30 AM",
    image: hero2,
    tiers: [
      {
        id: "general",
        name: "General Admission",
        price: 300,
        perks: ["Hall seating", "Ceremony programme"],
      },
      {
        id: "reserved",
        name: "Reserved Seating",
        price: 1000,
        perks: ["Front block seat", "Priority entrance", "Ceremony programme"],
      },
    ],
  },
  {
    slug: "founders-day",
    title: "Founders’ Day Service",
    subtitle: "A service of thanksgiving for the college",
    description:
      "Held in the college chapel in honour of the founders. Open to all Thomians and their families. Entry is free — registration is required for seating.",
    venue: "College Chapel",
    city: "Matale",
    date: inDays(12),
    doors: "From 7:30 AM",
    image: hero3,
    tag: "Free Entry",
    tiers: [
      {
        id: "free",
        name: "Free Registration",
        price: 0,
        perks: ["Chapel seating", "Order of service booklet"],
      },
      {
        id: "donation",
        name: "Friend of the College",
        price: 1000,
        perks: ["Reserved seating", "Name listed in the order of service"],
      },
    ],
  },
  {
    slug: "inter-house-athletics",
    title: "Inter-House Athletics Meet",
    subtitle: "The annual track & field championship",
    description:
      "Four houses, one track. The whole college turns out for the relays and the house cup.",
    venue: "College Grounds",
    city: "Matale",
    date: inDays(31),
    doors: "Gates open 7:00 AM",
    image: catUniform,
    tiers: [
      {
        id: "entrance",
        name: "Ground Entrance",
        price: 200,
        perks: ["Full day access", "Standing along the track"],
      },
      {
        id: "stand",
        name: "Grandstand Seat",
        price: 600,
        perks: ["Reserved seat", "Shaded stand", "Finish-line view"],
      },
    ],
  },
];

export const featuredEvent = events.find((e) => e.featured) ?? events[0];

/** Every event, soonest first — used for the list below the spotlight. */
export const eventsByDate = [...events].sort(
  (a, b) => a.date.getTime() - b.date.getTime()
);

/* ---------------- date helpers ---------------- */
export const dayNumber = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit" });

export const monthShort = (d: Date) =>
  d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();

export const weekdayShort = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();

export const fullDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const lowestPrice = (e: CollegeEvent) =>
  Math.min(...e.tiers.map((t) => t.price));

export const bookingRef = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return `STC-${out}`;
};