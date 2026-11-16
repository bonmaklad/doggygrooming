# Cut & Cuddle

The active site is the Next.js app in `app/`. The root HTML/CSS/JS files and `out/` are legacy/static assets.

## Run locally

Use Node 20 or 22 and run `npm install`, then `npm run dev`.

Open `/admin` for the password-only client workspace. The initial local password is in the ignored `.env` file under `ADMIN_PASSWORD`. Change it there and restart the server. Never put the password or Google credentials in a `NEXT_PUBLIC_` variable. Login uses a signed, HttpOnly, SameSite=Strict cookie for 12 hours; production cookies require HTTPS. Changing the password invalidates existing sessions.

For a fresh checkout, copy `.env.example` to `.env` and choose a long unique password. Keep an existing `.env` and fill in its missing settings rather than overwriting it. No secrets belong in source control.

## Connect Google

1. Enable Google Calendar, People, Sheets and Drive APIs in the `cutandcuddle` Cloud project. Keep the external OAuth app **In production**.
2. Add `http://localhost:3001/oauth2callback` to the OAuth client's authorised redirect URIs. Store its client credentials in ignored `client_secret.json`.
3. Run `node scripts/google-auth.mjs` and open the printed URL in the business Google profile. Approve Calendar, Contacts and access to files created by this app. The callback verifies **cutandcuddle01@gmail.com**, calendar ownership/write access, Contacts access and refresh-token renewal. It writes only the Google settings to ignored `.env.google-connect` (mode 0600), preserving an existing spreadsheet ID. It does not overwrite the admin password in `.env`.
4. Run `node --env-file=.env.google-connect --experimental-default-type=module scripts/setup-crm-sheet.mjs`. It creates a private **Cut & Cuddle — Client records** sheet owned by the business account and imports the current recognised records. Rerunning uses its saved spreadsheet ID and imports only missing records. Quotes never become payments. The script writes `GOOGLE_SPREADSHEET_ID` into `.env.google-connect`.
5. Supply the Google variables from that file, including **GOOGLE_SPREADSHEET_ID**, to the HIVE server alongside `ADMIN_PASSWORD` and `APP_ORIGIN=https://cutandcuddle.co.nz`. Save variables and redeploy/restart the app. Locally, use `node --env-file=.env.google-connect node_modules/next/dist/bin/next dev` (Next also loads `.env`).

