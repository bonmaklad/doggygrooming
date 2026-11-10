# Cut & Cuddle

The active site is the Next.js app in `app/`. The root HTML/CSS/JS files and `out/` are legacy/static assets.

## Run locally

Use Node 20 or 22 and run `npm install`, then `npm run dev`.

Open `/admin` for the password-only client workspace. The initial local password is in the ignored `.env` file under `ADMIN_PASSWORD`. Change it there and restart the server. Never put the password or Google credentials in a `NEXT_PUBLIC_` variable. Login uses a signed, HttpOnly, SameSite=Strict cookie for 12 hours; production cookies require HTTPS. Changing the password invalidates existing sessions.

For a fresh checkout, copy `.env.example` to `.env` and choose a long unique password. Keep an existing `.env` and fill in its missing settings rather than overwriting it. No secrets belong in source control.

## Connect Google

1. In the existing Google Cloud project, enable Google Calendar API and People API. Use the business Google account with read/write access to the grooming calendar.
2. Add `http://localhost:3000/oauth2callback` to the OAuth client's authorised redirect URIs. Download its client credentials to the ignored `client_secret.json` file.
3. Run `node scripts/google-auth.mjs`. Approve Calendar and read-only Contacts access, then paste the callback URL's `code` parameter into the terminal. The script writes the credentials and refresh token directly to `.env` without printing the token. The callback doesn't need its own page; copy the code even if the destination shows 404.
4. Set `GOOGLE_CALENDAR_ID` to the grooming calendar ID (`primary` if appropriate). Keep `GOOGLE_TIMEZONE=Pacific/Auckland`. Restart the app.

An existing calendar-only refresh token must be authorised again for Contacts. Until then, calendar customers still load and the workspace explicitly reports that Contacts aren't connected. For an OAuth app in Google's external **Testing** status, refresh tokens with these scopes normally expire after seven days; configure the consent screen for the intended production use. See [Google's OAuth guidance](https://developers.google.com/identity/protocols/oauth2#expiration).

`GOOGLE_CONTACT_GROUP` can optionally restrict imported contacts to a Cut & Cuddle label, using its `contactGroups/...` resource name. Calendar customers are included regardless of label. With no group, all saved contacts in the connected account are shown, including contacts without bookings. Contacts are read-only; new website/admin bookings appear through Calendar.

## What the CRM does

- `/admin/due`: follow-ups per dog, sorted by due date. Small = 6 calendar months, medium = 4, large = 3. Month-end dates clamp to the last day of the target month; calculations use the configured timezone. Overdue means before today; “this month” covers today through month-end. A future appointment for that dog removes it from the follow-up queue. No-shows don't reset the cycle. Missing names or sizes need review before a reliable due date can be calculated.
- `/admin/clients`: search contacts, see dogs, previous appointments, attendance, quoted prices and recorded payments. Matching uses normalised emails and NZ phone numbers, never a name alone. Multiple dogs stay separate. Missing dog details are flagged and can be corrected on an appointment record.
- `/admin/upcoming`: appointments grouped by day with contact details, service, quote and notes. The calendar import reads all history and expands recurring appointments through the next two years, following all API pages. All-day events and events with no recognised customer details appear in the review list instead of visit totals.
- Rebook from a dog or client, confirm prefilled details, choose an available slot and send the standard Google Calendar invitation to the customer. Uses the same service, duration, schedule and busy checks as public bookings. Repeated submissions of the same admin form reuse a deterministic Google event ID to avoid duplicate invitations after a timeout. Rebooking creates a new appointment; use Google Calendar to move or cancel an existing appointment.
- Past appointments can be marked attended/no-show and have the actual amount paid recorded. These internal updates live in the event's private extended properties and don't email customers. Quoted prices aren't counted as paid. Older appointments without prices stay unknown. Past-booking totals aren't presented as proof of attendance.

The parser supports the website's labelled event description (`Service:`, `Dog size:`, `Dog name:`, `Owner:`, `Email:`, `Phone:`, `Price:`, `Notes:`) and appointments with customer attendees. Older free-text bookings need review in Google Calendar; add labels or correct recognised records in the CRM. Notes must be the last field. Do not assume inferred history is complete until the business calendar has been checked.

## Hosting and checks

Run `npm run lint`, `npm test` and `npm run build`. Tests use Node's built-in test runner (Node 20+ with `--experimental-default-type=module`) and live in `tests/`. They cover authentication, identity matching, calendar-month due dates, multi-dog scheduling and booking conflicts/confirmation/idempotency using a mocked Google client.

Deploy to a Node-capable Next.js host using `npm run build` and `npm start`, or the standalone output with its static/public assets. Supply the same private environment settings on the host. **The current `firebase.json` serves the old `out/` folder only; Firebase static Hosting cannot run this admin or the booking API.** No cloud/backend infrastructure is provisioned by this change. If using Firebase, configure a Next.js server runtime before deploying; do not deploy the old static export expecting the CRM to work.

For a reverse proxy whose internal host differs from the public host, set `APP_ORIGIN` to the exact public origin, without a trailing slash, so protected writes pass origin checks. Login has bounded per-process throttling (8 attempts per 15 minutes); use a trusted proxy and an edge rate limit if deploying multiple server instances. Google Calendar's free/busy check and event insert are separate operations: a simultaneous booking from another process or directly in Google can still race. The final availability check rejects known conflicts, but Calendar doesn't offer atomic slot reservations.

No live bookings or customer notifications should be created for verification without a designated test calendar and recipient. Unit checks don't prove provider access or email delivery.

The framework is updated to Next.js 15.5.29 with React 19 and a compatible PostCSS 8.5.32 security override. `npm audit --omit=dev` reports no runtime advisories at implementation time. Six moderate advisory entries remain in the development-only TypeScript ESLint dependency chain; they don't ship with the CRM runtime.
