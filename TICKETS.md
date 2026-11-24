# Event tickets — how it works

Everything a ticket needs, from the design an admin uploads to the scan at the
gate. If you only read one section, read **Setting it up** below.

---

## 1. The shape of the flow

```
admin uploads a design            customer books                gate
with a white square      ──▶   ──▶ QR pasted in the    ──▶   ──▶ scan once
/admin/templates                  square, email sent           /gate admits
                                  /t/<token> also shows it
```

Every booking gets its own **admission ticket**:

- a **token** — 128 random bits, the secret that identifies the booking;
- a **signature** — an HMAC of that token, so a hand-typed reference is worthless;
- a **QR** holding `https://<site>/t/<token>?s=<signature>`;
- the **admin's design**, with the QR pasted into the white square.

Scanning the QR with any phone opens `/t/<token>`, which shows the booking and
the seats. Nothing on that page admits anyone — admitting happens only at
`/gate`, behind the admin password, so a customer cannot let themselves in by
refreshing.

## 2. Setting it up

Copy `.env.example` to `.env.local` and fill in:

| Variable | Why |
| --- | --- |
| `TICKET_SECRET` | Signs every QR. `openssl rand -hex 32`. **Without it tickets can be forged.** |
| `ADMIN_PASSWORD` | The password for `/admin` and `/gate`. Empty = admin switched off. |
| `NEXT_PUBLIC_SITE_URL` | The real domain, so a scanned QR opens the right host. |
| `RESEND_API_KEY` *or* `SMTP_*` | How the ticket email leaves the building. |
| `MAIL_FROM` | The From: line. The domain must be verified with the provider. |

Then apply the database schema (`npm run db:migrate` against `DATABASE_URL`, or
the SQL in `db/schema.sql` through the Supabase SQL editor), sign in at
`/admin`, and upload a design.

### The design

Any image, any aspect ratio, PNG/JPEG/WebP up to 8 MB:

- Draw a **plain white square** where the QR belongs — solid `#ffffff`, nothing
  on top of it, equal width and height, at least 160 px.
- That is the whole instruction. The app finds the square itself; there is no
  coordinate form to fill in.
- The QR is pasted using about **80%** of the square, so there is a small white
  margin around it — that margin is what makes the QR reliable when printed.
- If the square cannot be found, the upload is refused and says why, instead of
  quietly producing tickets with no QR on them.

Uploads live in `public/uploads/templates/` (git-ignored). One design can be
tied to a single event, or left as the default for every event.

### The email

`/admin/mail` edits the subject, heading, message and footer. Any of
`{{name}} {{event}} {{reference}} {{seats}} {{total}} {{venue}} {{date}}` can be
used in all four. Clearing a box restores the shipped default rather than
sending an empty message.

The same page can send a **test email** to your own address — using a real
booking, so the design and the QR are real too. Do that before the first
customer buys.

Resend is used when `RESEND_API_KEY` is set; otherwise plain SMTP. With neither,
bookings still succeed, the mail is logged to the server console, and the
confirmation screen says the ticket is below instead of claiming it was emailed.

## 3. Selling and scanning

- Customers book on `/tickets`. The confirmation screen shows the same artwork
  that was emailed, with the same QR.
- At the gate, sign in and open `/gate` on a phone. The camera uses the browser's
  `BarcodeDetector` where it exists; where it does not (iOS Safari, Firefox), the
  box takes a pasted link or a typed reference.
- **One admission per booking.** The first scan admits and records who scanned
  it; a second scan says *already admitted* and shows the original time, so a
  shared screenshot is obvious at the turnstile.
- A mis-scan can be undone from the gate screen; the ticket becomes valid again.
- A QR with a wrong signature is refused before the database is touched. A typed
  reference is accepted because only a signed-in admin can reach `/gate`.

`/admin/bookings` lists every booking: what was paid, whether it has been
scanned, and a **Resend** button that re-sends that customer's ticket.

## 4. Where the pieces live

| Path | What it does |
| --- | --- |
| `lib/tickets/detect.ts` | Finds the white square; composes the design + QR. |
| `lib/tickets/sign.ts` | Signs and checks the token; builds the QR URL. |
| `lib/tickets/templates.ts` | Upload, list, activate and delete designs. |
| `lib/tickets/email.ts` | The message HTML and the Resend/SMTP send. |
| `lib/tickets/mail-settings.ts` | The admin's saved wording, with defaults. |
| `lib/admin/auth.ts` | The password and the signed session cookie. |
| `lib/bookings.ts` | Booking, ticket lookup, admission, reopen. |
| `app/admin/` | Dashboard, designs, email editor, bookings. |
| `app/gate/` | The volunteer's scanner. |
| `app/t/[token]/` | The page a customer's camera opens. |
| `app/api/tickets/[token]/image` | Renders the artwork; needs a valid signature. |

## 5. If something is wrong

**"Email is not configured"** — set `RESEND_API_KEY` or the `SMTP_*` variables
and restart.

**"That design has no white square"** — the upload was refused on purpose. Check
it is a solid white square, not off-white or a photo of one.

**A ticket says "not valid"** — the link was truncated, or `TICKET_SECRET`
changed after the ticket was issued. Existing tickets do not survive a secret
change.

**The gate says "invalid"** for a real ticket — the QR was scanned from a
screenshot that lost its signature. Paste the link, or type the reference.
