# Agnostos Design System

Global design reference for the Agnostos frontend. **All new UI work must follow this document.** When you change visual patterns, tokens, or layout conventions in code, update this file in the same PR.

**Source of truth:** `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, and shared layout/components under `frontend/src/components/layout/`.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Tech Stack](#2-tech-stack)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Elevation & Surfaces](#6-elevation--surfaces)
7. [Motion & Animation](#7-motion--animation)
8. [Icons](#8-icons)
9. [Navigation & Shells](#9-navigation--shells)
10. [Components](#10-components)
11. [Semantic Colors & Badges](#11-semantic-colors--badges)
12. [Agent / Actor Identity](#12-agent--actor-identity)
13. [Page Patterns](#13-page-patterns)
14. [States: Loading, Empty, Error](#14-states-loading-empty-error)
15. [Responsive Behavior](#15-responsive-behavior)
16. [Accessibility](#16-accessibility)
17. [Do & Don't](#17-do--dont)
18. [Maintenance Checklist](#18-maintenance-checklist)

---

## 1. Design Philosophy

**Aesthetic:** Dark, refined, “zen” minimalism — deep blacks, whisper-thin borders, soft blue accent glow, generous rounding, and subtle motion. The product should feel like a premium intelligence workspace, not a generic SaaS dashboard.

**Brand voice (UI copy):** Confident, concise, action-oriented. Headlines are short and declarative (“Think it. Explore it.”). Supporting text explains value in one line.

**Core principles:**

| Principle | Implementation |
|-----------|----------------|
| Depth through restraint | Near-black backgrounds + 6% white borders, not heavy shadows |
| Accent as signal | Sky blue (`#60a5fa`) for primary actions, links, and active states |
| Motion with purpose | Staggered page reveals on landing/auth; hover lift on cards |
| Agent color coding | Adam (blue), Theos (purple), Mercury (amber), User (emerald) |
| Consistency over novelty | Reuse `card-zen`, CSS variables, and `cn()` helpers before inventing new patterns |

**Logo mark:** Lucide `Wind` icon at 24–32px, white, paired with “Agnostos” wordmark (`font-semibold`, `tracking-tight`).

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"`) |
| Icons | Lucide React |
| State | Zustand (auth, notifications) + TanStack Query (server data) |
| Font | Plus Jakarta Sans via `next/font/google` |

**Utility helper:** `cn()` in `frontend/src/lib/utils.ts` — always use for conditional class merging.

**No component library:** UI is hand-built with Tailwind + global CSS classes. Do not introduce shadcn, MUI, or Chakra without an explicit architectural decision.

---

## 3. Color System

### 3.1 CSS Custom Properties

Defined in `frontend/src/app/globals.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#60a5fa` | Primary buttons, links, focus rings, badges |
| `--primary-soft` | `rgba(96, 165, 250, 0.1)` | Soft primary backgrounds |
| `--background` | `#050505` | Page background, sidebar |
| `--surface` | `#0e0e0f` | Cards, panels, chat window |
| `--surface-elevated` | `#151517` | Hovered/raised cards |
| `--border` | `rgba(255, 255, 255, 0.06)` | All borders, dividers |
| `--text-main` | `#fcfcfc` | Headings, body text |
| `--text-muted` | `#94a3b8` | Secondary text, labels |
| `--accent-glow` | `rgba(96, 165, 250, 0.12)` | Input focus glow |

**Always prefer CSS variables** (`var(--primary)`, `var(--text-muted)`) over hardcoded hex in new code. Some legacy pages still use `#050505`, `#fcfcfc`, `#94a3b8` directly — migrate to tokens when touching those files.

### 3.2 Extended Palette (Tailwind / inline)

Used for semantic meaning, badges, and charts:

| Role | Colors |
|------|--------|
| Success | `emerald-400/300`, `bg-emerald-500/10`, `border-emerald-500/20` |
| Warning | `amber-400/300`, `bg-amber-500/10` |
| Error | `red-400/300`, `bg-red-500/10`, `border-red-500/20` |
| Info / active | `#93c5fd`, `#60a5fa`, `sky-400` |
| Disabled / subtle | `#64748b`, `#475569`, `#334155`, `neutral-400/500/600` |
| Chart gradient | `from-[#60a5fa]/70 to-[#34d399]/60` |

