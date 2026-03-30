# Next.js Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vanilla HTML/CSS/JS admin UI in `public/` with a Next.js App Router frontend using Tailwind CSS and shadcn/ui, running as a `web/` subfolder in the monorepo.

**Architecture:** Next.js (App Router, JavaScript) in `web/` calls the existing Express API at `http://localhost:3000`. Auth uses custom JWT stored in localStorage, read by a shared `apiFetch` wrapper. All 7 existing pages are rebuilt 1-for-1 with the same features using shadcn/ui components.

**Tech Stack:** Next.js 14 (App Router), JavaScript, Tailwind CSS, shadcn/ui, existing Express API on port 3000

---

> **Note on commits:** The user manages all git commits and branching. Do NOT run `git add` or `git commit` at any step.

> **Note on testing:** No test framework is configured. Verification steps are "run `npm run dev` and open the browser at `http://localhost:3001`".

---

## File Map

```
web/
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── components.json              ← shadcn config
├── jsconfig.json
├── .env.local
├── middleware.js                ← JWT route protection
├── app/
│   ├── globals.css
│   ├── layout.js                ← root layout, sidebar, auth guard
│   ├── page.js                  ← dashboard
│   ├── login/
│   │   └── page.js
│   ├── spk/
│   │   └── page.js
│   ├── lk/
│   │   └── page.js
│   ├── equipment/
│   │   └── page.js
│   ├── maps/
│   │   └── page.js
│   ├── submissions/
│   │   └── page.js
│   └── users/
│       └── page.js
├── components/
│   ├── layout/
│   │   ├── Sidebar.js
│   │   └── TopBar.js
│   └── shared/
│       ├── DataTable.js
│       └── ConfirmDialog.js
└── lib/
    ├── api.js
    └── auth.js
```

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `web/package.json`
- Create: `web/next.config.js`
- Create: `web/tailwind.config.js`
- Create: `web/postcss.config.js`
- Create: `web/jsconfig.json`
- Create: `web/.env.local`
- Create: `web/components.json`
- Create: `web/app/globals.css`

- [ ] **Step 1: Create the `web/` directory and `package.json`**

```bash
mkdir web
```

Create `web/package.json`:

```json
{
  "name": "kti-smartcare-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18",
    "react-dom": "^18",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.400.0",
    "@radix-ui/react-dialog": "^1.1.1",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-alert-dialog": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.1",
    "@radix-ui/react-dropdown-menu": "^2.1.1",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"
  }
}
```

- [ ] **Step 2: Create `web/next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
  },
};

module.exports = nextConfig;
```

- [ ] **Step 3: Create `web/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Create `web/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `web/jsconfig.json`**

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 6: Create `web/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 7: Create `web/components.json` (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 8: Create `web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 9: Install dependencies**

```bash
cd web && npm install
```

- [ ] **Step 10: Verify Next.js starts**

Create a temporary `web/app/page.js`:
```js
export default function Page() {
  return <div>hello</div>;
}
```

Create a temporary `web/app/layout.js`:
```js
import './globals.css';
export default function RootLayout({ children }) {
  return <html lang="id"><body>{children}</body></html>;
}
```

Run:
```bash
cd web && npm run dev
```
Expected: Server running at `http://localhost:3001`, browser shows "hello".

---

## Task 2: shadcn/ui base components

**Files:**
- Create: `web/lib/utils.js`
- Create: `web/components/ui/button.jsx`
- Create: `web/components/ui/input.jsx`
- Create: `web/components/ui/label.jsx`
- Create: `web/components/ui/card.jsx`
- Create: `web/components/ui/badge.jsx`
- Create: `web/components/ui/dialog.jsx`
- Create: `web/components/ui/alert-dialog.jsx`
- Create: `web/components/ui/select.jsx`
- Create: `web/components/ui/table.jsx`
- Create: `web/components/ui/toast.jsx`
- Create: `web/components/ui/toaster.jsx`
- Create: `web/components/ui/separator.jsx`

- [ ] **Step 1: Install shadcn/ui components via CLI**

Run from the `web/` directory:
```bash
cd web
npx shadcn@latest init --defaults
npx shadcn@latest add button input label card badge dialog alert-dialog select table toast separator
```

When prompted for style: `Default`. When prompted for base color: `Slate`. This auto-creates `web/components/ui/` files and `web/lib/utils.js`.

- [ ] **Step 2: Verify `web/lib/utils.js` was created**

It should contain:
```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

If not, create it manually with the content above.

- [ ] **Step 3: Verify components render**

Update `web/app/page.js`:
```js
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export default function Page() {
  return (
    <div className="p-8 flex gap-4">
      <Button>Test Button</Button>
      <Badge>Test Badge</Badge>
    </div>
  );
}
```

Open `http://localhost:3001` — should see a styled button and badge.

---

## Task 3: Auth & API layer

**Files:**
- Create: `web/lib/auth.js`
- Create: `web/lib/api.js`
- Create: `web/middleware.js`

- [ ] **Step 1: Create `web/lib/auth.js`**

```js
const TOKEN_KEY = 'kti_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}
```

- [ ] **Step 2: Create `web/lib/api.js`**

```js
import { getToken, clearToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch(path, options = {}, _retry = true) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && _retry) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const apiGet = (path) => apiFetch(path);

export const apiPost = (path, body) =>
  apiFetch(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPut = (path, body) =>
  apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });

export const apiDelete = (path) =>
  apiFetch(path, { method: 'DELETE' });
```

- [ ] **Step 3: Create `web/middleware.js`**

