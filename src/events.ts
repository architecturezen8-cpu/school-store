import hero1 from "./assets/hero-1.jpg";
import hero2 from "./assets/hero-2.jpg";
import hero3 from "./assets/hero-3.jpg";
import catTickets from "./assets/cat-tickets.jpg";
import catUniform from "./assets/cat-uniform.jpg";

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
