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

/* ---- the two newer collections, photographed on the same navy ----
 *
 * These two were the only category pictures on a remote host, so on a filtered
 * school line the two rows of the shop that matter most in December — the exam
 * pad and the batch shirt — were the two that came up blank.
 */
const imgPaper1 = "/images/cat-papers.jpg";
const imgShirts = "/images/cat-shirts.jpg";
const imgPaper2 =
  "https://images.pexels.com/photos/13583358/pexels-photo-13583358.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const imgPaper3 =
  "https://images.pexels.com/photos/37793421/pexels-photo-37793421.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
// The last remote photograph. A medal cabinet stood in for the two badges that
// are actually worn, which is why both their cards came up blank on a filtered
// line. They are badges now, photographed as badges.
const productLapel = "/images/product-lapel-badge.jpg";
const productHouseSet = "/images/product-house-badges.jpg";

export type Category = {
  slug: string;
  title: string;
  /** The line of copy under the title. Counts are computed, never stored. */
  count: string;
  desc: string;
  image: string;
};

/** One colour × size cell of a product's shelf. `""` means "the only one". */
export type StockCell = { colour: string; size: string; qty: number };

/**
 * A product's shelf, as the shop reads it.
 *
 * `undefined` on a product means stock is not counted for it at all — it sells
 * until the office says otherwise. That is not the same as "sold out", which is
 * why the whole summary is optional rather than a number defaulting to zero.
 */
export type ProductStock = {
  cells: StockCell[];
  total: number;
  /** At least one cell is at or below LOW_STOCK and still sellable. */
  low: boolean;
  soldOut: boolean;
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
  /**
   * name → #rrggbb: the dot the shop draws beside each colour.
   *
   * Optional because a product that has never had a colour picked for it still
   * has to render — `colourHex()` then falls back to the school's palette and
   * finally to a hue derived from the name.
   */
  colourSwatches?: Record<string, string>;
  /** Omitted when the product's stock is not counted. */
  stock?: ProductStock;
};

export const lkr = (n: number) => `LKR ${n.toLocaleString("en-US")}`;

/** Extra product angles — reused across the catalogue. */
const shotA = imgShirts;
const shotB = catBadges;
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
    // Not a count — a count would go stale the moment the office adds a badge.
    // The shop counts its own items; this is the line under the title.
    count: "Worn with honour",
  },
  {
    slug: "uniforms",
    title: "Uniforms",
    desc: "Regulation uniforms, shirts and ties — tailored to the college standard.",
    image: catUniform,
    count: "The college standard",
  },
  {
    slug: "event-clothings",
    title: "Event Clothings",
    desc: "Big Match hoodies, scarves and caps for the occasions that matter.",
    // It was a photograph of the tickets: the collection named "Event Clothings"
    // was the one place in the shop that showed no clothes.
    image: productHoodie,
    count: "For the big occasions",
  },
  {
    slug: "souvenirs",
    title: "Gifts & Souvenirs",
    desc: "Crested keepsakes for the desk, the shelf and the visitor's handshake.",
    image: productMug,
    count: "The crest, kept",
  },
  {
    slug: "exam-writing-papers",
    title: "Exam Writing Papers",
    desc: "Ruled pads, answer booklets and pens — exam-ready, every single time.",
    image: imgPaper1,
    count: "Exam-ready, every time",
  },
  {
    slug: "batch-shirts",
    title: "Batch Shirts",
    desc: "Class of ’25 batch tees and shirts — your year, printed with pride.",
    image: imgShirts,
    count: "Your year, printed",
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
    // A badge is one piece of cast metal with one finish. It has no colour and
    // no size: the name says which one it is, and the admin stocks the other if
    // they want to sell it.
    name: "Prefect Badge",
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
    name: "Crest Lapel Badge",
    price: 450,
    image: productLapel,
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
    name: "House Badge Set",
    price: 1200,
    image: productHouseSet,
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
    colours: ["White", "Sky"],
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
    name: "College Blazer",
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
    name: "Crest Hoodie",
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
    // A mug is not event clothing. It sat in that collection because there was
    // nowhere else for it to go, which made the collection read as "everything
    // that is not a badge".
    category: "souvenirs",
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
    // Ink is a colour, but it is not the product's colour — "Navy geometry set"
    // was the same mistake in a different shape.
    options: { label: "Ink", values: ["Blue", "Black"] },
  },
  {
    slug: "geometry-set",
    gallery: [shotE, shotD, shotA],
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
    image: imgShirts,
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
  /** Seats allotted to this tier. null = as many as turn up. */
  capacity?: number | null;
  /** Seats already sold, so the shop can say how many are left. */
  sold?: number;
};