### 3.3 Background Treatments

```css
/* Ambient page glow — apply to full-page shells */
.bg-zen-gradient {
  background: radial-gradient(circle at 50% 0%, rgba(96, 165, 250, 0.03), transparent 70%);
}
```

**Glass / blur:** Header, footer, onboarding bar, profile dropdown use `backdrop-blur-xl` with semi-transparent backgrounds (`bg-[var(--background)]/70`, `bg-[#0c0c0e]/95`).

---

## 4. Typography

### 4.1 Font Family

```tsx
// frontend/src/app/layout.tsx
const font = Plus_Jakarta_Sans({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
```

Applied on `<body>` via `fontFamily: "var(--font-main), sans-serif"` and `antialiased` on `<html>`.

### 4.2 Type Scale

| Element | Classes | Example |
|---------|---------|---------|
| Hero headline | `text-5xl lg:text-6xl font-semibold tracking-tight` | Dashboard “Think it. Explore it.” |
| Page title | `text-2xl font-semibold tracking-tight` | Settings, Analytics, Pipeline |
| Section title | `text-lg font-semibold` | “Active Hiring Feed” |
| Card title | `font-semibold` or `font-medium` | Company name |
| Body | `text-sm` | Descriptions, card content |
| Caption / meta | `text-xs text-[var(--text-muted)]` | Timestamps, counts |
| Micro label | `text-[10px] uppercase tracking-wider` | Footer, badge labels, form labels |
| Section label (uppercase) | `text-xs uppercase tracking-wide text-[var(--text-muted)]` | Settings field labels |
| Monospace (timestamps) | `text-xs font-mono tabular-nums` | Elapsed timers, log times |

### 4.3 Links

- Inline action links: `text-sm text-[#60a5fa] hover:underline` or `text-[#93c5fd] hover:text-[#bfdbfe]`
- Icon + link: `inline-flex items-center gap-1` with `ArrowRight` / `ArrowUpRight`

---

## 5. Spacing & Layout

### 5.1 Page Containers

| Pattern | Classes | Used on |
|---------|---------|---------|
| Standard content | `max-w-4xl mx-auto px-6 py-10` | Settings, Logs, Onboarding main |
| Wide dashboard | `max-w-6xl mx-auto px-6 py-10 md:px-10` | Home, Analytics |
| Extra wide | `max-w-[1600px] mx-auto px-6 py-10 md:px-10` | Mercury, Pipeline |
| Narrow feed | `max-w-[960px] mx-auto p-6 lg:p-8` | Signals |

Common page wrapper (used in Mercury, Analytics):

```tsx
const zenPage = "min-h-full px-6 py-10 md:px-10 max-w-6xl mx-auto text-[#fcfcfc]";
```

Prefer `min-h-full` inside dashboard `<main>`; outer shell handles viewport height.

### 5.2 Grid & Gaps

| Layout | Classes |
|--------|---------|
| Card grid (2 col) | `grid grid-cols-1 md:grid-cols-2 gap-4` |
| Card grid (3 col) | `grid grid-cols-1 md:grid-cols-3 gap-4` |
| Stat row | `grid gap-4 sm:grid-cols-2 xl:grid-cols-4` |
| Section spacing | `mb-8` to `mb-16` between major sections |
| Form fields | `space-y-4` or `space-y-5` |
| Inline flex gaps | `gap-2`, `gap-3`, `gap-4` |

### 5.3 Border Radius Scale

| Size | Class | Usage |
|------|-------|-------|
| Small | `rounded-lg`, `rounded-xl` | Buttons, inputs, nested panels |
| Medium | `rounded-2xl` | Cards, modals, notification panel |
| Large | `rounded-3xl` | Auth card, deep search container |
| Pill | `rounded-full` | Nav pills, badges, avatar |

