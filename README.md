# CACI Hub — Church Management Platform

**Christ Apostolic Church International (CACI) Ghana · Assakae Central Assembly**

A mobile-first church management platform with two portals: an **Admin Portal** for church officers and a **Member Portal** for registered members.

![CACI Hub](public/logo.svg)

---

## Features

### Admin Portal
- **Dashboard** — Live stats (members, groups, broadcasts), 6-month growth chart, status breakdown, quick actions, recent activity
- **Members** — Full CRUD with search, status filters, soft-delete, audit trail. Card view on mobile, table on desktop
- **Groups** — Create fellowships/ministries, assign leaders, open/restricted messaging modes, inline group chat
- **Broadcasts** — One-way announcements targeting assembly-wide, specific group, or selected members. Auto-generates inbox notifications
- **Sermons** — Library of recorded messages with audio/video links, scripture references, cover images
- **User Accounts** — Provision/suspend accounts, reset passwords, link members to portal accounts
- **Audit Log** — Immutable record of all member field changes (who, what, old → new, when)
- **Assembly Settings** — Assembly identity, contact info, default password policy
- **Assembly Forum** — Moderated assembly-wide message board

### Member Portal
- **Inbox** — Personal notifications from broadcasts, mark read/all-read
- **My Profile** — View & edit personal info (admin manages status/role)
- **Groups & Chat** — View joined groups, participate in group chat (open/restricted modes enforced)
- **Broadcasts** — View announcements targeted to them (assembly-wide, their groups, or direct)
- **Sermons** — Browse & listen to recorded messages
- **Assembly Forum** — Post encouragements and prayer requests
- **Settings** — View account, assembly info, sign out

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router) |
| Language | **TypeScript 5** (strict) |
| Styling | **Tailwind CSS 4** + shadcn/ui (New York) |
| Database | **Prisma ORM** + SQLite |
| State | **Zustand** (client state-based router) |
| Icons | **lucide-react** |
| Toasts | **sonner** |
| Font | **Inter** (Google Fonts) |

> **Zero external AI dependencies.** This project does not depend on z-ai-web-dev-sdk or any proprietary AI SDK.

---

## Brand Identity

```
Primary Red:      #C60026   ← Primary actions, CTAs
Red Light:        #FF1A46   ← Hover states
Red Dim:          #8C001A   ← Active/pressed
Red Background:   #FFF0F2   ← Light tint

Primary Blue:     #004BA0   ← Navigation, headers, secondary
Blue Light:       #4D9FFF   ← Hover states, links
Blue Dim:         #003578   ← Active/pressed
Blue Background:  #EFF5FF   ← Light tint

Neutrals: n50 #f6f8fa · n100 #e6edf3 · n400 #6e7681 · n700 #21262d · n900 #0d1117
Semantic: Success #1a7f37 · Warning #9a6700 · Danger #C60026
```

---

## Getting Started

### Prerequisites
- **Node.js 18+** or **Bun** (recommended)
- SQLite (bundled — no separate install needed)

### Installation

```bash
# Install dependencies
bun install   # or npm install

# Set up the database
bun run db:push

# Seed demo data
bun run scripts/seed.ts
```

### Running the dev server

```bash
bun run dev
```

Open `http://localhost:3000` in your browser.

### Demo Credentials

