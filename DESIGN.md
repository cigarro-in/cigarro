---
name: Cigarro Admin
description: Quiet, compact operations UI for managing a multi-tenant cigarette storefront.
colors:
  admin-background: "#f6f5f3"
  admin-foreground: "#252522"
  admin-surface: "#ffffff"
  admin-primary: "#30302d"
  admin-secondary: "#efeeeb"
  admin-muted: "#656560"
  admin-accent: "#e9e8e4"
  admin-border: "#deddd8"
  admin-sidebar: "#eeede9"
  admin-destructive: "#b42318"
  admin-success: "#166534"
  admin-warning: "#854d0e"
  admin-info: "#1e40af"
typography:
  body:
    fontFamily: "DM-Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "DM-Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
  card-title:
    fontFamily: "DM-Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  control:
    fontFamily: "DM-Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
  label:
    fontFamily: "DM-Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  card: "0.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.admin-primary}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-secondary:
    backgroundColor: "{colors.admin-secondary}"
    textColor: "{colors.admin-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  input:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.admin-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.admin-foreground}"
    rounded: "{rounded.card}"
    padding: "1rem"
  nav-item:
    backgroundColor: "{colors.admin-sidebar}"
    textColor: "{colors.admin-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
    height: "2rem"
---

# Design System: Cigarro Admin

## Overview

**Creative North Star: "The Quiet Operations Desk"**

The admin is a Shopify-inspired working surface: calm, dense enough for daily operations, and visually subordinate to the data. It uses a cool off-white canvas, white content surfaces, charcoal text, and a single restrained accent family. The shadcn primitives provide the shared language across dashboard, catalog, orders, payments, and settings.

The world is deliberately compact and functional. Navigation is persistent on desktop and collapsible to icons; mobile replaces it with a short 48px (`h-12`) header and sheet navigation. Panels, tables, metrics, and forms rely on spacing and borders for hierarchy rather than decorative effects.

**Key Characteristics:**
- Quiet operational density
- Tonal layering with hairline borders
- Compact shadcn controls and familiar interaction states
- One admin system, independent from storefront identity

## Colors

The admin palette is cool neutral, low-chroma, and legible: charcoal for action and text, white for working surfaces, and softened gray-beige tones for navigation and secondary states.

### Primary
- **Charcoal Action** (`#30302d`): Primary buttons, active sidebar identity, and high-priority controls.

### Neutral
- **Admin Canvas** (`#f6f5f3`): Page background under every admin route.
- **Working Surface** (`#ffffff`): Cards, inputs, popovers, and mobile header.
- **Charcoal Ink** (`#252522`): Main text and card foreground.
- **Quiet Sidebar** (`#eeede9`): Persistent navigation surface.
- **Soft Secondary** (`#efeeeb`): Secondary controls, muted regions, and selected tonal states.
- **Muted Ink** (`#656560`): Descriptions, labels, and supporting metadata.
- **Hairline Border** (`#deddd8`): Card, input, sidebar, separator, and table structure.

### Named Rules
**The One Accent Rule.** Use charcoal as the primary action voice; status colors are reserved for semantic states such as destructive, success, warning, and info.

## Typography

**Display Font:** DM Sans (with `system-ui`, sans-serif fallback)
**Body Font:** DM Sans (with `system-ui`, sans-serif fallback)
**Label/Mono Font:** DM Sans for labels; tabular numerals and `font-mono` are used for operational values where specified.

**Character:** Neutral, compact, and highly legible. Weight carries hierarchy more often than size; dashboard values use semibold tabular numerals, while labels stay small and quiet.

### Hierarchy
- **Title** (600, `1.125rem`, `1.25`): Page titles such as the `PageHeader` heading.
- **Card title** (600, `1rem`, `1.25`): Compact `AdminCardTitle` and card headings.
- **Body** (400, `1rem`, `1.5`): Form and table content; responsive utilities reduce this to `0.875rem` for compact labels where needed.
- **Control** (500, `0.875rem`, `1.25`): Button labels and compact navigation/control text.
- **Label** (500, `0.75rem`, `1.25`): Sidebar group labels, metric captions, badges, and supporting metadata.

### Named Rules
**The Data-First Rule.** Let labels, values, and status carry the hierarchy; do not introduce display-serif or oversized marketing type into admin surfaces.

## Layout

