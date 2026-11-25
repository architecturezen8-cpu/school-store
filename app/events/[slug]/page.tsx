import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent, getEvents } from "@/lib/store";
import EventPage from "@/components/pages/EventPage";

export const revalidate = 60;
export const dynamicParams = true;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event not found" };

  const description =
    event.tagline || event.subtitle || event.description || `Tickets for ${event.title}.`;

  return {
    title: event.title,
    description,
    openGraph: {
      type: "website",
      title: `${event.title} · The Thomian Store`,
      description,
      images: [event.heroImage || event.image].filter(Boolean),
    },
  };
}

export default async function EventRoute({ params }: { params: Params }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  // The other events, so the page can offer a way onwards instead of a dead end.
  const others = (await getEvents()).filter((e) => e.slug !== event.slug).slice(0, 3);

  return <EventPage event={event} others={others} />;
}