---

## 6. Elevation & Surfaces

### 6.1 Card — `card-zen`

Primary surface pattern (defined in `globals.css`):

```css
.card-zen {
  background: var(--surface);
  border: 1px solid var(--border);
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.card-zen:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-4px);
  background: var(--surface-elevated);
}
```

**Usage:** `className="card-zen rounded-2xl p-5"` or `p-6`. Disable hover lift on static/non-interactive containers if needed by overriding `hover:transform-none`.

### 6.2 Nested / inset surfaces

- `bg-white/[0.02]` — list rows, expandable sections
- `bg-white/[0.03]` — inputs, profile fields
- `bg-white/5` — tab backgrounds, message bubbles (assistant)
- `bg-black/40` — header center nav pill container

### 6.3 Shadows

- `soft-shadow` — global utility: `0 4px 24px -1px rgba(0,0,0,0.2), 0 0 0 1px var(--border)`
- Floating panels: `shadow-2xl`
- Chat FAB: `shadow-lg`

---

## 7. Motion & Animation

### 7.1 Page entrance — `stagger-reveal`

```css
.stagger-reveal {
  animation: reveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  opacity: 0;
  transform: translateY(12px);
}
```

Apply with incremental `style={{ animationDelay: "0.1s" }}` for sequential reveals (auth page, dashboard hero, card grids).

### 7.2 Transitions

- Default interactive: `transition-all`
- Color-only: `transition-colors`
- Opacity: `transition-opacity`
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` for card hover (matches reveal)

### 7.3 Loading indicators

- Spinner: `w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin`
- Inline: `<Loader2 className="w-4 h-4 animate-spin" />`
- Skeleton: `animate-pulse` on `bg-white/10` placeholder blocks
- Pulse icon: `animate-pulse` on Radar/status icons during active jobs

### 7.4 Scrollbars

- Global: 4px width, thumb `var(--border)`, `scrollbar-width: thin`
- Custom class `custom-scrollbar` referenced in notification/deep-search panels

---

## 8. Icons

**Library:** Lucide React only. Import named icons per file.

### 8.1 Size conventions

| Context | Size |
|---------|------|
| Sidebar nav | `w-5 h-5` |
| Sidebar sub-nav | `w-4 h-4` |
| Header nav pill | `w-3 h-3` |
| Section header icon | `w-5 h-5` or `w-6 h-6` |
| Inline meta | `w-3.5 h-3.5` |
| Footer / micro | `w-3.5 h-3.5` to `w-4 h-4` |
| FAB | `w-6 h-6` |
| Empty state | `w-10 h-10` to `w-12 h-12` |

### 8.2 Icon color

- Default muted: `text-[var(--text-muted)]`
- Active / branded: `text-[var(--primary)]`, `text-white`, or agent color
- Destructive: `text-red-300/400`

---

## 9. Navigation & Shells

### 9.1 Dashboard shell

```
┌──────────┬─────────────────────────────────────┐
│ Sidebar  │ Header (sticky, blur)                 │
│ w-20/64  ├─────────────────────────────────────┤
│ sticky   │ Main (scroll)                       │
│          ├─────────────────────────────────────┤
│          │ Footer (sticky, blur)               │
└──────────┴─────────────────────────────────────┘
                              [FloatingChat FAB] →
