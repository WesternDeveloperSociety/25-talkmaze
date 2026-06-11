# Component Architecture

> Canonical convention for building and refactoring React UI in this repo.
> **Read this before adding a component, a variant, or a colour.** Rules use
> MUST / SHOULD / MAY. When a rule and an existing file disagree, the rule wins —
> fix the file.

Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4
(CSS-only) · shadcn (Radix) · `class-variance-authority` (cva) · `cn`
(`clsx` + `tailwind-merge`).

---

## 1. Core principles

These five ideas drive every decision below.

### 1.1 Orthogonal variant axes — one concern per axis

A variant prop MUST encode exactly **one** concern. Never let one axis silently
drag another along. This is the single most important rule here; we violated it
twice and fixed it both times.

Canonical axes already in use:

| Primitive | `variant` | `size` | other axes |
|---|---|---|---|
| `Button` | colour/role | dimensions (padding+height+text+radius) | `rounded` (shape), `shadow` (elevation) |
| `Input` / `Textarea` | colour/surface (`light`/`dark`) | dimensions | `error` (state) |
| `Select` (trigger) | colour/surface (`light`/`dark`) | dimensions | `error` (state) |
| `Card` | colour/surface (`light`/`dark`/`accent`/`secondary`) | `padding` (none/sm/md/lg) | `shadow` (none/sm/md/lg), `border` (bool) |
| `Badge` | colour/role (`accent`/`secondary`/`light`/`warning`/`destructive`/`outline`) | dimensions (`sm`/`md`) | — |
| `Avatar` | fallback surface (`navy`/`teal`) | dimensions + fallback text (`sm`/`md`/`lg`/`xl`) | `shape` (`circle`/`square`) |

**Anti-pattern (do not do this):** baking size into a colour variant, e.g. a
`dark` variant that is also smaller/tighter. Colour and size are independent —
`variant="dark" size="lg"` MUST be expressible. (We removed `shadow` from
Button's `size`, and split dimensions out of Input's `light`/`dark`, for exactly
this reason.)

### 1.2 Surface-aware variants

Colour variants describe **the surface the component sits on**, not an arbitrary
palette pick:

- `light` — on white cards (auth/setup forms)
- `dark` — on navy cards (`--card` / `#1f2e3b`)
- `accent` (Button) — light-mint fill that reads on any surface

When you place a component, pick the variant that matches its background.

### 1.3 Tokens, not hex

- **MUST NOT** hardcode a hex value in a component. Always reference a
  CSS-variable token. (One documented exception: opacity-modified brand colours —
  see §6.)
- **SHOULD** prefer Tier-2 **semantic** tokens (`bg-primary`, `text-accent`,
  `bg-card`, `border-destructive`) for any colour with a UI *role*. Benefits:
  rebrand/theme in one place, and the class documents intent.
- **MAY** reference a Tier-1 **brand** token directly (`bg-(--talkmaze-coral)`,
  `text-(--talkmaze-lavender)`) for a brand accent that has **no semantic role
  yet** — e.g. coral for an emphasis figure, the purples for rewards.
- **Promote** a raw-token use to a semantic alias once it recurs or earns a role.

Full hierarchy and rationale in §6.

### 1.4 Primitives are presentational

Components in `ui/` MUST contain no business logic, data fetching, or domain
types. They take props and render. Workflows live in `src/lib/<domain>/`; route
data loaders live in a route's `_lib/`. (See `CLAUDE.md` layering rules.)

### 1.5 Visual parity on refactor

When migrating inline styles to a primitive, preserve the existing look unless a
deviation is **explicitly decided and noted**. Refactors are mechanical and safe;
redesigns are a separate, intentional act.

---

## 2. Folder model (hybrid)

We use shadcn's folders, and treat **atomic design as a mental model layered on
top** (see §3) — we do **not** use literal `atoms/`/`molecules/`/`organisms/`
folders (that fights shadcn's generator and forces churn).

```
src/components/
  ui/        → primitives / atoms (shadcn + custom). Presentational, reusable anywhere.
  common/    → shared composites (molecules/organisms) reused across ≥2 route areas.
  common/<group>/  → grouped composites (e.g. rich-text/, charts/).
src/app/**/_components/  → route-specific composites (not reused elsewhere).
```

Placement rules:

- A new component starts in the **route's `_components/`** (closest to where it's
  used). See `README.md` route-collocation conventions.
