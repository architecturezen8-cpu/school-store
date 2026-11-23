/**
 * Wipes the embedded PGlite database (`.pglite/`).
 *
 * The schema and the seed catalogue are re-created automatically the next time
 * the app asks for data, so this is the "factory reset" for the browser-IDE /
 * no-server setup. Orders and bookings are lost with it.
 *
 *   npm run db:reset:embedded
 */
import { rm } from "node:fs/promises";

await rm(".pglite", { recursive: true, force: true });
console.log("✓ embedded database removed — it will be re-created and re-seeded on the next request");