```js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname === '/login') return NextResponse.next();

  // Token lives in localStorage (client-side only).
  // We can't read it in middleware, so we rely on the
  // layout's client-side auth check to redirect to /login.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

> Note: Because JWT is in localStorage (not cookies), the middleware just passes all requests through. The auth redirect is handled client-side in `layout.js`.

---

## Task 4: Root layout, Sidebar, and TopBar

**Files:**
- Modify: `web/app/layout.js`
- Create: `web/components/layout/Sidebar.js`
- Create: `web/components/layout/TopBar.js`

- [ ] **Step 1: Create `web/components/layout/Sidebar.js`**

```js
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, CheckSquare, Settings, Map, Users, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/spk', label: 'SPK', icon: FileText },
  { href: '/lk', label: 'Lembar Kerja', icon: CheckSquare },
  { href: '/equipment', label: 'Equipment', icon: Settings },
  { href: '/maps', label: 'Maps', icon: Map },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/submissions', label: 'Submissions', icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-56 border-r bg-background flex flex-col z-30">
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create `web/components/layout/TopBar.js`**

```js
'use client';
import { useRouter } from 'next/navigation';
import { LogOut, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearToken } from '@/lib/auth';

export default function TopBar() {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 border-b bg-background flex items-center px-4 gap-3 z-40">
      <div className="flex items-center gap-2">
        <Monitor size={20} className="text-primary" />
        <span className="font-semibold text-sm">KTI SmartCare</span>
      </div>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
        <LogOut size={14} />
        Logout
      </Button>
    </header>
  );
}
```

- [ ] **Step 3: Rewrite `web/app/layout.js`**

```js
'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export default function RootLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/login' && !isAuthenticated()) {
      router.push('/login');
    }
  }, [pathname, router]);

  const isLoginPage = pathname === '/login';

  return (
    <html lang="id">
      <body>
        {isLoginPage ? (
          children
        ) : (
          <>
            <TopBar />
            <Sidebar />
            <main className="pt-14 pl-56 min-h-screen bg-muted/30">
              <div className="p-6">{children}</div>
            </main>
          </>
        )}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify layout renders**

Visit `http://localhost:3001` — since not logged in yet, should redirect to `/login` (which will 404 until Task 5). That 404 is expected at this point.

---

## Task 5: Login page

**Files:**
- Create: `web/app/login/page.js`

- [ ] **Step 1: Create `web/app/login/page.js`**

```js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');
      setToken(data.token);
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>KTI SmartCare</CardTitle>
          <CardDescription>Masuk ke Admin UI</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin_01"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Memuat...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify login works**

Start the Express server (`npm run dev` in repo root, port 3000) and the Next.js server (`npm run dev` in `web/`, port 3001).

Open `http://localhost:3001/login`. Enter `admin_01` / `password123`. Should redirect to `/` (which shows a 404 until Task 6). Token should appear in `localStorage` under key `kti_token`.

---

## Task 6: Shared components — DataTable and ConfirmDialog

**Files:**
- Create: `web/components/shared/DataTable.js`
- Create: `web/components/shared/ConfirmDialog.js`

- [ ] **Step 1: Create `web/components/shared/ConfirmDialog.js`**

```js
'use client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, confirmLabel = 'Hapus', variant = 'destructive' }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Create `web/components/shared/DataTable.js`**

```js
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Trash2 } from 'lucide-react';

/**
 * Reusable data table with search, bulk-select, and optional bulk-delete.
 *
 * Props:
 *   columns: [{ key, label, render?: (row) => ReactNode }]
 *   data: array of row objects
 *   rowKey: string — field used as unique row identifier
 *   onBulkDelete?: (ids: string[]) => void — if provided, shows bulk-delete bar
 *   searchFields: string[] — fields to search across
 *   actions?: (row) => ReactNode — action buttons per row
 *   loading?: boolean
 */