- **Promote** it to `src/components/common/` when a **second** route area needs
  it. (Don't pre-promote.)
- Put it in **`src/components/ui/`** only if it's a true primitive — generic,
  presentational, variant-driven, domain-agnostic.
- `ui/` MUST NOT import from `common/` or from any route. Dependency direction is
  one-way: routes → `common/` → `ui/`. (Mirrors the import-layering rule in
  `CLAUDE.md` / `eslint.config.mjs`.)

---

## 3. Atomic design as a decision framework

Use these as a **vocabulary for deciding where a component goes and how big it
should be**, not as folders.

| Tier | Definition | Lives in | Examples |
|---|---|---|---|
| **Atom** | Single-purpose primitive; no composition of other app components | `ui/` | `Button`, `Input`, `Textarea`, `Badge`, `Label`, an icon |
| **Molecule** | A few atoms bound to one job | `common/` or route `_components/` | `FormField` (Label+Input+error), `SectionCard` |
| **Organism** | A self-contained UI section | `common/` or route `_components/` | `Sidebar`, a modal, a dashboard panel |
| **Page/Template** | Route composes organisms | `src/app/**/page.tsx` | the actual routes |

**Extract a primitive/component when** any of these is true:
- the same markup/classes appear **≥ 3 times**, or are duplicated **across route
  areas**;
- a name would make intent clearer than inline markup;
- it has reusable variants worth standardising.

**Leave it raw (do NOT force into a primitive) when** it is:
- **icon-only** (close ×, password toggle, stepper +/−, avatar) — needs an
  `aria-label`, not a text Button;
- a **selectable item with pressed/active state** (e.g. a session card,
  `aria-pressed`) — give it its own component, not `Button`;
- a **nav item with active state** (sidebar/route links) — belongs in a future
  `NavItem`, not `Button`;
- a **full-tile clickable** (banner/card-as-link);
- a **genuine one-off** with no reuse and a bespoke style (e.g. the white "Sign in
  with Google" button, the white Stripe "Purchase" button on the mint form);
- a **light-surface outline/secondary** button where the dark-UI `outline`
  variant would be invisible — until an `outline-light` variant exists.

> **`Card` is the surface primitive.** Reach for `<Card variant … padding … shadow …
> border>` for *any* styled surface — box, panel, sidebar tile, form shell — not just
> things that look like "cards." That's deliberate (it's shadcn's own idiom), not a
> misnamed component. **Real/structured cards with bespoke headers** (full-bleed
> coloured bars, overlapping avatars) are **domain composites** in a route's
> `_components/` that *compose* `Card` (`padding="none"` + their own header/body
> markup) — e.g. `lessons/_components/TaskCard.tsx`,
> `parent/_components/StudentProfileCard.tsx`. The sub-components
> (`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter`)
> are **optional** helpers for shadcn-style title+description+footer cards (expected
> in coach/admin dashboards); they carry **no padding of their own** — they live
> inside the Card's padding.

---

## 4. The primitive recipe

Every primitive follows this shape. `Button` is the reference implementation
(`src/components/ui/button.tsx`).

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui"; // only if the primitive needs `asChild`

import { cn } from "@/src/utils/cn";

const fooVariants = cva(
  "…base classes shared by every variant…",
  {
    variants: {
      variant: { /* colour/role ONLY */ },
      size:    { /* dimensions ONLY */ },
      // boolean state axes: error / shadow / etc.
    },
    defaultVariants: { variant: "…", size: "…" },
  },
);

function Foo({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof fooVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="foo"
      className={cn(fooVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Foo, fooVariants };
```

Rules:

- **MUST** use `cva` for any component with ≥ 2 visual variations.
- **MUST** import `cn` from `@/src/utils/cn` and pass `className` **last** so
  caller overrides win (twMerge resolves Tailwind conflicts).
- **MUST** set `defaultVariants`.
- **MUST** add `data-slot="<name>"` (styling/testing hook; matches shadcn).
- **MUST** `Omit` native attributes that collide with a cva axis — e.g. `<input>`
  has a native `size`, so: `Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<…>`.
- **SHOULD** support `asChild` (via Radix `Slot`) when the element should be
  polymorphic — e.g. a Button that renders a Next `<Link>`:
  `<Button asChild><Link href="…">…</Link></Button>`.
- Function components (not `forwardRef`) are the house style; Radix `Slot` covers
  composition needs.

---

## 5. Shared variant vocabulary

Keep axis meanings consistent across all primitives so they compose predictably:

- **`size`**: `sm` | `md` (default) | `lg` | `xl`. Bundles padding + height +
  text-size + radius. Same name ⇒ same relative scale everywhere.
- **`variant`**: a semantic role (`primary`/`accent`/`secondary`/`destructive`/…)
  or a surface (`light`/`dark`). Colour only.
- **`rounded`**: only when shape varies independently of size (Button:
  `default`/`full`/`xl`).
- **State booleans**: `error`, `shadow`, `disabled` (native). One concern each.

Elevation: a single `--shadow-button` token, opted into via `shadow` on Button —
not baked into `size` (§1.1). Cards use the same idea: `--shadow-card` is the `md`
tier of Card's `shadow` axis (`none`/`sm`/`md`/`lg`), so a card can be flat or
elevated independently of its colour/padding.

---

## 6. Token system (two-tier)

Defined in `src/app/globals.css`, exposed to Tailwind via the `@theme inline`
block (so tokens become utilities like `bg-primary`, `text-accent`).

**Tier 1 — raw brand palette** (`:root`, `--talkmaze-*`): the literal hexes.

| Token | Value | Note |
|---|---|---|
| `--talkmaze-dark-navy` | `#1f2e3b` | dark surfaces / dark button |
| `--talkmaze-turquoise` | `#2b4257` | app background / secondary |
| `--talkmaze-mint` | `#65cfad` | primary CTA |
| `--talkmaze-green-light` | `#b1e7d6` | accent surfaces / badges |
| `--talkmaze-coral` | `#d55b40` | emphasis figure (e.g. sessions-left) |
| `--talkmaze-deep-purple` | `#59288b` | rewards/gamification (roleless today) |
| `--talkmaze-lavender` | `#7564c0` | rewards/gamification (roleless today) |
| `--talkmaze-mint-dark` | `#4db89a` | derived shade; selected/active state |

**Tier 2 — semantic aliases** (`:root`, shadcn names) point at Tier 1:
`--primary→mint`, `--primary-foreground→dark-navy`, `--secondary→turquoise`,
`--accent→green-light`, `--card`/`--popover`/`--muted→dark-navy`,
`--background→turquoise`, `--ring→mint`, `--destructive→oklch red`, plus the
`--sidebar-*` set. Components reference **these**.

### Colour usage hierarchy (firm → soft)

1. **Never hex** in a component. *(firm)*
2. **Prefer Tier-2 semantic** for role-based colour — actions, surfaces, borders,
   states. *(strong default; gives rebrand/theming + intent)*
3. **Tier-1 brand token is fine** for a brand accent with no semantic role yet
   (`text-(--talkmaze-coral)`, `bg-(--talkmaze-deep-purple)`). *(allowed)*
4. **Promote** a recurring raw use to a semantic alias once it earns a role
   (e.g. add `--emphasis: var(--talkmaze-coral)`).

A new colour **with a clear role** = add the raw token **and** map a semantic
alias. Accepted current raw reference: `bg-(--talkmaze-mint-dark)` (selected-plan
state).

**Opacity caveat:** the `/opacity` modifier works on Tailwind **theme** colours
(`border-accent/40`) but **not** on an arbitrary `var()` (`bg-(--token)/40` won't
apply opacity). If you need an opacity-modified brand colour, either define a
dedicated token at that opacity, or use a hex literal **for that single
declaration** — the one documented exception to rule 1 (e.g.
`placeholder-[#1F2E3B]/60` in the `light` input variant).

### Greys & typography (Figma scale)

Two token families mirror the Figma file (added 2026-06), registered in the
`@theme inline` block of `globals.css`:

- **Grey ramp** — `--talkmaze-grey-1..5` (`#f0f0f0 #bbbbbb #7b7b7b #4e4c4c
  #2e2e2e`, light→dark) exposed as `text-grey-3` / `bg-grey-1` / `border-grey-2`.
- **Type scale** — Figma's `Heading H1/H2/H3` and `Body B1–B6` are Tailwind text
  tokens bundling size + weight + line-height: `text-h1` (32/700), `text-h2`
  (32/400), `text-h3` (22/700), `text-b1` (20/600), `text-b2` (20/400), `text-b3`
  (16/600), `text-b4` (16/400), `text-b6` (14/400). H3 is `Inter` in Figma but
  maps to Roboto here (the app font). `B5-U`/`B6-I` are the underline/italic
  modifiers — use `underline`/`italic`, not a token. There is no 12px Figma token;
  keep `text-xs` for micro-copy (field errors/hints).

These are **tokens only** — there is no `Text`/`Heading` component; use the
utilities directly when refactoring.

---

## 7. shadcn workflow

1. Generate: `npx shadcn@latest add <component>` → lands in
   `src/components/ui/<component>.tsx`.
2. Sanity-check `components.json`: aliases MUST use `src/`
   (`"components": "@/src/components"`, `"ui": "@/src/components/ui"`) and
   `"utils": "@/src/utils/cn"`. (Earlier installs dropped files at the repo root
   under `components/` / `lib/` — if that happens, move them under `src/` and fix
   the import.)
3. **Adapt** the generated file: replace shadcn's default neutral colours with
   our semantic tokens, add our variant axes (§5), keep `data-slot`.
4. Do **not** re-run `add` over a file you've customised — it prompts to
   overwrite and will discard your variants.

---

## 8. Naming & file conventions

- **shadcn-generated primitives** keep their **lowercase** filename
  (`button.tsx`, `input.tsx`, `textarea.tsx`) — matches the generator and avoids
  regen conflicts.
- **All other components** are **PascalCase** (`Dropdown.tsx`, `PageSpinner.tsx`,
  `SectionCard.tsx`, every icon).
- One component per file, named after the component; co-locate tiny sub-parts.
- Icons are inline-SVG function components barreled from
  `src/components/ui/icons/index.ts`; `lucide-react` is available and used
  sparingly.

> Current state has mixed casing (lowercase primitives, PascalCase everything
> else). That split is intentional per the rule above — don't "fix" it by
> renaming the shadcn primitives.

---

## 9. Frontend boundaries (server / client / data)

Keep this thin; defer to the API/data docs for specifics.

- **Default to Server Components.** Add `"use client"` only when a file needs
  state, effects, refs, browser APIs, or event handlers. Primitives are
  client-capable but presentational.
- **Data fetching** happens in Server Components or a route's `_lib/` loaders.
  **Mutations** go through server actions (`actions.ts`) — never fetch business
  data inside a `ui/` primitive.
- **Forms**: a client component owns input state; validate with **Zod**; submit
  via a server action; render fields with `Input`/`Textarea` and drive the red
  border with the `error` prop.
- **Domain logic** lives in `src/lib/<domain>/`, not in components.

See `CLAUDE.md`, `docs/api-contract.md`, and `docs/data-model.md`.

---

## 10. Refactoring an existing page (checklist)

1. Inventory the page's buttons/inputs/cards; map each to a primitive + variants.
2. Replace inline classes with the primitive; **delete** any duplicated class
   constants (`inputClass`, etc.).
3. Preserve visual parity — or note the intended deviation.
4. Keep genuine exceptions raw (§3 "leave it raw").
5. Verify: `npx tsc --noEmit` → `npm run test:unit` → browser spot-check.

Precedent: the Button migration (auth/payments/reward) and the Input/Textarea
migration (auth + profile forms) followed exactly this.

---

## 11. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| `<Button variant="dark" size="lg">` | bundle size into a colour variant |
| `bg-primary`, `text-accent`, `bg-card` | hardcode `bg-[#65cfad]` |
| `bg-(--talkmaze-coral)` for a roleless accent | invent a hex when a brand token exists |
| `<Button shadow>` to elevate | tie elevation to `size` |
| `Omit<…,"size">` when a native attr collides | let the native `size` clash with the cva axis |
| pass `className` last in `cn(...)` | put `className` before variants (caller can't override) |
| start in route `_components/`, promote on reuse | drop everything in `ui/` immediately |
| leave icon-only/selectable/nav controls raw | force them into `Button` |

---

## 12. Primitive roadmap

- **Done:** `Button`, `Input`, `Textarea`; shadcn **`Field`** (+ `Label`,
  `Separator`) and Radix **`Select`** (both adapted with a `light`/`dark` surface
  variant and our tokens); shadcn **`Card`** (surface `variant`
  light/dark/accent/secondary + `padding`/`shadow`/`border` axes, `--shadow-card`
  token); typography + grey tokens; `cn`, two-tier tokens.
  - Forms compose `Field` + `FieldLabel`/`FieldError` + a control
    (`Input`/`Textarea`/`Select`). `Field` is form-library-agnostic; pass Zod
    errors to `FieldError` (`errors={[{ message }]}`) or as children. We do **not**
    use shadcn `Form`/react-hook-form — validation stays `useState` + Zod (§9).
  - Stack ≥2 vertical `Field`s in a **`FieldGroup`** — one place for inter-field
    spacing (`gap-5`) plus an `@container` so `Field orientation="responsive"`
    works. Don't wrap containers that interleave non-field content (headers,
    read-mode text, `editing ?` ternaries) — leave those as bespoke layout.
  - `Card` uses a full-box `padding` axis (a bare `<Card>` is padded); cards with
    full-bleed coloured headers/images use `padding="none"` + inner sections, and
    `CardHeader`/`Title`/`Description`/`Content`/`Footer` are layout-only (no padding
    of their own). **Leave raw** (don't wrap in `Card`): selectable / `<Link>` /
    full-tile-clickable cards (need pressed/active/nav state), bespoke glass/gradient
    panels, status banners/alerts, and `<main>`/page-layout shells.
  - shadcn **`Badge`** (text status pill): `variant` (surface/role —
    `accent`/`secondary`/`light`/`warning`/`destructive`/`outline`, default
    `secondary`) × `size` (`sm`/`md`), pill shape, `asChild`. Use for short
    status/metadata labels ("Current plan", "Setup Required"); **not** for the
    gamification artwork badges (`ClaimedBadge`/`GlowingBadge`), which are images.
    The `warning` variant introduced a `--warning` semantic token aliased to the
    brand coral (`--talkmaze-coral`) — solid coral stays for emphasis figures; the
    pill uses a soft tint (`bg-warning/10` + `text-warning`).
  - **`Avatar`** (profile image + fallback): `size` (`sm`/`md`/`lg`/`xl`, also
    sets fallback text size) × `variant` (fallback surface — `navy` =
    `bg-card`/`text-accent`, `teal` = `bg-accent`/`text-card`, matching the Figma
    `icon/avatar` `color=navy`/`color=teal` states) × `shape` (`circle`/`square`).
    Compound API mirrors shadcn (`Avatar`/`AvatarImage`/`AvatarFallback`), but
    `AvatarImage` is backed by **`next/image`** (`fill`) to keep Supabase image
    optimization — load/error state is owned by the image via a small context, not
    a Radix probe (a probe would re-fetch the unoptimized original). `AvatarFallback`
    renders initials (use `initials()` from `src/utils/formatName.ts`) or a default
    `lucide` user icon when given no children. Non-square / off-palette one-offs
    (e.g. the gray chat-bubble avatar in `ConversationMessage`) stay raw.
- **Next (highest dup first):** `Modal`/`Dialog` shell (modal
  boxes + `fixed inset-0` backdrops), `Alert` (amber/red/emerald status banners),
  `SelectableCard`/`NavItem` (the pressed/active/link cards left raw above).
- **Adopt-when-needed (shadcn):** `InputGroup` for input *adornments* (search
  icon, password-eye toggle, `$`-prefix) — not a field wrapper. A `DetailRow` /
  description-list for read-only term→value pairs (lesson/session detail modals);
  those are **not** `Field`s and stay raw until then.