/** A numbered rule or a line of small print on an event page. */
export type EventRule = { title: string; body: string };

/** A photograph in the event's gallery. `caption` is optional, as on a poster. */
export type EventImage = { url: string; caption?: string };

/** A link out of the event page — an announcement, a map, a sponsor. */
export type EventLink = { label: string; url: string };

export type CollegeEvent = {
  slug: string;
  title: string;
  /** The one-line teaser under the title on a card. */
  subtitle: string;
  /** The paragraph in the hero. */
  description: string;
  venue: string;
  city: string;
  date: Date;
  doors: string;
  image: string;
  tag?: string;
  featured?: boolean;
  tiers: Tier[];

  /* ---- the event page ---------------------------------------------------
   * Everything below is optional so an event that has never been opened in the
   * admin still renders: the page falls back to the card copy, which is the
   * material the store has always had.
   */
  /** "Round 71 · One day only" — the small line above the hero title. */
  heroKicker?: string;
  /** One sentence of summary, for the "In short" card beside the story. */
  tagline?: string;
  /** The hero photograph; falls back to `image`. */
  heroImage?: string;
  /** A second, longer paragraph: the story of the day. Blank lines break paragraphs. */
  story?: string;
  /** Numbered rules. */
  rules?: EventRule[];
  /** Gallery photographs, shown under the story. */
  gallery?: EventImage[];
  /** Outbound links — the schedule, a map, the old boys' association. */
  links?: EventLink[];
  /** Shown with the countdown. */
  endsAt?: Date;
  /** Ordering in the admin; lower comes first. */
  position?: number;
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
    position: 0,
    heroKicker: "Round 71 · One day only",
    heroImage: hero1,
    tagline:
      "The 71st encounter: cricket from eight in the morning until the light goes, with the stands full and the band playing through the interval.",
    story: `Every January the college grounds fill before eight o'clock. Old boys who left twenty years ago stand in the same spot on the eastern bank. The band tunes up behind the pavilion. The whole town comes.

The cricket is the reason, but it is not the whole reason. The Big Match is the one day the school is everybody's — the juniors selling programmes at the gate, the parents in the tent, the 1998 batch pretending they can still field.

The match is played over one day, with an interval at half past twelve. Gates open at eight. Bring a hat, and bring someone who has never been.`,
    rules: [
      {
        title: "One ticket, one entry",
        body: "Your QR is scanned once at the gate. A screenshot of someone else's ticket will be refused.",
      },
      {
        title: "No glass bottles",
        body: "Anything in glass goes into a cup at the gate — this is a ground full of barefoot children.",
      },
      {
        title: "Seating is first come",
        body: "Grandstand and shaded seats are not numbered. The gates open an hour before play for a reason.",
      },
      {
        title: "Under-12s free with an adult",
        body: "No ticket needed at the gate, but they must be with a ticket holder.",
      },
      {
        title: "No flares or fireworks",
        body: "The band is loud enough. Anything burning is taken at the gate and not returned.",
      },
      {
        title: "Rain",
        body: "Play may be interrupted; tickets are not refunded for weather, but the ground stays open.",
      },
    ],
    gallery: [
      { url: hero1, caption: "The eastern bank, ten minutes before the first ball" },
      { url: hero2, caption: "The band at the interval" },
      { url: hero3, caption: "The pavilion, 2025" },
    ],
    links: [
      { label: "Match schedule & teams", url: "/tickets" },
      {
        label: "The college on the map",
        url: "https://maps.google.com/?q=St+Thomas+College+Matale",
      },
      { label: "Old Boys' Association", url: "https://stcmoba.lk" },
    ],
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
        position: 1,
    heroImage: hero2,
    tagline: "An evening in the college calendar, and one worth dressing for.",
    story: `The evening begins with the guard of honour and does not really end until the last table leaves.

Dinner is served at eight. The band plays two sets. The photographs are taken on the steps at half past nine, which is the only part anyone is ever late for.

Tickets are per person and include the full evening.`,
    rules: [
      { title: "Smart dress", body: "The college tie, or a jacket. No shorts after seven." },
      {
        title: "Table seating",
        body: "Tables seat ten. Say who you are sitting with when you book and we will do our best.",
      },
      {
        title: "Photographs",
        body: "The official photographer is on the steps from half past nine.",
      },
    ],
    links: [
      {
        label: "The college on the map",
        url: "https://maps.google.com/?q=St+Thomas+College+Matale",
      },
    ],
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
    position: 2,
    heroImage: hero2,
    tagline: "The college honours its scholars and sportsmen for the year, in the hall where it has always been done.",
    story: `Prize Day is the formal one. The hall is full by half past eight, the staff are in gowns, and the list of names is read out from the stage in the order it has been read for a hundred years.

Each prize winner is given two seats on the floor. The rest of the hall is open to parents and old boys, and it fills quickly.

The ceremony runs about two hours, with tea on the lawn afterwards.`,
    rules: [
      {
        title: "Two seats per prize winner",
        body: "Booked together. Extra seats are on the balcony, first come.",
      },
      {
        title: "Be seated by 8:45",
        body: "The procession enters at nine and the doors close behind it.",
      },
      {
        title: "Photographs after, not during",
        body: "The photographer is on the lawn from eleven. No phones in the aisle.",
      },
    ],
    links: [
      {
        label: "The college on the map",
        url: "https://maps.google.com/?q=St+Thomas+College+Matale",
      },
    ],
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
    position: 3,
    heroImage: hero3,
    tagline: "The college remembers the men who founded it, in the chapel, on the morning of the anniversary.",
    story: `Founders' Day begins in the chapel at seven, before the heat. The choir sings, the warden speaks, and the roll of the school's founders is read.

It is the quietest morning in the college calendar. Old boys come back for it more than for anything else.

Breakfast is served in the hall afterwards, and everyone is welcome, whether they booked or not — the ticket is for the chapel, which has limited seats.`,
    rules: [
      {
        title: "Chapel seating",
        body: "Seats are limited and unreserved; the ticket reserves you a place, not a particular pew.",
      },
      {
        title: "Silence in the chapel",
        body: "Phones off. The service is recorded for the college archive.",
      },
      {
        title: "Breakfast is open",
        body: "No ticket needed for the hall afterwards.",
      },
    ],
    links: [
      {
        label: "The college on the map",
        url: "https://maps.google.com/?q=St+Thomas+College+Matale",
      },
    ],
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
    position: 4,
    heroImage: hero3,
    tagline: "Six houses, one track, and a whole day of the loudest cheering the grounds hear all year.",
    story: `The athletics meet is the one day the houses compete in everything at once — track, field, relays and the tug of war that ends the afternoon.

The stands are divided by house colour, which makes for a wall of noise from the first whistle. Parents and old boys are welcome on the western bank.

Gates open at eight. The programme is printed on the day and sold at the gate.`,
    rules: [
      {
        title: "Stand behind the rope",
        body: "The track is live all day. Crossing it during an event stops the race.",
      },
      {
        title: "House colours",
        body: "Wear yours. The stands are judged as much as the track.",
      },
      {
        title: "Water",
        body: "Free water points are at both ends of the stand. Bring a bottle, not glass.",
      },
    ],
    links: [
      {
        label: "The college on the map",
        url: "https://maps.google.com/?q=St+Thomas+College+Matale",
      },
    ],
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