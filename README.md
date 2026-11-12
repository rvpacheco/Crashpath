# CrashPath

Management app for a climbing gym in Bogotá. Front desk check-ins, memberships and credit packs, a liability waiver with signature, MoonBoard bookings, a small inventory, and an admin panel. It runs in production at [crashpath.lat](https://crashpath.lat).

I built it and I still work on it every week. It is a live product with real members, so the rules in the code (who counts as valid, what a volunteer can see, how a mistake gets corrected) come from how the gym actually operates.

The code lives in [`crashpath/`](crashpath/). Code comments and the admin UI are in Spanish. The public landing page is available in Spanish and English.

## Stack

- Next.js 14 (pages router), React 18, Node 22
- MongoDB with Mongoose 8
- NextAuth 4 with Google sign-in and the MongoDB adapter
- Tailwind 3 and MUI
- Zod for validation, Luxon for dates
- ExcelJS (import and export), PDFKit (signed waivers), Google Calendar API (MoonBoard slots)
- Vitest: 475 tests in 24 files, all passing on 12 Nov 2026

## What it does

- **Check-ins.** Register a visit, check in, cancel, undo. Every visit keeps its own event log (who did what and when).
- **Memberships.** Two kinds: a monthly pass (`mensualidad`) and a credit pack with an expiry date (`tiquetera`). One function decides who is currently valid, and the panel, the scripts and the MCP server all call it.
- **Guest pass (`cortesía`).** Each member gets one pass per cycle. It renews when they renew, it does not stack, and it expires with the access that created it.
- **Waiver.** Digital signature stored with the member, exported as a PDF.
- **MoonBoard bookings.** Slots backed by a Google Calendar.
- **Inventory.** Stock movements for things sold at the desk.
- **Roles.** `admin` and `staff` (volunteers on shift). Staff grants are stored in the database and expire on their own.
- **Audit log.** Every change to credits, dates or profiles records who made it and where it came from (panel, script or MCP).
- **Excel import and export** of the member list.
- **Landing page** in Spanish and English with per-page SEO and structured data.
- **MCP server** (`/api/mcp`) so Claude can run the same operations from a chat. See below.

## Things worth reading

**Permissions are a table, not `if (role === "staff")`.** [`lib/permisos.js`](crashpath/lib/permisos.js) lists capabilities and which role has each. The panel hides exactly the buttons the server rejects, because both import the same module. A new permission is admin-only until someone adds it to the staff list on purpose.

**Pure modules.** `vigencia`, `permisos`, `cortesia`, `privacy` and `redact` have no database and no NextAuth, so the rules are tested in isolation. "Today" means the start of the day in Bogotá, so a pass that expires today is still valid today.

**Sensitive data is cut on the server.** Staff get the member list without ID numbers, phones, health data or signatures. Masking helpers (`maskEmail`, `maskPhone`) are tested.

**The MCP server is stateless and has two steps for writes.** Each request builds its own server, which is what Vercel needs. Auth is a small OAuth flow in `pages/api/oauth/`, restricted to an allow-list of emails that is checked on every request, so removing an email cuts access immediately. Read tools (search, who is valid, who expires soon, today's check-ins, inactive members, history, period summary) run directly. Write tools (check-in, renew membership, load credits, use guest pass, edit member) return a preview unless called with `confirmar: true`. They go through the same code as the panel ([`lib/operaciones.js`](crashpath/lib/operaciones.js)) and are logged with origin `mcp`. Members are always addressed by id, never by name, so two people called Juan can't be mixed up.

**Scripts that write to the database run as a dry run first.** `npm run cortesias` prints who would be affected. Only `npm run cortesias:apply` writes. They are two separate scripts on purpose: on PowerShell the `--` in `npm run x -- --apply` gets swallowed, and a script that thinks it applied while running dry is worse than one that refuses.

## Run it locally

```bash
cd crashpath
npm install
# create .env.local with the variables below (there is no .env.example yet)
npm run dev                  # http://localhost:3000
npm test                     # vitest run, no database needed
```

Environment variables:

| Variable | Used for |
|---|---|
| `MONGODB_URI` | Database connection |
| `NEXTAUTH_SECRET` | Session signing (also the fallback key for MCP tokens) |
| `NEXTAUTH_URL` | Public base URL, used in the OAuth metadata |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `CRASHPATH_CALENDAR_ID` | MoonBoard calendar |
| `MCP_ALLOWED_EMAILS` | Comma-separated emails allowed to use the MCP server |
| `MCP_JWT_SECRET` | Optional, signs MCP tokens separately from sessions |

The admin list is hardcoded in [`lib/roles.js`](crashpath/lib/roles.js) as a lockout safety net (if the database is down you can still get into the panel). To sign in on your own copy, put your email there.

Use a development database. Several scripts and endpoints write real data.

## Layout

```
crashpath/
  pages/            routes and API (admin, visits, moon, waiver, oauth, mcp)
  components/       landing, MoonBoard, inventory, SEO and privacy context
  lib/              business rules (vigencia, permisos, cortesia, operaciones, mcp*)
  models/           User, StaffGrant, AuditLog, MoonReservation, MovimientoInventario
  scripts/          one-off maintenance scripts, dry run by default
  test/             Vitest
  docs/             notes and pending ideas
```

## Branches

`taller` is where work happens. `main` is what is deployed.
