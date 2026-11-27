import type { Metadata } from "next";
import TicketsPage from "@/components/pages/TicketsPage";
import { getEvents } from "@/lib/store";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Event Tickets",
  description:
    "Big Match, Prize Day and the College Ball — book seats for every Thomian occasion.",
};

export default async function Tickets() {
  const events = await getEvents();
  return <TicketsPage events={events} />;
}