| Role | Phone | Password |
|------|-------|----------|
| **Admin** (Pastor) | `024 400 0001` | `CACI@2026!` |
| **Member** (Elder) | `024 400 0002` | `CACI@2026!` |
| **Member** (Women's Leader) | `024 400 0003` | `CACI@2026!` |
| **Member** (Youth Leader) | `024 400 0004` | `CACI@2026!` |
| **Member** (Associate Pastor) | `024 400 0006` | `CACI@2026!` |

Additional members (007–013) are seeded without portal accounts.

---

## Project Structure

```
caci-hub/
├── prisma/
│   └── schema.prisma              # 14 tables: members, groups, broadcasts, sermons, etc.
├── public/
│   └── logo.svg                   # CACI Hub brand mark (red shield + cross)
├── scripts/
│   └── seed.ts                    # Demo data seeder
├── src/
│   ├── app/
│   │   ├── api/                   # 12 API route groups
│   │   │   ├── auth/              # login, logout, me
│   │   │   ├── members/           # CRUD
│   │   │   ├── groups/            # CRUD + join/leave
│   │   │   ├── broadcasts/        # list + compose (with targeting)
│   │   │   ├── sermons/           # CRUD
│   │   │   ├── notifications/     # list + mark read
│   │   │   ├── audit/             # admin-only audit log
│   │   │   ├── settings/          # assembly settings
│   │   │   ├── forum/             # assembly-wide board
│   │   │   ├── group-messages/    # group chat
│   │   │   ├── accounts/          # user account provisioning
│   │   │   └── dashboard/         # admin stats
│   │   ├── globals.css            # CACI brand tokens + motion utilities
│   │   ├── layout.tsx             # Inter font, metadata, toasters
│   │   └── page.tsx               # Root: session bootstrap + portal router
│   ├── components/
│   │   ├── caci/                  # Brand component library
│   │   │   ├── ui.tsx             # CACIButton, CACIInput, CACICard, badges, avatars, skeletons
│   │   │   └── nav.tsx            # Sidebar (desktop), BottomNav (mobile), headers
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── AdminPortal.tsx    # Portal orchestrator
│   │   │   ├── MemberPortal.tsx   # Portal orchestrator
│   │   │   ├── admin/             # 16 admin screens
│   │   │   └── member/            # 11 member screens
│   │   └── ui/                    # shadcn/ui primitives
│   └── lib/
│       ├── api.ts                 # Typed API client
│       ├── auth.ts                # Session (httpOnly cookie) + password hashing
│       ├── db.ts                  # Prisma client singleton
│       ├── format.ts              # Date/phone/field display helpers
│       ├── phone.ts               # Ghana phone normalization/formatting
│       ├── store.ts               # Zustand state-based router
│       ├── types.ts               # Shared DTO types
│       └── utils.ts               # cn() helper
└── package.json
```

---

## Architecture Notes

### State-based Router (Single Route)
Due to the sandbox single-route constraint, the app uses a **Zustand store** as a state-based router instead of Next.js file-based routing. The `screen` state value determines which component renders. Navigation is handled by `navigate()`, `back()`, and `resetTo()` with a stack for back navigation. Contextual params (selected member/group/broadcast IDs) are passed via `params`.

### Authentication
- Session stored in an **httpOnly cookie** (`caci_session`) — base64-encoded JSON payload
- Password hashing uses SHA-256 with a static salt (demo only — **replace with bcrypt/argon2 for production**)
- Phone numbers stored in E.164 format (`233XXXXXXXXX`), displayed as `024 XXX XXXX`
- Role-based access: admin vs member, enforced at the API layer

### Database
- **Prisma + SQLite** — 14 tables mirroring the Supabase schema from the spec
- Enums (gender, marital_status, membership_status, targeting_mode, messaging_mode) stored as TEXT with app-level validation
- UUIDs replaced with `cuid()` strings
- Soft deletes for members (`deletedAt` timestamp)
- Immutable audit log written on member field changes

### Mobile-First Design
- **375px viewport** is the primary target; desktop is a scaled-up adaptation
- 16px font size enforced on all inputs (prevents iOS Safari auto-zoom)
- Bottom tab bar on mobile (max 5 tabs), left sidebar on desktop (240px, CACI Blue)
- Card-based lists on mobile, tables on desktop for data-dense admin views
- 8pt grid system, 8px border radius, spring-physics transitions (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
- Tactile button squish (`scale(0.97)` on tap), error shake animation, skeleton shimmer loaders

---

## Scripts

```bash
bun run dev          # Start dev server (port 3000)
bun run build        # Production build
bun run start        # Start production server
bun run lint         # ESLint check
bun run db:push      # Push schema to SQLite
bun run db:generate  # Regenerate Prisma client
bun run db:migrate   # Create a migration
bun run db:reset     # Reset database
bun run scripts/seed.ts  # Seed demo data
```

---

## License

This project is built for **Christ Apostolic Church International — Assakae Central Assembly**.

© CACI Hub. All rights reserved.