export default function DataTable({ columns, data, rowKey, onBulkDelete, searchFields = [], actions, loading }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const filtered = search
    ? data.filter((row) =>
        searchFields.some((field) =>
          String(row[field] ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  function toggleAll(checked) {
    setSelected(checked ? filtered.map((r) => String(r[rowKey])) : []);
  }

  function toggleRow(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const someSelected = selected.length > 0 && selected.length < filtered.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected([]); }}
          />
        </div>
      </div>

      {selected.length > 0 && onBulkDelete && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selected.length} dipilih</span>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1"
            onClick={() => { onBulkDelete(selected); setSelected([]); }}
          >
            <Trash2 size={12} />
            Hapus
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {onBulkDelete && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              {actions && <TableHead className="w-36">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onBulkDelete ? 1 : 0) + (actions ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                  Memuat...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onBulkDelete ? 1 : 0) + (actions ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                  Tidak ada data
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const id = String(row[rowKey]);
                return (
                  <TableRow key={id} data-state={selected.includes(id) ? 'selected' : undefined}>
                    {onBulkDelete && (
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(id)}
                          onCheckedChange={() => toggleRow(id)}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.render ? col.render(row) : (row[col.key] ?? '—')}
                      </TableCell>
                    ))}
                    {actions && <TableCell>{actions(row)}</TableCell>}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

> Note: `Checkbox` from shadcn needs to be added: run `npx shadcn@latest add checkbox` from `web/`.

- [ ] **Step 3: Add Checkbox component**

```bash
cd web && npx shadcn@latest add checkbox
```

---

## Task 7: Dashboard page

**Files:**
- Modify: `web/app/page.js`

- [ ] **Step 1: Rewrite `web/app/page.js`**

```js
'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, CheckSquare, Settings, Users, Activity, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const tiles = [
  { key: 'spk', label: 'Total SPK', icon: FileText, href: '/spk' },
  { key: 'lk', label: 'Total Lembar Kerja', icon: CheckSquare, href: '/lk' },
  { key: 'equipment', label: 'Total Equipment', icon: Settings, href: '/equipment' },
  { key: 'users', label: 'Total Users', icon: Users, href: '/users' },
  { key: 'submissions', label: 'Total Submissions', icon: Activity, href: '/submissions' },
];

export default function DashboardPage() {
  const [counts, setCounts] = useState({});
  const [recentSubs, setRecentSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [spk, lk, eq, users, subs] = await Promise.all([
        apiGet('/api/spk'),
        apiGet('/api/lk'),
        apiGet('/api/equipment'),
        apiGet('/api/users'),
        apiGet('/api/submissions'),
      ]);
      setCounts({
        spk: spk.length,
        lk: lk.length,
        equipment: eq.length,
        users: users.length,
        submissions: subs.length,
      });
      setRecentSubs([...subs].reverse().slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Selamat datang di KTI SmartCare Admin UI</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {tiles.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} href={href}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="pb-2 pt-4 px-4">
                <Icon size={20} className="text-primary" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{loading ? '—' : (counts[key] ?? 0)}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Submissions Terbaru</CardTitle>
          <Link href="/submissions">
            <Button variant="ghost" size="sm">Lihat Semua →</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SPK Number</TableHead>
                <TableHead>Submitted At</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Evaluasi</TableHead>
                <TableHead>Photos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSubs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Belum ada submission
                  </TableCell>
                </TableRow>
              ) : (
                recentSubs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.spkNumber}</TableCell>
                    <TableCell>{formatDate(s.submittedAt)}</TableCell>
                    <TableCell>{s.durationActual ?? '—'} jam</TableCell>
                    <TableCell className="max-w-[200px] truncate">{s.evaluasi || '—'}</TableCell>
                    <TableCell>{(s.photoPaths || []).length}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify dashboard**

Log in at `http://localhost:3001/login`, get redirected to `/`. Should see 5 stat tiles with counts and a recent submissions table.

---

## Task 8: Users page

**Files:**
- Create: `web/app/users/page.js`

- [ ] **Step 1: Create `web/app/users/page.js`**

```js
'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import DataTable from '@/components/shared/DataTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

const ROLES = ['teknisi', 'planner', 'supervisor', 'manager', 'admin'];
const ROLE_COLORS = {
  teknisi: 'bg-blue-100 text-blue-700',
  planner: 'bg-purple-100 text-purple-700',
  supervisor: 'bg-yellow-100 text-yellow-700',
  manager: 'bg-green-100 text-green-700',
  admin: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = { username: '', fullName: '', password: '', role: 'teknisi', workCenter: '' };

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setUsers(await apiGet('/api/users')); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(user) {
    setEditingId(user.id);
    setForm({ username: user.username, fullName: user.fullName, password: '', role: user.role, workCenter: user.workCenter || '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        const body = { username: form.username, fullName: form.fullName, role: form.role, workCenter: form.workCenter };
        if (form.password) body.password = form.password;
        await apiPut(`/api/users/${editingId}`, body);
        toast({ title: 'User diperbarui' });
      } else {
        await apiPost('/api/users', form);
        toast({ title: 'User dibuat' });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiDelete(`/api/users/${id}`);
      toast({ title: 'User dihapus' });
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setDeleteId(null);
    }
  }

  async function handleBulkDelete(ids) {
    try {
      await apiPost('/api/users/bulk-delete', { ids });
      toast({ title: `${ids.length} user dihapus` });
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  }

  const columns = [
    { key: 'username', label: 'Username', render: (r) => <span className="font-medium">{r.username}</span> },
    { key: 'fullName', label: 'Nama Lengkap' },
    { key: 'role', label: 'Role', render: (r) => <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r.role] || 'bg-gray-100 text-gray-700'}`}>{r.role}</span> },
    { key: 'workCenter', label: 'Work Center' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm">Kelola akun pengguna sistem</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={14} />
          Tambah User
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        rowKey="id"
        loading={loading}
        searchFields={['username', 'fullName', 'role']}
        onBulkDelete={handleBulkDelete}
        actions={(row) => (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteId(row.id)}>Hapus</Button>
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit User' : 'Tambah User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Nama Lengkap</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{editingId ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Work Center</Label>
              <Input value={form.workCenter} onChange={(e) => setForm({ ...form, workCenter: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Hapus User"
        description="Tindakan ini tidak dapat dibatalkan."
        onConfirm={() => handleDelete(deleteId)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add `use-toast` hook**

Run: `npx shadcn@latest add toast` from `web/` if not already added in Task 2.

- [ ] **Step 3: Verify users page**

Open `http://localhost:3001/users`. Should show a table of users with search, bulk-delete, add/edit dialog, and delete confirmation.

---

## Task 9: Equipment page

**Files:**
- Create: `web/app/equipment/page.js`

- [ ] **Step 1: Create `web/app/equipment/page.js`**

```js
'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import DataTable from '@/components/shared/DataTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

const CATEGORIES = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
const EMPTY_FORM = { equipmentId: '', equipmentName: '', category: 'Mekanik', functionalLocation: '', plantId: '' };

export default function EquipmentPage() {
  const { toast } = useToast();
  const [data, setData] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [eq, pl] = await Promise.all([apiGet('/api/equipment'), apiGet('/api/plants')]);
      setData(eq.data || eq);
      setPlants(pl);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setDialogOpen(true); }
  function openEdit(row) { setEditingId(row.equipmentId); setForm({ equipmentId: row.equipmentId, equipmentName: row.equipmentName, category: row.category, functionalLocation: row.functionalLocation || '', plantId: row.plantId || '' }); setDialogOpen(true); }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/api/equipment/${editingId}`, form);
        toast({ title: 'Equipment diperbarui' });
      } else {
        await apiPost('/api/equipment', form);
        toast({ title: 'Equipment dibuat' });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try { await apiDelete(`/api/equipment/${id}`); toast({ title: 'Equipment dihapus' }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setDeleteId(null); }
  }

  async function handleBulkDelete(ids) {
    try { await apiPost('/api/equipment/bulk-delete', { ids }); toast({ title: `${ids.length} equipment dihapus` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  }

  const columns = [
    { key: 'equipmentId', label: 'Equipment ID', render: (r) => <span className="font-medium">{r.equipmentId}</span> },
    { key: 'equipmentName', label: 'Nama' },
    { key: 'category', label: 'Kategori' },
    { key: 'functionalLocation', label: 'Functional Location' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipment</h1>
          <p className="text-muted-foreground text-sm">Kelola data equipment</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={14} />Tambah Equipment</Button>
      </div>

      <DataTable columns={columns} data={data} rowKey="equipmentId" loading={loading} searchFields={['equipmentId', 'equipmentName', 'category']} onBulkDelete={handleBulkDelete}
        actions={(row) => (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteId(row.equipmentId)}>Hapus</Button>
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Equipment' : 'Tambah Equipment'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Equipment ID *</Label>
              <Input value={form.equipmentId} disabled={!!editingId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Nama Equipment *</Label>
              <Input value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Kategori *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Functional Location</Label>
              <Input value={form.functionalLocation} onChange={(e) => setForm({ ...form, functionalLocation: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Plant</Label>
              <Select value={form.plantId || ''} onValueChange={(v) => setForm({ ...form, plantId: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih plant..." /></SelectTrigger>
                <SelectContent>
                  {plants.map((p) => <SelectItem key={p.plantId} value={String(p.plantId)}>{p.plantName || p.plantId}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} title="Hapus Equipment" description="Tindakan ini tidak dapat dibatalkan." onConfirm={() => handleDelete(deleteId)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify equipment page**

Open `http://localhost:3001/equipment`. Should show equipment table with CRUD dialogs.

---

## Task 10: Submissions page

**Files:**
- Create: `web/app/submissions/page.js`

- [ ] **Step 1: Create `web/app/submissions/page.js`**

```js
'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiDelete, apiPost } from '@/lib/api';
import DataTable from '@/components/shared/DataTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SubmissionsPage() {
  const { toast } = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [photoSub, setPhotoSub] = useState(null);

  async function load() {
    setLoading(true);
    try { setData(await apiGet('/api/submissions')); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    try { await apiDelete(`/api/submissions/${id}`); toast({ title: 'Submission dihapus' }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setDeleteId(null); }
  }

  async function handleBulkDelete(ids) {
    try { await apiPost('/api/submissions/bulk-delete', { ids }); toast({ title: `${ids.length} submission dihapus` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  }

  const columns = [
    { key: 'spkNumber', label: 'SPK Number', render: (r) => <span className="font-medium">{r.spkNumber}</span> },
    { key: 'submittedAt', label: 'Submitted At', render: (r) => formatDate(r.submittedAt) },
    { key: 'durationActual', label: 'Duration', render: (r) => r.durationActual != null ? `${r.durationActual} jam` : '—' },
    { key: 'evaluasi', label: 'Evaluasi', render: (r) => <span className="max-w-[180px] truncate block">{r.evaluasi || '—'}</span> },
    { key: 'photos', label: 'Photos', render: (r) => (r.photoPaths || []).length > 0
      ? <Button variant="ghost" size="sm" onClick={() => setPhotoSub(r)}>Lihat ({(r.photoPaths || []).length})</Button>
      : '0' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="text-muted-foreground text-sm">Riwayat submission SPK</p>
      </div>

      <DataTable columns={columns} data={data} rowKey="id" loading={loading} searchFields={['spkNumber', 'evaluasi']} onBulkDelete={handleBulkDelete}
        actions={(row) => (
          <Button size="sm" variant="destructive" onClick={() => setDeleteId(row.id)}>Hapus</Button>
        )}
      />

      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} title="Hapus Submission" description="Tindakan ini tidak dapat dibatalkan." onConfirm={() => handleDelete(deleteId)} />

      <Dialog open={!!photoSub} onOpenChange={(o) => !o && setPhotoSub(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Foto — {photoSub?.spkNumber}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(photoSub?.photoPaths || []).map((p, i) => (
              <img key={i} src={`${API_BASE}/${p}`} alt={`photo-${i}`} className="rounded-md border object-cover w-full h-40" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify submissions page**

Open `http://localhost:3001/submissions`. Should show submissions table with photo viewer dialog.

---

## Task 11: SPK page

**Files:**
- Create: `web/app/spk/page.js`

- [ ] **Step 1: Create `web/app/spk/page.js`**

This is the most complex page — it has a full create/edit drawer with equipment multi-select and per-equipment activity sub-sections.

```js
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import DataTable from '@/components/shared/DataTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, RefreshCw } from 'lucide-react';

const CATEGORIES = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
const INTERVALS = ['1wk', '2wk', '4wk', '8wk', '12wk', '14wk', '16wk'];
const STATUSES = ['pending', 'in_progress', 'completed'];
const CAT_CODE = { Mekanik: 'M', Listrik: 'L', Sipil: 'S', Otomasi: 'O' };

const STATUS_VARIANT = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'outline',
};

function suggestSpkNumber(allSpk, category) {
  const code = CAT_CODE[category] || 'M';
  const prefix = `SPK-${code}-`;
  const max = allSpk.reduce((m, s) => {
    if (!s.spkNumber.startsWith(prefix)) return m;
    const match = s.spkNumber.match(/SPK-[A-Z]+-(\d+)$/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

const EMPTY_FORM = { spkNumber: '', description: '', interval: '4wk', category: 'Mekanik', status: 'pending', scheduledDate: '' };

export default function SpkPage() {
  const { toast } = useToast();
  const [allSpk, setAllSpk] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSpkNumber, setEditingSpkNumber] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [activities, setActivities] = useState({});
  const [eqSearch, setEqSearch] = useState('');
  const [eqCatFilter, setEqCatFilter] = useState('');
  const [deleteSpkNumber, setDeleteSpkNumber] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [spk, eq] = await Promise.all([
        apiGet(`/api/spk${filterCategory ? `?category=${filterCategory}` : ''}`),
        apiGet('/api/equipment?limit=9999'),
      ]);
      setAllSpk(spk);
      setAllEquipment(eq.data || eq);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterCategory]);

  const filteredSpk = filterStatus ? allSpk.filter((s) => s.status === filterStatus) : allSpk;

  function openCreate() {
    setEditingSpkNumber(null);
    const newForm = { ...EMPTY_FORM };
    newForm.spkNumber = suggestSpkNumber(allSpk, 'Mekanik');
    setForm(newForm);
    setSelectedEquipment([]);
    setActivities({});
    setDialogOpen(true);
  }

  function openEdit(spkNumber) {
    const spk = allSpk.find((s) => s.spkNumber === spkNumber);
    if (!spk) return;
    setEditingSpkNumber(spkNumber);
    setForm({
      spkNumber: spk.spkNumber,
      description: spk.description,
      interval: spk.interval,
      category: spk.category,
      status: spk.status,
      scheduledDate: spk.scheduledDate ? spk.scheduledDate.split('T')[0] : '',
    });
    const eqIds = (spk.equipmentModels || []).map((e) => e.equipmentId);
    setSelectedEquipment(eqIds);
    const actsMap = {};
    (spk.activitiesModel || []).forEach((a) => {
      if (!actsMap[a.equipmentId]) actsMap[a.equipmentId] = [];
      actsMap[a.equipmentId].push({ operationText: a.operationText, durationPlan: a.durationPlan ?? '' });
    });
    setActivities(actsMap);
    setDialogOpen(true);
  }

  function toggleEquipment(eqId) {
    setSelectedEquipment((prev) => {
      if (prev.includes(eqId)) {
        const next = prev.filter((id) => id !== eqId);
        setActivities((a) => { const copy = { ...a }; delete copy[eqId]; return copy; });
        return next;
      }
      return [...prev, eqId];
    });
  }

  function addActivity(eqId) {
    setActivities((prev) => ({ ...prev, [eqId]: [...(prev[eqId] || []), { operationText: '', durationPlan: '' }] }));
  }

  function updateActivity(eqId, idx, field, value) {
    setActivities((prev) => {
      const list = [...(prev[eqId] || [])];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, [eqId]: list };
    });
  }

  function removeActivity(eqId, idx) {
    setActivities((prev) => {
      const list = (prev[eqId] || []).filter((_, i) => i !== idx);
      return { ...prev, [eqId]: list };
    });
  }

  async function handleSave() {
    if (!form.spkNumber.trim() || !form.description.trim()) {
      toast({ variant: 'destructive', title: 'Validasi', description: 'SPK Number dan Deskripsi wajib diisi.' });
      return;
    }
    setSaving(true);

    const equipmentModels = selectedEquipment.map((eqId) => {
      const eq = allEquipment.find((e) => e.equipmentId === eqId);
      return { equipmentId: eq.equipmentId, equipmentName: eq.equipmentName, functionalLocation: eq.functionalLocation };
    });

    let actCounter = 1;
    const activitiesModel = selectedEquipment.flatMap((eqId) =>
      (activities[eqId] || [])
        .filter((a) => a.operationText.trim())
        .map((a) => ({
          activityNumber: `ACT-${String(actCounter++).padStart(3, '0')}`,
          equipmentId: eqId,
          operationText: a.operationText,
          durationPlan: parseFloat(a.durationPlan) || 0,
          resultComment: null,
          durationActual: null,
          isVerified: false,
        }))
    );

    const body = { ...form, scheduledDate: form.scheduledDate || null, durationActual: null, equipmentModels, activitiesModel };

    try {
      if (editingSpkNumber) {
        await apiPut(`/api/spk/${editingSpkNumber}`, body);
        toast({ title: `SPK ${form.spkNumber} diperbarui` });
      } else {
        await apiPost('/api/spk', body);
        toast({ title: `SPK ${form.spkNumber} dibuat` });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(spkNumber) {
    try { await apiDelete(`/api/spk/${spkNumber}`); toast({ title: `SPK ${spkNumber} dihapus` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setDeleteSpkNumber(null); }
  }

  async function handleBulkDelete(ids) {
    try { await apiPost('/api/spk/bulk-delete', { ids }); toast({ title: `${ids.length} SPK dihapus` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  }

  const filteredEq = allEquipment.filter((eq) => {
    const matchSearch = !eqSearch || `${eq.equipmentId} ${eq.equipmentName}`.toLowerCase().includes(eqSearch.toLowerCase());
    const matchCat = !eqCatFilter || eq.category === eqCatFilter;
    return matchSearch && matchCat;
  });

  const columns = [
    { key: 'spkNumber', label: 'SPK Number', render: (r) => <span className="font-medium">{r.spkNumber}</span> },
    { key: 'description', label: 'Deskripsi' },
    { key: 'category', label: 'Kategori' },
    { key: 'interval', label: 'Interval' },
    { key: 'status', label: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>{r.status}</Badge> },
    { key: 'equipment', label: 'Equipment', render: (r) => (r.equipmentModels || []).length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SPK</h1>
          <p className="text-muted-foreground text-sm">Surat Perintah Kerja — Preventive Maintenance</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={14} />Tambah SPK</Button>
      </div>

      <div className="flex gap-2">
        <Select value={filterCategory || 'all'} onValueChange={(v) => setFilterCategory(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Semua Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw size={14} /></Button>
      </div>

      <DataTable columns={columns} data={filteredSpk} rowKey="spkNumber" loading={loading} searchFields={['spkNumber', 'description']} onBulkDelete={handleBulkDelete}
        actions={(row) => (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => openEdit(row.spkNumber)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteSpkNumber(row.spkNumber)}>Hapus</Button>
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingSpkNumber ? 'Edit SPK' : 'Tambah SPK'}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-2">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informasi SPK</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>SPK Number *</Label>
                  <Input value={form.spkNumber} readOnly={!!editingSpkNumber} onChange={(e) => setForm({ ...form, spkNumber: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Interval *</Label>
                  <Select value={form.interval} onValueChange={(v) => setForm({ ...form, interval: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Deskripsi *</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Kategori *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, spkNumber: editingSpkNumber ? form.spkNumber : suggestSpkNumber(allSpk, v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tanggal Mulai</Label>
                  <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Equipment Selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Equipment</h3>
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Cari equipment..." value={eqSearch} onChange={(e) => setEqSearch(e.target.value)} />
                <Select value={eqCatFilter || 'all'} onValueChange={(v) => setEqCatFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Semua" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {filteredEq.map((eq) => (
                  <label key={eq.equipmentId} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedEquipment.includes(eq.equipmentId)} onCheckedChange={() => toggleEquipment(eq.equipmentId)} />
                    <span className="text-sm">
                      <span className="font-medium">{eq.equipmentId}</span>
                      <span className="text-muted-foreground"> — {eq.equipmentName}</span>
                      <span className="text-xs text-muted-foreground ml-1">({eq.category})</span>
                    </span>
                  </label>
                ))}
                {filteredEq.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Tidak ada equipment</p>}
              </div>
              <p className="text-xs text-muted-foreground">{filteredEq.length} dari {allEquipment.length} equipment • {selectedEquipment.length} dipilih</p>
            </div>

            <Separator />

            {/* Activities per equipment */}
            {selectedEquipment.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Aktivitas</h3>
                {selectedEquipment.map((eqId) => {
                  const eq = allEquipment.find((e) => e.equipmentId === eqId);
                  const acts = activities[eqId] || [];
                  return (
                    <div key={eqId} className="border rounded-md p-3 space-y-2">
                      <p className="text-sm font-medium">{eq?.equipmentName} <span className="text-muted-foreground font-normal">({eqId})</span></p>
                      {acts.map((act, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input className="flex-1" placeholder="Teks operasi / deskripsi aktivitas" value={act.operationText} onChange={(e) => updateActivity(eqId, idx, 'operationText', e.target.value)} />
                          <Input className="w-28" type="number" min="0" step="0.25" placeholder="Durasi (jam)" value={act.durationPlan} onChange={(e) => updateActivity(eqId, idx, 'durationPlan', e.target.value)} />
                          <Button size="icon" variant="ghost" onClick={() => removeActivity(eqId, idx)}><X size={12} /></Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => addActivity(eqId)}><Plus size={12} />Tambah Aktivitas</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteSpkNumber} onOpenChange={(o) => !o && setDeleteSpkNumber(null)} title={`Hapus SPK ${deleteSpkNumber}?`} description="Tindakan ini tidak dapat dibatalkan." onConfirm={() => handleDelete(deleteSpkNumber)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify SPK page**

Open `http://localhost:3001/spk`. Should show SPK table with category/status filters, add/edit dialog with equipment multi-select and per-equipment activity sections.

---

## Task 12: Lembar Kerja page

**Files:**
- Create: `web/app/lk/page.js`

- [ ] **Step 1: Create `web/app/lk/page.js`**

```js
'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import DataTable from '@/components/shared/DataTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

const CATEGORIES = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];

const LK_STATUSES = [
  'pending', 'awaiting_kasie', 'awaiting_ap',
  'awaiting_kadis_pusat', 'awaiting_kadis_keamanan', 'approved', 'rejected',
];

const STATUS_VARIANT = {
  pending: 'secondary',
  awaiting_kasie: 'default',
  awaiting_ap: 'default',
  awaiting_kadis_pusat: 'default',
  awaiting_kadis_keamanan: 'default',
  approved: 'outline',
  rejected: 'destructive',
};

const EMPTY_FORM = { lkNumber: '', category: 'Mekanik', periodeStart: '', periodeEnd: '', lembarKe: 1, totalLembar: 1, spkIds: [] };

function formatPeriod(start, end) {
  if (!start) return '—';
  const fmt = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function LkPage() {
  const { toast } = useToast();
  const [allLk, setAllLk] = useState([]);
  const [allSpk, setAllSpk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailLk, setDetailLk] = useState(null);
  const [editingLkNumber, setEditingLkNumber] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteLkNumber, setDeleteLkNumber] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [lk, spk] = await Promise.all([
        apiGet(`/api/lk${filterCategory ? `?category=${filterCategory}` : ''}`),
        apiGet('/api/spk'),
      ]);
      setAllLk(lk);
      setAllSpk(spk);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterCategory]);

  const filtered = filterStatus ? allLk.filter((l) => l.status === filterStatus) : allLk;

  function openCreate() {
    setEditingLkNumber(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(lkNumber) {
    const lk = allLk.find((l) => l.lkNumber === lkNumber);
    if (!lk) return;
    setEditingLkNumber(lkNumber);
    setForm({
      lkNumber: lk.lkNumber,
      category: lk.category,
      periodeStart: lk.periodeStart ? lk.periodeStart.split('T')[0] : '',
      periodeEnd: lk.periodeEnd ? lk.periodeEnd.split('T')[0] : '',
      lembarKe: lk.lembarKe,
      totalLembar: lk.totalLembar,
      spkIds: (lk.spkModels || []).map((s) => (typeof s === 'object' ? s.spkNumber : s)),
    });
    setDialogOpen(true);
  }

  function toggleSpk(spkNumber) {
    setForm((prev) => ({
      ...prev,
      spkIds: prev.spkIds.includes(spkNumber)
        ? prev.spkIds.filter((id) => id !== spkNumber)
        : [...prev.spkIds, spkNumber],
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form, spkNumbers: form.spkIds };
      if (editingLkNumber) {
        await apiPut(`/api/lk/${editingLkNumber}`, body);
        toast({ title: `LK ${form.lkNumber} diperbarui` });
      } else {
        await apiPost('/api/lk', body);
        toast({ title: `LK ${form.lkNumber} dibuat` });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setSaving(false); }
  }

  async function handleDelete(lkNumber) {
    try { await apiDelete(`/api/lk/${lkNumber}`); toast({ title: `LK ${lkNumber} dihapus` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setDeleteLkNumber(null); }
  }

  async function handleBulkDelete(ids) {
    try { await apiPost('/api/lk/bulk-delete', { ids }); toast({ title: `${ids.length} LK dihapus` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  }

  async function handleApprove(lkNumber) {
    try { await apiPost(`/api/lk/${lkNumber}/approve`, {}); toast({ title: `LK ${lkNumber} diapprove` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  }

  async function handleReject(lkNumber) {
    try { await apiPost(`/api/lk/${lkNumber}/reject`, {}); toast({ title: `LK ${lkNumber} ditolak` }); load(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  }

  const columns = [
    { key: 'lkNumber', label: 'LK Number', render: (r) => <span className="font-medium">{r.lkNumber}</span> },
    { key: 'category', label: 'Kategori' },
    { key: 'periode', label: 'Periode', render: (r) => formatPeriod(r.periodeStart, r.periodeEnd) },
    { key: 'status', label: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>{r.status}</Badge> },
    { key: 'lembar', label: 'Lembar', render: (r) => `${r.lembarKe} / ${r.totalLembar}` },
    { key: 'spk', label: 'SPK', render: (r) => `${(r.spkModels || []).length} SPK` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lembar Kerja</h1>
          <p className="text-muted-foreground text-sm">Manajemen Lembar Kerja Preventive</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={14} />Tambah LK</Button>
      </div>

      <div className="flex gap-2">
        <Select value={filterCategory || 'all'} onValueChange={(v) => setFilterCategory(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Semua Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {LK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} rowKey="lkNumber" loading={loading} searchFields={['lkNumber', 'category']} onBulkDelete={handleBulkDelete}
        actions={(row) => (
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setDetailLk(row)}>Detail</Button>
            <Button size="sm" variant="outline" onClick={() => openEdit(row.lkNumber)}>Edit</Button>
            {['awaiting_kasie','awaiting_ap','awaiting_kadis_pusat','awaiting_kadis_keamanan'].includes(row.status) && (
              <>
                <Button size="sm" variant="default" onClick={() => handleApprove(row.lkNumber)}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => handleReject(row.lkNumber)}>Reject</Button>
              </>
            )}
            <Button size="sm" variant="destructive" onClick={() => setDeleteLkNumber(row.lkNumber)}>Hapus</Button>
          </div>
        )}
      />

      {/* Detail Dialog */}
      <Dialog open={!!detailLk} onOpenChange={(o) => !o && setDetailLk(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detail — {detailLk?.lkNumber}</DialogTitle></DialogHeader>
          {detailLk && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Status</span><div><Badge variant={STATUS_VARIANT[detailLk.status] || 'secondary'}>{detailLk.status}</Badge></div></div>
                <div><span className="text-muted-foreground">Kategori</span><div>{detailLk.category}</div></div>
                <div><span className="text-muted-foreground">Lembar</span><div>{detailLk.lembarKe} / {detailLk.totalLembar}</div></div>
                <div><span className="text-muted-foreground">Periode</span><div>{formatPeriod(detailLk.periodeStart, detailLk.periodeEnd)}</div></div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">SPK ({(detailLk.spkModels || []).length})</p>
                <div className="space-y-2">
                  {(detailLk.spkModels || []).length === 0
                    ? <p className="text-sm text-muted-foreground">Tidak ada SPK</p>
                    : (detailLk.spkModels || []).map((s, i) => (
                      <div key={i} className="border rounded-md p-3 text-sm">
                        {typeof s === 'object' ? (
                          <>
                            <div className="font-medium">{s.spkNumber} — {s.description}</div>
                            <div className="text-muted-foreground text-xs mt-1">{s.category} | {s.interval} | <Badge variant={STATUS_VARIANT[s.status] || 'secondary'} className="text-xs">{s.status}</Badge></div>
                            <div className="text-xs text-muted-foreground mt-1">{(s.activitiesModel || []).length} aktivitas</div>
                          </>
                        ) : <span className="text-muted-foreground">{s}</span>}
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingLkNumber ? 'Edit Lembar Kerja' : 'Tambah Lembar Kerja'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>LK Number *</Label>
                <Input value={form.lkNumber} readOnly={!!editingLkNumber} onChange={(e) => setForm({ ...form, lkNumber: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Kategori *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Lembar Ke</Label>
                <Input type="number" min="1" value={form.lembarKe} onChange={(e) => setForm({ ...form, lembarKe: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label>Total Lembar</Label>
                <Input type="number" min="1" value={form.totalLembar} onChange={(e) => setForm({ ...form, totalLembar: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label>Periode Mulai</Label>
                <Input type="date" value={form.periodeStart} onChange={(e) => setForm({ ...form, periodeStart: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Periode Akhir</Label>
                <Input type="date" value={form.periodeEnd} onChange={(e) => setForm({ ...form, periodeEnd: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>SPK ({form.spkIds.length} dipilih)</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {allSpk.map((spk) => (
                  <label key={spk.spkNumber} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={form.spkIds.includes(spk.spkNumber)} onCheckedChange={() => toggleSpk(spk.spkNumber)} />
                    <span className="text-sm"><span className="font-medium">{spk.spkNumber}</span><span className="text-muted-foreground"> — {spk.description}</span></span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteLkNumber} onOpenChange={(o) => !o && setDeleteLkNumber(null)} title={`Hapus LK ${deleteLkNumber}?`} description="Tindakan ini tidak dapat dibatalkan." onConfirm={() => handleDelete(deleteLkNumber)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify LK page**

Open `http://localhost:3001/lk`. Should show LK table with category/status filters, detail view, CRUD dialog with SPK selection, and approve/reject buttons on pending LKs.

---

## Task 13: Maps page

**Files:**
- Create: `web/app/maps/page.js`

- [ ] **Step 1: Create `web/app/maps/page.js`**

The maps page renders a plant map as a canvas/image where equipment can be positioned. The existing implementation reads plant map data and renders a visual map. We replicate the same using an HTML canvas drawn in a React ref.

```js
'use client';
import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

export default function MapsPage() {
  const { toast } = useToast();
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet('/api/plants').then(setPlants).catch(console.error);
  }, []);

  async function loadMap(plantId) {
    setLoading(true);
    try {
      const data = await apiGet(`/api/maps/${plantId}`);
      setMapData(data);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedPlantId) return;
    loadMap(selectedPlantId);
  }, [selectedPlantId]);

  useEffect(() => {
    if (!mapData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw equipment markers
    const markers = mapData.markers || mapData.equipmentMarkers || [];
    markers.forEach((m) => {
      ctx.beginPath();
      ctx.arc(m.x, m.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.fillStyle = '#1e3a5f';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.equipmentId || m.label || '', m.x + 12, m.y + 4);
    });
  }, [mapData]);

  async function handleSave() {
    if (!selectedPlantId || !mapData) return;
    setSaving(true);
    try {
      await apiPut(`/api/maps/${selectedPlantId}`, mapData);
      toast({ title: 'Map disimpan' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maps</h1>
          <p className="text-muted-foreground text-sm">Peta lokasi equipment per plant</p>
        </div>
        <Button onClick={handleSave} disabled={!mapData || saving} className="gap-2">
          <Save size={14} />
          Simpan Map
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        <Select value={selectedPlantId || ''} onValueChange={setSelectedPlantId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Pilih Plant..." />
          </SelectTrigger>
          <SelectContent>
            {plants.map((p) => (
              <SelectItem key={p.plantId} value={String(p.plantId)}>
                {p.plantName || p.plantId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedPlantId ? `Plant ${selectedPlantId}` : 'Pilih plant untuk melihat map'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedPlantId ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Pilih plant dari dropdown di atas</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Memuat...</p>
          ) : (
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className="border rounded-md w-full"
              style={{ background: '#f9fafb' }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify maps page**

Open `http://localhost:3001/maps`. Select a plant — should render a canvas with a grid and any equipment markers from the API response.

---

## Task 14: Final wiring and smoke test

**Files:**
- Verify all 7 pages load without console errors
- Verify sidebar highlights active page correctly
- Verify logout clears token and redirects to `/login`

- [ ] **Step 1: Run both servers**

Terminal 1 (Express):
```bash
# in SAP-CLONE/
npm run dev
```
Expected: `KTI SAP Mock Server` running on port 3000.

Terminal 2 (Next.js):
```bash
# in SAP-CLONE/web/
npm run dev
```
Expected: `Ready` on port 3001.

- [ ] **Step 2: Smoke test each page**

Open `http://localhost:3001` and navigate to each page via the sidebar. Check:

| Page | URL | Expected |
|---|---|---|
| Login | `/login` | Card form, submits to Express |
| Dashboard | `/` | 5 stat tiles with counts, recent submissions table |
| SPK | `/spk` | Table with category/status filters, add/edit dialog |
| Lembar Kerja | `/lk` | Table, detail view, approve/reject buttons |
| Equipment | `/equipment` | Table with CRUD |
| Maps | `/maps` | Plant selector, canvas renders |
| Submissions | `/submissions` | Table, photo viewer |
| Users | `/users` | Table with CRUD, role select |

- [ ] **Step 3: Verify logout**

Click the Logout button in TopBar. Should clear `kti_token` from localStorage and redirect to `/login`.

- [ ] **Step 4: Verify 401 handling**

Manually delete `kti_token` from localStorage DevTools while on `/spk`. Reload — should redirect to `/login`.