The shell is a full-height flex layout with a persistent left sidebar and a flexible `SidebarInset` content column. The sidebar is `16rem` when expanded and `3rem` in icon mode; mobile uses an `18rem` sheet and a `3rem` (`h-12`) sticky header. The admin shell cancels storefront body padding at the actual `[data-admin-shell]` boundary.

Pages center content at `max-w-7xl` on the dashboard and use `px-4`, increasing to `sm:px-6`. Repeated vertical gaps are `1rem` (`gap-4`); form-heavy pages use `lg:grid-cols-2` or `lg:grid-cols-3`. Dashboard metrics are two columns on small screens and four on larger screens; recent/store content becomes a two-thirds/one-third split at large widths.

## Elevation & Depth

The admin is flat by default. Cards explicitly remove the base shadow under `[data-admin-shell]`, while borders and tonal surfaces define containment. Popovers, dialogs, and dropdowns may use the shared shadcn shadow vocabulary for transient elevation; ordinary cards should not become floating objects.

### Named Rules
**The Border-First Rule.** Establish structure with `#deddd8` borders and surface contrast before adding a shadow.

## Shapes

The form language is gently squared: controls use `rounded-md` (`0.375rem`), cards use `0.5rem`, and compact sidebar rows use `rounded-md`. Borders are one-pixel and low contrast. Cards use no clipping or ornamental geometry; avatars and status dots may remain circular when their component semantics require it.

## Components

### Buttons
- **Shape:** Compact, gently rounded controls (`0.375rem`), with `h-9` default, `h-8` small, and `h-10` large sizes.
- **Primary:** Charcoal background with white text; secondary uses soft gray-beige; outline and ghost preserve the neutral canvas and respond through accent fill.
- **Hover / Focus:** Darken or tint the background; all variants expose a visible `3px` focus ring using the ring token. Disabled controls reduce opacity and block pointer interaction.

### Chips
- **Style:** Badges are compact, `text-xs`, `px-2 py-0.5`, rounded-md, and use primary, secondary, destructive, or outline semantic variants.
- **State:** Status badges communicate order/payment state; they are not decorative tags.

### Cards / Containers
- **Corner Style:** `0.5rem` in the admin shell, overriding the generic card's larger radius.
- **Background:** White working surface on the admin canvas.
- **Shadow Strategy:** No resting shadow; use border and tonal contrast.
- **Border:** One-pixel hairline border.
- **Internal Padding:** Admin cards use `p-4` content, `px-4 py-3` headers, and a one-pixel header divider.

### Inputs / Fields
- **Style:** White input background, hairline border, `h-9`, `px-3`, `rounded-md`, and compact `text-sm` at medium widths.
- **Focus:** Ring and border shift to the neutral ring color with a `3px` visible focus treatment.
- **Error / Disabled:** Destructive border/ring for invalid fields; disabled fields block interaction and reduce opacity.

### Navigation
- **Style:** Lucide icons with compact `h-8` rows, `gap-2`, `p-2`, and rounded-md. Sections are labeled Sales, Catalog, Growth, and Storefront, with Overview kept prominent.
- **Default / Hover / Active:** Sidebar background is quiet gray-beige; hover and active rows use the sidebar accent and foreground, with active text at medium weight.
- **Mobile:** A sheet sidebar is triggered from the sticky `h-12` header; the desktop shell remains full-height.

### Dashboard Metrics and Tables
The dashboard uses border-separated metric cells, compact cards, tabbed Recent orders/customers, semantic badges, and keyboard-focusable table rows. Values use tabular numerals; action rows use ghost buttons and arrow affordances.

## Do's and Don'ts

### Do:
- **Do** use the admin override tokens under `body:has([data-admin-shell])` for new admin surfaces.
- **Do** compose screens from the existing shadcn primitives and shared `AdminCard` wrappers.
- **Do** keep copy short and operational: labels such as “Sales today”, “To fulfil”, and “Add product” are the model.
- **Do** preserve the border-first, shadowless resting state of admin cards.
- **Do** retain visible focus states and minimum mobile control heights (`2.75rem` where the shell enforces them).

### Don't:
- **Don't** import storefront beige/serif identity into admin screens.
- **Don't** introduce decorative gradients, glass effects, oversized hero type, or ornamental shadows into the operations shell.
- **Don't** use a new component family when the shadcn primitive already expresses the behavior.
- **Don't** canonize legacy hover-lift, glow, or pill-button utilities as admin guidance; they belong to other surfaces or represent drift.
- **Don't** turn status colors into general decoration; reserve them for semantic feedback.