A Calendar-only refresh token must be authorised again for the additional permissions. Contacts uses `contacts` write access; Sheets uses the narrower `drive.file` scope for files created by this app, not all Drive files. An external OAuth app left in Testing normally issues refresh tokens that expire after seven days with these scopes. See [Google's OAuth guidance](https://developers.google.com/identity/protocols/oauth2#expiration).

`GOOGLE_CONTACT_GROUP` optionally restricts imported contacts to a `contactGroups/...` label. Calendar customers are always included. With no group, all saved contacts in the connected account appear. Staff contact edits update the primary name/email/phone while preserving secondary addresses and numbers. Old identity aliases remain in the records sheet to retain appointment history. A failed Contacts sync is shown explicitly; the Sheet copy stays saved and staff can retry from Edit contact.

The Sheet contains **Clients**, **Dogs** and **Visits**. Edit records through the admin; internal IDs, headers and revision columns must remain intact. Each save appends a revision, preserving earlier entries. Sorting complete rows is safe. Retried saves reuse their revision ID, stale edits are rejected, and conflicting revisions from different server instances stop loading until reconciled. Sheets has no atomic compare-and-swap, so it is suitable for this small staff workspace rather than a high-concurrency payment ledger. Amounts are total recorded payments per appointment, not transaction processing. A Sheets outage is reported instead of silently reverting to old Calendar payment values. New bookings remain in Calendar; their Sheet visit row is created when staff save its record (or run the import again).

## What the CRM does

- `/admin/due`: follow-ups per dog, sorted by due date. Every dog is due 8 weeks (56 days) after its last groom, regardless of size. Calculations use the local calendar date in the configured timezone, including across daylight saving changes. Overdue means before today; “this month” covers today through month-end. A future appointment for that dog removes it from the follow-up queue. No-shows don't reset the cycle. Missing dog names need review before a reliable due date can be calculated.
- `/admin/clients`: search contacts, see dogs, previous appointments, attendance, quoted prices and recorded payments. Matching uses normalised emails and NZ phone numbers, never a name alone. Multiple dogs stay separate. Dog profiles can be added before a first booking and edited independently, including name, size, breed and grooming notes. Renaming a dog preserves its booking history.
- `/admin/upcoming`: appointments grouped by day with contact details, service, quote and notes. The calendar import reads all history and expands recurring appointments through the next two years, following all API pages. All-day events and events with no recognised customer details appear in the review list instead of visit totals.
- Rebook from a dog or client, confirm prefilled details, choose an available slot and send the standard Google Calendar invitation to the customer. Uses the same service, duration, schedule and busy checks as public bookings. Repeated submissions of the same admin form reuse a deterministic Google event ID to avoid duplicate invitations after a timeout. Rebooking creates a new appointment; use Google Calendar to move or cancel an existing appointment.
- Past appointments can be marked attended/no-show and have the actual amount paid recorded. These internal updates, payment method, date and reference are saved in Sheets and do not email customers. Existing recorded payments from Calendar remain visible until a Sheet record overrides them. Quoted prices aren't counted as paid. Older appointments without prices stay unknown. Past-booking totals aren't presented as proof of attendance.

The parser supports the website's labelled event description (`Service:`, `Dog size:`, `Dog name:`, `Owner:`, `Email:`, `Phone:`, `Price:`, `Notes:`) and appointments with customer attendees. Older free-text bookings need review in Google Calendar; add labels or correct recognised records in the CRM. Notes must be the last field. Do not assume inferred history is complete until the business calendar has been checked.

## Hosting and checks

Run `npm run lint`, `npm test` and `npm run build`. Tests use Node's built-in test runner (Node 20+ with `--experimental-default-type=module`) and live in `tests/`. They cover authentication, identity matching, eight-week due dates, multi-dog scheduling and booking conflicts/confirmation/idempotency using a mocked Google client.

Deploy to a Node-capable Next.js host using `npm run build` and `npm start`, or the standalone output with its static/public assets. Supply the same private environment settings on the host. **The current `firebase.json` serves the old `out/` folder only; Firebase static Hosting cannot run this admin or the booking API.** The Google APIs and dedicated records sheet must be configured before the new save actions work. If using Firebase, configure a Next.js server runtime before deploying; do not deploy the old static export expecting the CRM to work.

The admin origin check uses the incoming `Host` and `X-Forwarded-Proto` so HTTPS requests work when Cloudflare or another TLS proxy forwards to the app over HTTP. The proxy must preserve `Host` and overwrite `X-Forwarded-Proto` with the original browser protocol. If the proxy rewrites `Host`, set `APP_ORIGIN=https://cutandcuddle.co.nz` in the server environment and restart; this explicit origin takes priority over all request headers. A trailing slash or surrounding whitespace is accepted. Other domains and ports are still rejected; `X-Forwarded-Host` cannot override the hostname check. Login has bounded per-process throttling (8 attempts per 15 minutes); use a trusted proxy and an edge rate limit if deploying multiple server instances. Google Calendar's free/busy check and event insert are separate operations: a simultaneous booking from another process or directly in Google can still race. The final availability check rejects known conflicts, but Calendar doesn't offer atomic slot reservations.

No live bookings or customer notifications should be created for verification without a designated test calendar and recipient. Unit checks don't prove provider access or email delivery.

The framework is updated to Next.js 15.5.29 with React 19 and a compatible PostCSS 8.5.32 security override. `npm audit --omit=dev` reports no runtime advisories at implementation time. Six moderate advisory entries remain in the development-only TypeScript ESLint dependency chain; they don't ship with the CRM runtime.