```

**File:** `frontend/src/app/(dashboard)/layout.tsx`

- Auth gate + onboarding redirect before render
- Loading: centered spinner on `bg-zen-gradient`
- `FloatingChat` fixed bottom-right, z-50

### 9.2 Sidebar

**File:** `frontend/src/components/layout/sidebar.tsx`

| Property | Value |
|----------|-------|
| Width | `w-20` (mobile/icon) → `lg:w-64` (expanded) |
| Background | `bg-[var(--background)]` |
| Border | `border-r border-[var(--border)]` |
| Nav item | `px-4 py-3 rounded-2xl text-sm font-medium` |
| Active | `bg-white/5 text-white` |
| Inactive | `text-[var(--text-muted)] hover:text-white hover:bg-white/5` |
| Sub-nav | `lg:pl-5`, `py-2 rounded-xl text-[13px]` |
| Logout | `hover:text-red-300 hover:bg-red-500/10` |

**Nav structure:** Dashboard, Adam, Theos (Companies / Signals / Browse), Mercury, Analytics, Logs. Settings + Logout at bottom.

### 9.3 Header

**File:** `frontend/src/components/layout/header.tsx`

| Property | Value |
|----------|-------|
| Height | `h-16` |
| Position | `sticky top-0 z-40` |
| Background | `bg-[var(--background)]/70 backdrop-blur-xl` |
| Center nav (md+) | Pill container `bg-black/40 border rounded-full p-1` |
| Active pill | `nav-pill-active` (white dot indicator below) |
| Notifications | Bell + blue badge (`min-w-[18px]`, `text-[10px]`) |
| Avatar | `w-8 h-8 rounded-full bg-[#1a1a1b] border border-white/5`, initials `text-[10px]` |

### 9.4 Footer

**File:** `frontend/src/components/layout/footer.tsx`

- `text-[10px]`, uppercase tracking on links
- “SUPPORT ONLINE” with `MessageSquareText` in `text-sky-400`
- Copyright: `© 2026 AGNOSTOS` in `text-neutral-600`

### 9.5 Auth shell

Full viewport, centered, `max-w-md`. Logo stagger → card stagger. No sidebar/header.

### 9.6 Onboarding shell

**File:** `frontend/src/app/onboarding/layout.tsx`

- Top bar: logo + 3-step progress (Resume → Interview → Review)
- Step states: active (`bg-[var(--primary)]/10 text-[var(--primary)]`), done (`text-[var(--primary)]`), pending (`text-[var(--text-muted)]`)
- Connectors: `w-8 h-px` lines between steps
- Content: `max-w-4xl mx-auto px-6 py-12`

---

## 10. Components

### 10.1 Buttons

| Variant | Classes |
|---------|---------|
| **Primary** | `py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:opacity-90 disabled:opacity-50` |
| **Secondary** | `px-4 py-2 rounded-xl bg-white/5 border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/10` |
| **Ghost icon** | `p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]` |
| **Destructive** | `border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10` |
| **Soft primary** | `bg-[var(--primary)]/20 text-[var(--primary)]` |
| **Tab toggle** | Container `p-1 rounded-xl bg-white/5`; active tab `bg-white/10 text-white` |
| **FAB** | `fixed bottom-6 right-6 p-4 rounded-full bg-[var(--primary)] text-white shadow-lg z-50` |

### 10.2 Inputs

Standard text input:

```
w-full px-4 py-3 rounded-xl
bg-white/5 border border-[var(--border)]
text-white placeholder:text-neutral-600
focus:border-[var(--primary)]/30 focus:shadow-[0_0_20px_var(--accent-glow)]
transition-all
```

Compact variant (chat): `px-3 py-2.5 text-sm`

Settings variant: `h-10 rounded-xl border bg-white/[0.03] px-3 text-sm focus:border-white/20`

Password fields: `type="password"`

Select: `bg-white/5 border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs`

Checkbox: `accent-[#60a5fa]`

**Labels:** `text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 block`

**Focus wrapper:** `.input-focus:focus-within` for composite inputs.

### 10.3 Badges & Tags

**Pill badge (status/stage):**

```
text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border
```

**Tech stack chip:**

```
text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-[rgba(255,255,255,0.06)] text-[#94a3b8]
```

**Removable tag (Adam KB):**

```
rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5 group
bg-blue-500/10 text-blue-300  (or emerald/amber variants)
```

### 10.4 Tabs (filter / section)

Border-bottom tab row:

```
flex flex-wrap gap-2 border-b border-[var(--border)] pb-4
Active: text-white border-b-2 border-[var(--primary)] (or bg-white/5)
Inactive: text-[var(--text-muted)] hover:text-white
```

### 10.5 Alerts & Banners

| Type | Pattern |
|------|---------|
| Error | `bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3` |
| Success | `border-emerald-500/30 bg-emerald-500/10 text-emerald-300` |
| Warning banner | `border-amber-500/20 bg-amber-500/5 text-amber-300` |
| Info banner | `border-emerald-500/20 bg-emerald-500/5 text-emerald-400` |

### 10.6 Chat bubbles

| Role | Style |
|------|-------|
| User | `bg-[var(--primary)]/20 text-white`, right-aligned |
| Assistant (Adam) | `bg-white/5 text-[var(--text-muted)]`, left-aligned |
| Container | `max-w-[85%] px-3 py-2 rounded-xl text-sm` |

### 10.7 Floating chat panel

**File:** `frontend/src/components/chat/FloatingChat.tsx`

- Size: `w-[400px] h-[560px]`
- Position: `fixed bottom-6 right-6 z-50`
- Surface: `bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl`
- Header: `bg-[var(--surface-elevated)] border-b`

### 10.8 Notification panel

**File:** `frontend/src/components/notifications/NotificationPanel.tsx`

- Width: `w-[360px]`, max height `max-h-[480px]`
- Dropdown from header bell, `z-[100]`
- Unread row: `bg-white/[0.02]`; read text muted
- Icon box: `w-8 h-8 rounded-xl bg-[#60a5fa]/10`

### 10.9 Deep search progress

**File:** `frontend/src/components/theos/DeepSearchProgress.tsx`

- Container: `rounded-3xl border bg-[#0a0a0b]`
- Phase pipeline: horizontal step pills with connector lines
- Active phase: `border-[#60a5fa]/30 bg-[#60a5fa]/10`
- Completed: `border-emerald-500/20 bg-emerald-500/5 text-emerald-400`
- Event log: expandable rows with icon boxes `w-7 h-7 rounded-lg`

### 10.10 Profile dropdown

- `w-64 rounded-2xl border bg-[#0c0c0e]/95 shadow-xl backdrop-blur-xl p-2`
- User info block: `border-b border-white/5`

---

## 11. Semantic Colors & Badges

Defined in `frontend/src/lib/utils.ts`. **Always use these helpers** for consistency.

### 11.1 `stageBadgeColor(stage)`

| Stage | Classes |
|-------|---------|
| pre-seed | `bg-purple-500/20 text-purple-300 border-purple-500/30` |
| seed | `bg-emerald-500/20 text-emerald-300 border-emerald-500/30` |
| series-a | `bg-blue-500/20 text-blue-300 border-blue-500/30` |
| series-b | `bg-amber-500/20 text-amber-300 border-amber-500/30` |
| default | `bg-white/5 text-neutral-400 border-white/10` |

### 11.2 `hiringScoreColor(score)`

| Range | Color |
|-------|-------|
| ≥ 80 | `text-emerald-400` |
| ≥ 60 | `text-blue-400` |
| ≥ 40 | `text-amber-400` |
| < 40 | `text-neutral-400` |

### 11.3 `statusColor(status)` — campaigns & outreach

| Status | Classes |
|--------|---------|
| draft | `bg-neutral-500/20 text-neutral-300` |
| approved | `bg-blue-500/20 text-blue-300` |
| sent | `bg-sky-500/20 text-sky-300` |
| opened | `bg-amber-500/20 text-amber-300` |
| replied | `bg-emerald-500/20 text-emerald-300` |
| bounced | `bg-red-500/20 text-red-300` |
| queued | `bg-purple-500/20 text-purple-300` |
| active | `bg-emerald-500/20 text-emerald-300` |
| paused | `bg-amber-500/20 text-amber-300` |
| completed | `bg-blue-500/20 text-blue-300` |

### 11.4 Search job status (Companies page)

| Status | Style |
|--------|-------|
| pending | `text-amber-400 bg-amber-500/10 border-amber-500/20` |
| running | `text-sky-400 bg-sky-500/10 border-sky-500/20` |
| completed | `text-emerald-400 bg-emerald-500/10 border-emerald-500/20` |
| failed | `text-red-400 bg-red-500/10 border-red-500/20` |
| cancelled | `text-[#94a3b8] bg-white/5 border-white/10` |

### 11.5 Signal types (Signals page)

| Type | Classes |
|------|---------|
| hiring_post | `bg-blue-500/20 text-blue-300 border-blue-500/30` |
| new_recruit | `bg-emerald-500/20 text-emerald-300 border-emerald-500/30` |
| funding_announce | `bg-amber-500/20 text-amber-300 border-amber-500/30` |
| expansion | `bg-purple-500/20 text-purple-300 border-purple-500/30` |

### 11.6 Job browse categories

| Category | Classes |
|----------|---------|
| FAANG+ | `border-violet-500/30 bg-violet-500/10 text-violet-300` |
| Quant | `border-amber-500/30 bg-amber-500/10 text-amber-300` |
| AI repo | `border-cyan-500/30 bg-cyan-500/10 text-cyan-300` |
| SWE repo | `border-emerald-500/30 bg-emerald-500/10 text-emerald-300` |

---

## 12. Agent / Actor Identity

### 12.1 CSS classes (`globals.css`)

| Agent | Class | Color |
|-------|-------|-------|
| Adam | `.actor-adam` | `#60a5fa` (blue) |
| Theos | `.actor-theos` | `#a78bfa` (purple) |
| Mercury | `.actor-mercury` | `#fbbf24` (amber) |
| User | `.actor-user` | `#34d399` (emerald) |
| System | `.actor-system` | `#94a3b8` (slate) |

### 12.2 Activity log badges (`logs/page.tsx`)

| Actor | Classes |
|-------|---------|
| adam | `bg-blue-500/20 text-blue-300` |
| theos | `bg-purple-500/20 text-purple-300` |
| mercury | `bg-amber-500/20 text-amber-300` |
| user | `bg-emerald-500/20 text-emerald-300` |
| system | `bg-neutral-500/20 text-neutral-300` |

### 12.3 Product areas

| Area | Route prefix | Primary icon | Accent |
|------|--------------|--------------|--------|
| Adam (profile & chat) | `/adam` | `User`, `MessageCircle` | Blue |
| Theos (companies & signals) | `/companies`, `/signals`, `/browse` | `Eye`, `Building2`, `Radio` | Purple |
| Mercury (outreach) | `/mercury` | `Zap`, `Mail` | Amber |

---

## 13. Page Patterns

### 13.1 Dashboard home (`/`)

- Centered hero with stagger-reveal headline
- Two sections: Active Hiring Feed (2-col grid) + Recent Campaigns (3-col grid)
- Section headers: icon + title + “View All” link
- Uses `card-zen` company/campaign cards

### 13.2 Settings

- `max-w-4xl`, stacked `card-zen rounded-2xl p-6` sections
- Section header: Lucide icon (`text-[var(--primary)]`) + `text-base font-medium` title
- Expandable provider key rows

### 13.3 Companies / Theos

- Filter bar with dropdowns
- Deep search modal + `DeepSearchProgress` component
- Company cards with stage badge, hiring score, tech chips, location/contacts

### 13.4 Mercury

- Kanban + campaigns dual view toggle
- `NylasConnectBanner` for email OAuth
- Email preview/edit overlays
- Uses `@dnd-kit` for drag-and-drop pipeline columns

### 13.5 Adam

- Split layout: knowledge base tabs (Skills, Experience, Projects, Proof, Preferences) + embedded chat
- Tag editors with color variants
- Resume re-upload flow

### 13.6 Analytics

- Stat cards in 4-column grid
- Bar chart with blue→emerald gradient bars
- Engagement funnel with proportional width bars

### 13.7 Auth

- Tab switcher (Sign In / Create Account) inside card
- Primary CTA full-width at bottom of form

### 13.8 Onboarding

- **Resume:** drag-drop PDF zone, processing step pipeline, live log
- **Interview:** voice UI with mic button, waveform/level indicator, conversation transcript
- **Review:** editable Q&A list, save + complete onboarding

### 13.9 Placeholder pages

Pipeline uses centered empty state: circular icon container `w-12 h-12 rounded-full border border-white/10 bg-white/[0.03]`.

---

## 14. States: Loading, Empty, Error

### 14.1 Loading

| Context | Pattern |
|---------|---------|
| Full page auth gate | Centered primary spinner on zen gradient |
| Section / grid | Skeleton cards: `rounded-2xl border bg-[#0e0e0f] animate-pulse h-40` |
| Inline | “Loading…” `text-sm text-[#94a3b8]` |
| Button | Replace label with “Saving…” / spinner, `disabled:opacity-50` |

### 14.2 Empty

- Centered message in card or page: `text-sm text-[var(--text-muted)]`
- Optional CTA button (primary or soft primary)
- Icon above copy for chat/session empty states

### 14.3 Error

- Inline alert box (red pattern above)
- Query errors: `text-sm text-red-400`
- Form validation: same red alert at top of form/card

---

## 15. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Default (< lg) | Sidebar icon-only (`w-20`), labels hidden (`hidden lg:block`) |
| `md+` | Header center nav pills visible |
| `lg+` | Sidebar expands to `w-64`, nav labels shown |
| `sm+` | Onboarding step labels visible |
| Grids | Always `grid-cols-1` on mobile, multi-col at `md`/`sm`/`xl` |

**Touch targets:** Minimum ~36px (`w-9 h-9`) for icon buttons; nav items use generous `py-3` padding.

---

## 16. Accessibility

- Root `<html lang="en">`
- Icon-only buttons: include `aria-label` (e.g. profile menu)
- Form inputs: associated `<label>` elements with visible text
- Focus: inputs use visible border/glow on focus; global `outline: none` on inputs — ensure focus ring alternative is always present
- Color is not the only indicator: badges include text labels; unread notifications have dot marker
- Confirm destructive actions (logout uses `window.confirm`)

---

## 17. Do & Don't

### Do

- Use CSS variables from `globals.css` for colors
- Use `card-zen` for interactive content cards
- Use `cn()` for conditional classes
- Use Lucide icons at standard sizes
- Use semantic color helpers from `utils.ts` for badges
- Apply `stagger-reveal` on new marketing/landing sections
- Match border opacity (`rgba(255,255,255,0.06)`) across all surfaces
- Keep page max-widths consistent with existing routes

### Don't

- Introduce light mode without a full token migration plan
- Use Inter, Roboto, Arial, or system-only fonts
- Add purple-gradient-on-white or other generic “AI slop” aesthetics
- Create one-off button styles when a variant above fits
- Hardcode new hex colors without adding a CSS variable
- Use box shadows heavier than `shadow-2xl` for cards
- Mix icon libraries (Heroicons, Font Awesome, etc.)

---

## 18. Maintenance Checklist

When changing frontend UI:

1. **Read this file first** before adding new pages or components
2. **Prefer extending** existing patterns (`card-zen`, badge helpers, page shells)
3. **Update `globals.css`** if adding new global tokens or utilities
4. **Update `utils.ts`** if adding new semantic color mappings
5. **Update this DESIGN.MD** if you introduce a new reusable pattern, token, or layout shell
6. Run `graphify update .` after code changes (project convention)

### Files to cross-check

| Concern | File(s) |
|---------|---------|
| Tokens & utilities | `frontend/src/app/globals.css` |
| Font & root layout | `frontend/src/app/layout.tsx` |
| Dashboard shell | `frontend/src/app/(dashboard)/layout.tsx` |
| Sidebar / header / footer | `frontend/src/components/layout/*.tsx` |
| Semantic colors | `frontend/src/lib/utils.ts` |
| Auth & onboarding visuals | `frontend/src/app/auth/page.tsx`, `frontend/src/app/onboarding/` |

### Referenced by

- `/DESIGN.MD` (this file) — root design authority
- `/CLAUDE.md` — agent instructions
- `/frontend/AGENTS.md` — frontend agent instructions
- `/.cursor/rules/design.mdc` — Cursor rule for UI work

---

*Last synced with frontend: June 2026*
