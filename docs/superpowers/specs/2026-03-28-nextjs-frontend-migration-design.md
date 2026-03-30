# Design: Next.js Frontend Migration

**Date:** 2026-03-28
**Status:** Approved

## Overview

Replace the existing vanilla HTML/CSS/JS admin UI (`public/`) with a modern Next.js frontend using Tailwind CSS and shadcn/ui. The Express backend (all 65 API endpoints, Sequelize, MySQL) remains completely unchanged. This aligns the frontend with the main company system which also uses Next.js.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js App Router | Modern, aligns with main company system |
| Language | JavaScript | Consistent with existing Express codebase |
| Styling | Tailwind CSS + shadcn/ui | Modern design system, replaces vanilla CSS |
| Auth | Custom JWT (localStorage) | Direct port of existing pattern, no overhead |
| Structure | Monorepo (`web/` subfolder) | One git repo, easier to keep API/UI in sync |
| Backend | Express — untouched | Frontend-only migration |

## Project Structure

```
SAP-CLONE/
├── src/                          ← Express backend (no changes)
├── public/                       ← old static UI (superseded)
├── uploads/
├── storage/
├── package.json                  ← Express package (no changes)
│
└── web/                          ← NEW: Next.js frontend
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── components.json            ← shadcn config
    ├── .env.local                 ← NEXT_PUBLIC_API_URL=http://localhost:3000
    ├── app/
    │   ├── layout.js              ← root layout (sidebar, auth guard)
    │   ├── page.js                ← dashboard
    │   ├── login/page.js
    │   ├── spk/page.js
    │   ├── lk/page.js
    │   ├── equipment/page.js
    │   ├── maps/page.js
    │   ├── submissions/page.js
    │   └── users/page.js
    ├── components/
    │   ├── ui/                    ← shadcn auto-generated components
    │   ├── layout/
    │   │   ├── Sidebar.js
    │   │   └── TopBar.js
    │   └── shared/
    │       ├── DataTable.js       ← reusable table with shadcn
    │       └── ConfirmDialog.js
    └── lib/
        ├── api.js                 ← fetch wrapper (attaches JWT token)
        └── auth.js                ← token storage & auth helpers
```

## Ports

| Service | Port |
|---|---|
| Express API | 3000 |
| Next.js dev | 3001 |

In production, both can be proxied behind one domain/nginx config.

## Auth Flow

1. `/login` page — POST to `http://localhost:3000/api/auth/login`
2. JWT token stored in `localStorage` (same as current)
3. `lib/api.js` — `apiFetch(path, options)` wrapper that reads token and attaches `Authorization: Bearer <token>` to all requests
4. `app/layout.js` — checks for token on mount, redirects to `/login` if missing
5. `middleware.js` at `web/` root — protects all routes except `/login`

No NextAuth, no cookies, no sessions — same simple JWT pattern as today.

## API Layer

`lib/api.js` is the single point of contact with the Express backend:

```js
const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

## Page Inventory (1-for-1 rebuild)

| Current | Next.js route | Key shadcn components |
|---|---|---|
| `index.html` | `app/page.js` | Card, stats |
| `pages/spk.html` | `app/spk/page.js` | DataTable, Dialog, Badge |
| `pages/lembar-kerja.html` | `app/lk/page.js` | DataTable, Dialog, Badge (approval chain) |
| `pages/equipment.html` | `app/equipment/page.js` | DataTable, Dialog |
| `pages/maps.html` | `app/maps/page.js` | custom map canvas + Card |
| `pages/submissions.html` | `app/submissions/page.js` | DataTable, image preview |
| `pages/users.html` | `app/users/page.js` | DataTable, Dialog, Select (roles) |
| *(new)* | `app/login/page.js` | Card, Input, Button |

## Shared Components

- **`Sidebar.js`** — navigation links matching current sidebar, uses shadcn nav primitives
- **`TopBar.js`** — user info, logout button
- **`DataTable.js`** — reusable table with sorting, search, bulk-select; wraps shadcn Table
- **`ConfirmDialog.js`** — reusable delete/action confirmation; wraps shadcn AlertDialog

## Express API Endpoints Referenced by Frontend

### Auth
- `POST /api/auth/login`

### Users
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `POST /api/users/bulk-delete`

### SPK (Preventive)
- `GET /api/spk`
- `GET /api/spk/:spkNumber`
- `POST /api/spk`
- `PUT /api/spk/:spkNumber`
- `DELETE /api/spk/:spkNumber`
- `POST /api/spk/bulk-delete`
- `POST /api/spk/generate-from-task-list`
- `POST /api/spk/:spkNumber/submit`
- `POST /api/spk/:spkNumber/sync`

### Lembar Kerja
- `GET /api/lk`
- `GET /api/lk/:lkNumber`
- `POST /api/lk`
- `PUT /api/lk/:lkNumber`
- `DELETE /api/lk/:lkNumber`
- `POST /api/lk/bulk-delete`
- `POST /api/lk/:lkNumber/submit`
- `POST /api/lk/:lkNumber/approve`
- `POST /api/lk/:lkNumber/reject`

### Equipment
- `GET /api/equipment`
- `GET /api/equipment/:equipmentId`
- `POST /api/equipment`
- `PUT /api/equipment/:equipmentId`
- `DELETE /api/equipment/:equipmentId`
- `POST /api/equipment/bulk-delete`
- `POST /api/equipment/bulk-update`

### Plants
- `GET /api/plants`

### Maps
- `GET /api/maps`
- `GET /api/maps/:plantId`
- `PUT /api/maps/:plantId`

### Submissions
- `GET /api/submissions`
- `GET /api/submissions/:id`
- `DELETE /api/submissions/:id`
- `POST /api/submissions/bulk-delete`

### Functional Locations & Task Lists
- `GET /api/functional-locations`
- `GET /api/task-lists`

### Uploads
- `POST /api/upload/photo`

## Out of Scope (first pass)

- Corrective maintenance pages
- Inspection pages
- Dark mode
- i18n / localization
- Server-side rendering (all pages are client-side, data fetched on mount)

## Dev Commands

```bash
# Terminal 1 — Express backend
npm run dev           # port 3000

# Terminal 2 — Next.js frontend
cd web
npm run dev           # port 3001
```
