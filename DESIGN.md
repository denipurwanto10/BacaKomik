---
version: alpha
name: KomikFrost
description: Indonesian manga-reader aggregator. Editorial density, flat ink-teal accent, quiet surfaces.
colors:
  primary: "#0F8F79"
  primary-strong: "#0A7562"
  primary-soft: "#DCF1EC"
  primary-soft-dark: "#113831"
  secondary: "#676C76"
  tertiary: "#E0A53C"
  neutral: "#EEF0F3"
  ink: "#101217"
  ink-2: "#191C23"
  mark-manga: "#D84A41"
  mark-manhwa: "#2F7FC4"
  mark-manhua: "#C1892E"
typography:
  display:
    fontFamily: Bricolage Grotesque
    fontSize: 1.25rem
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  h2:
    fontFamily: Bricolage Grotesque
    fontSize: 1.125rem
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 8px
  lg: 16px
  pill: 999px
spacing:
  sm: 8px
  md: 12px
  lg: 16px
  section: 20px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
  nav-active:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 8px
  badge-type:
    rounded: "{rounded.sm}"
    padding: 4px
  badge-type-manga:
    backgroundColor: "{colors.mark-manga}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-type-manhwa:
    backgroundColor: "{colors.mark-manhwa}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-type-manhua:
    backgroundColor: "{colors.mark-manhua}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px
  source-badge-shinigami:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px
  source-badge-komiku:
    backgroundColor: "{colors.mark-manhwa}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px
  source-badge-komikcast:
    backgroundColor: "{colors.mark-manga}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px
  section-title:
    typography: "{typography.h2}"
    textColor: "{colors.ink}"
  section-link:
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 8px
  section-link-hover:
    backgroundColor: "{colors.primary-soft}"
  section-link-hover-dark:
    backgroundColor: "{colors.primary-soft-dark}"
  page:
    backgroundColor: "{colors.neutral}"
  surface-dark:
    backgroundColor: "{colors.ink-2}"
  rank-top:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.tertiary}"
---

## Overview

KomikFrost is a personal Indonesian manga/manhwa/manhua reader aggregator:
dense lists, daily rankings, chapter updates. Reading this as: an Operate
surface for a returning reader who checks updates fast, in a quiet
editorial language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

One screen, one job: ranking answers "what is hot", update lists answer
"what is new", detail answers "what is this and where do I continue".
Nothing exists to impress; everything exists to be scanned.

## Colors

- **Primary ink-teal (#0F8F79):** the single interaction color. Solid and
  flat, never gradient. Reason: one accent used sparingly stays an accent;
  the same teal-to-dark gradient on twenty buttons is the generic template
  tell this design rejects. Hover deepens to primary-strong (#0A7562).
- **Gold (#E0A53C):** rank 1-3 only. Reason: marks editorial weight, not
  decoration; ranks 4+ stay muted so the top three mean something.
- **Type marks (manga #D84A41, manhwa #2F7FC4, manhua #C1892E):** one solid
  color per reading origin. Reason: real information (country of origin),
  learned once and scanned forever.
- **Source badges reuse type colors:** Shinigami wears primary teal, Komiku
  wears manhwa blue, Komikcast wears manga red. Reason: source attribution
  is real aggregator information, color-coded with the existing vocabulary
  instead of inventing new hues.
- **Neutrals are cool, not cream:** ink/paper/line pairs for both themes.
  The faint teal radial wash on the page background (9% light, 16% dark)
  is the only ambient tint. Reason: brand presence without competing with
  covers, which carry the page's real color.

## Typography

- **Bricolage Grotesque, extrabold, tight:** section titles, logo wordmark,
  rank numbers. Reason: the single distinctive voice; everything else stays
  neutral Inter so titles own the hierarchy.
- **Inter for body and meta:** titles 13-14px semibold, genre/time 11-12px
  muted, chapter links 12-13px semibold in primary teal. Reason: chapter
  links are the page's primary action cue, so they wear the action color;
  secondary meta stays small and quiet.
- **No uppercase labels with wide tracking, no monospace display type.**
  Badges are uppercase only because source/type codes read as stamps.

## Layout

- **One outer section card per list surface:** rounded-lg border, quiet
  fill, rows sit directly inside. Reason: a single container per job beats
  nested cards; rows separated by hairlines, not boxes.
- **Sections differ by content, not by template:** ranking rows carry rank
  numbers and views; update rows carry landscape thumbs and timestamps;
  history rows carry progress bars. Reason: RHYTHM 2, each section's anatomy
  follows its question.
- **Mobile is its own layout:** single-column rows, bottom tab bar for the
  four primary destinations, search expands inline under the header. Touch
  targets minimum 44px on section controls. Reason: the phone is where this
  app is read; desktop reflow (two-column row grids) only activates when it
  genuinely fits.

## Elevation & Depth

Flat surfaces, hairline borders, no page-wide shadow or blur. Elevation is
reserved for elements that leave the page: floating action button,
dropdown sheets, reader controls over artwork. The cover hover scrim
(black gradient over the image only) exists so the eye confirms the tap
target; it never decorates a solid surface.

## Shapes

Three radii, each with a job: pill for actions and navigation (things you
press), 8px for thumbs and small containers (things you look at), 16px for
outer section cards (things that group). Badges use 6px stamps. A section
title never needs a colored stripe beside it: the display face plus
whitespace carries the hierarchy.

## Components

- `button-primary` is the only high-emphasis action on a screen. One per
  decision point (Lanjutkan, Terbaru, Cari); everything secondary is an
  outline or quiet text.
- `nav-active` marks position with solid primary, no gradient.
- `badge-type` is a flat stamp, top-right on covers only.
- Section headers are typographic: display title plus a quiet "Lihat semua"
  link. No eyebrow pill above the title, no decorative bar.

## Do's and Don'ts

- Do keep every badge that carries real data (type, source, chapter).
  Don't add status pills (Baru, Hot, AI-style) that restate the headline.
- Do write filter labels that say what they are ("Genre", "+ Genre").
  Don't ship developer placeholders ("Genre 1", "Genre 2").
- Do let long isekai titles truncate with dignity (two-line clamp on list
  cards, one line in dense rows). Don't shrink type to fit the template.
- Don't add hero spotlights, stats, testimonials, or marketing copy. The
  covers and the update feed are the content; anything else is noise.
