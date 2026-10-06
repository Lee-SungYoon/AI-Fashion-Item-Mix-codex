# AI Fashion / Item Mix — Design System

> Studio Editorial Synthesis Engine · PRO

## Product character

The interface should feel like a dark, high-end fashion production studio: quiet, editorial, precise, and image-led. Prioritize the uploaded references and generated result over decorative UI.

## Foundations

### Color

| Token | Value | Usage |
| --- | --- | --- |
| `canvas` | `#000000` | App background and empty image states |
| `surface` | `#090909` | Input surfaces, cards, and controls |
| `surface-subtle` | `#18181B` | Secondary controls and download actions |
| `border` | `#27272A` | Dividers, fields, and upload frames |
| `text-primary` | `#FFFFFF` | Headings and key labels |
| `text-secondary` | `#A1A1AA` | Supporting copy and descriptions |
| `text-muted` | `#52525B` | Metadata and inactive labels |
| `accent-indigo` | `#5456F3` | Brand badge, focus, and active upload state |
| `accent-green` | `#19AD55` | Primary image-generation action |
| `feedback-error` | `#DC2626` | Error toast and destructive hover states |

### Typography

- Typeface: Inter, with `ui-sans-serif`, `system-ui`, and sans-serif fallbacks.
- Product title: 36px, 700 weight, tight tracking.
- Section labels: 14px, 900 weight, uppercase.
- Control labels: 11–12px, 700–900 weight.
- Supporting copy: 11–13px, 400–500 weight.
- Keep copy concise; the visual output is the primary content.

### Shape and spacing

- Card and input radius: 16px (`rounded-2xl`).
- Upload tile radius: 12px (`rounded-xl`).
- Compact controls: 8–12px radius.
- Use 4px spacing increments; major sections use 40–48px vertical rhythm.
- Hide scrollbars while preserving native scrolling.

## Components

### Header

- Center the product title and PRO badge.
- Use a subtle bottom border (`border-zinc-900`).
- Keep session reset at the far right as a low-emphasis text action.

### Image upload tile

- Square aspect ratio.
- Dashed border in the idle state.
- Indigo border and dark surface when an image is loaded.
- Show a plus icon and `UPLOAD` label when empty.
- Show a small trash action in the top-right corner when populated.
- Show a dark translucent loading veil with an indigo spinner during analysis.

### Primary action

- Use the green accent for `Generate Image(2K)`.
- Full-width, 24px vertical padding, 16px radius.
- Reduce opacity while disabled or processing.
- Use a subtle scale-down interaction on press.

### Secondary action

- Use the dark surface and muted border for downloads and utility actions.
- Pair an icon with a short, explicit label such as `Download PNG`.

### Error toast

- Fixed near the bottom center of the viewport.
- Red translucent background with backdrop blur.
- Include a warning icon, concise uppercase message, and dismiss button.
- Auto-dismiss after five seconds.

## Interaction states

| State | Treatment |
| --- | --- |
| Idle | Black canvas, muted borders, low-contrast helper text |
| Hover | Slightly brighter border or surface; no layout shift |
| Focus | Indigo border or ring; preserve dark contrast |
| Loading | Disable the active action and show an inline spinner/status |
| Success | Show the generated image and enable PNG download |
| Error | Keep user input intact and show a dismissible error toast |
| Destructive | Use red only for delete/error affordances |

## Layout

- Desktop: two-column layout with a vertical divider.
- Left column: references, clothing items, and prompt input.
- Right column: generated output, prompt tools, and download actions.
- Mobile: collapse to one column in source order; keep controls full width.
- Image content uses `object-contain`; never crop user references by default.

## Accessibility

- Every uploaded image must have an alt label derived from its slot name.
- Keep text/background contrast high on the dark canvas.
- Preserve keyboard access to all buttons, labels, and file inputs.
- Do not rely on color alone for loading, errors, or destructive actions.
- Keep interactive hit areas at least 40px where practical.

## Content guidelines

- Prefer direct, production-oriented labels: `References`, `Clothing Items`, `Prompt 추가`, `Studio Output`.
- Use sentence case for explanatory text and uppercase only for compact navigation/status labels.
- Error messages should explain what happened and what the user can do next.
- Avoid exposing API keys or provider credentials in user-facing UI.

## Implementation notes

- Tailwind CSS utilities are the source of truth for component styling.
- Global theme values live in `index.css`.
- Reusable upload behavior lives in `components/ImageUpload.tsx`.
- Keep generated output and source references visually distinct.
