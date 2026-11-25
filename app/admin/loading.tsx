/**
 * What the admin shows while a page is being read.
 *
 * Every admin page is a server render that touches the database — bookings,
 * templates, events — and on a slow connection the browser sits on the *old*
 * page with nothing to say for it, then snaps to the new one. A loading state
 * makes the wait legible, and a skeleton of the real layout is better than a
 * spinner in the middle of nowhere: the tiles are already the right size and
 * place, so the page does not jump when the data lands.
 *
 * Kept deliberately quiet — bento tiles at the page, panel and well greys, no
 * gold, nothing that looks like content. It is a page outline, not a fake page.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading this page…</p>

      {/* the header tile */}
      <section className="rounded-2xl bg-panel p-6">
        <div className="h-3 w-24 animate-pulse rounded-full bg-panel-2" />
        <div className="mt-3 h-7 w-56 animate-pulse rounded-lg bg-panel-2" />
        <div className="mt-3 h-3 w-full max-w-md animate-pulse rounded-full bg-well" />
      </section>

      {/* two columns of tiles, the admin's usual shape */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-panel p-6">
              <div className="h-4 w-32 animate-pulse rounded bg-panel-2" />
              <div className="mt-4 space-y-3">
                <div className="h-11 w-full animate-pulse rounded-xl bg-well" />
                <div className="h-11 w-full animate-pulse rounded-xl bg-well" />
                <div className="h-10 w-40 animate-pulse rounded-xl bg-panel-2" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-panel p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-panel-2" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-well" />
                <div className="h-3 flex-1 animate-pulse rounded-full bg-well" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-well" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
