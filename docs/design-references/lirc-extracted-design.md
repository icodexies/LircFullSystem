# LIRC System DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: Tailwind CSS 4.3.3 + React 19.2.8
> Colors: 3 · Fonts: 0 · Components: 72
> Icon library: not detected · State: not detected
> Primary theme: light · Dark mode toggle: no · Motion: expressive

---

## 1. Visual Theme & Atmosphere

This is a **light-themed** interface with a neutral, approachable feel. The light background emphasizes content clarity. Typography uses **sans-serif** throughout — a clean, modern choice that maintains consistency. Spacing follows a **4px base grid** (compact density), with scale: 4, 8, 12, 16, 20, 24, 32, 40px. Motion is expressive — spring physics, layout animations, and staggered reveals are part of the visual language.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| background | `#f7f6fb` | background | Page background, darkest surface |
| text-primary | `#0b1330` | text-primary | Headings and body text |
| info | `#3b4a86` | info | Informational highlights |


---

## 3. Typography Rules

No typography tokens detected.

---

## 4. Component Stylings

### Layout (29)

**ReportFilters** — `src/components/attendance/ReportFilters.jsx`
- Props: `kind`, `form`, `setForm`
- Key Styles: `rounded-xl`, `border-slate-100`, `bg-slate-50/60`, `px-5`, `text-xs`, `font-medium`, `hover:underline`
- State: useState

**ScannerPanel** — `src/components/attendance/ScannerPanel.jsx`
- Variants: `Enter`
- Props: `onChanged`, `onClose`, `onBusy`
- Key Styles: `space-y-4`, `text-xl`, `font-serif`
- State: useState, useRef

**WorkspaceUi** — `src/components/attendance/WorkspaceUi.jsx`
- Props: `eyebrow`, `title`, `description`, `actions`, `children`
- Key Styles: `rounded-2xl`, `border-white/10`, `bg-[#0B1330]`, `px-5`, `text-xs`, `font-semibold`, `opacity-[0.16]`, `pointer-events-none`
- Animation: tw-transitions: transition-colors

```tsx
<section className="relative overflow-hidden rounded-2xl bg-[#0B1330] px-5 py-6 sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={dots}
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 max-w-xl">
            <p className="text-xs font-semibold text-white/60">{eyebrow}</p>
            <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title}
```

**BookLoanDialog** — `src/components/borrow/BookLoanDialog.jsx`
- Props: `book`, `onClose`
- Key Styles: `rounded-2xl`, `border-white/10`, `bg-[#0B1330]`, `space-y-6`, `text-lg`, `font-semibold`, `opacity-[0.16]`, `pointer-events-none`
- State: useState

**ReturnAction** — `src/components/borrow/ReturnAction.jsx`
- Props: `loan`, `onDone`, `onCancel`
- Key Styles: `rounded-xl`, `border-slate-100`, `bg-[#F7F6FB]`, `space-y-5`, `text-xs`, `font-semibold`, `hover:underline`
- State: useState, useRef

```tsx
<section
      aria-label={`Return ${loan.accession_number}`}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-[#3B4A86] hover:underline"
          onClick={onCancel}
        >
          ← Back to copies
        </button>
```

**BookCover** — `src/components/catalog/BookCover.jsx`
- Props: `book`, `className`, `size`
- Key Styles: `rounded-xl`, `border-[#3B4A86]/10`, `bg-[#F0EDFA]`
- Animation: tw-transitions: transition-opacity, duration-300
- State: useState

```tsx
<div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#3B4A86]/10 bg-[#F0EDFA] ${className}`}
    >
      {src ? (
        <>
          {!loaded && (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center text-[#3B4A86]"
            >
              <Spinner size={size === "L" ? "md" : "sm"} />
            </span>
```

**BookDetails** — `src/components/catalog/BookDetails.jsx`
- Props: `title`, `rows`, `book`
- Key Styles: `rounded-full`, `border-red-100`, `bg-[#0B1330]`, `mb-3`, `text-sm`, `font-semibold`, `opacity-[0.16]`, `pointer-events-none`
- State: useState

```tsx
<section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0B1330]">
        <span
          aria-hidden="true"
          className="h-4 w-1 rounded-full bg-[#0B1330]"
        />
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {rows.map(([label, field]
```

**CoverUpload** — `src/components/catalog/CoverUpload.jsx`
- Props: `onChange`, `onBusy`
- Key Styles: `rounded-xl`, `border-dashed`, `bg-[#F7F6FB]`, `p-4`, `text-xs`, `font-medium`
- State: useState, useRef

*...and 21 more layout components.*

### Navigation (13)

**ReportExport** — `src/components/attendance/ReportExport.jsx`
- Props: `kind`, `periodId`, `filters`, `disabled`
- Key Styles: `ml-3`, `text-xs`
- State: useState, useRef

```tsx
<div>
      <button
        type="button"
        className={buttonClass}
        disabled={disabled || busy || !periodId}
        onClick={exportRows}
      >
        {busy ? "Exporting…" : "Export filtered CSV"}
      </button>
      {busy && (
        <button
          type="button"
```

**StaffUi** — `src/components/attendance/StaffUi.jsx`
- Props: `label`, `children`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-red-50`, `mb-1`, `text-xs`, `font-semibold`
- Animation: tw-transitions: transition-colors

```tsx
<label className="block text-xs text-slate-600">
      <span className="mb-1 block">{label}</span>
      {cloneElement(children, { "aria-label": label }
```

**AuthShell** — `src/components/auth/AuthShell.jsx`
- Props: `label`, `className`, `children`
- Key Styles: `rounded-3xl`, `border-white/30`, `bg-[#060A1C]/45`, `p-3`, `text-lg`, `font-semibold`, `opacity-90`, `pointer-events-none`

```tsx
<label className={`block ${className}`}>
      <div className={inputWrap}>
        <div className="w-full">
          <span className="block text-[9px] leading-tight text-white/60">
            {label}
          </span>
          {children}
        </div>
      </div>
    </label>
```

**DigitalSources** — `src/components/home/DigitalSources.jsx`
- Props: `d`, `className`, `strokeWidth`
- Key Styles: `rounded-full`, `border-white/25`, `bg-white`, `mt-1`, `text-2xl`, `font-[Fraunces]`, `hover:bg-slate-200`
- Animation: tw-animate-none, tw-transitions: duration-300, duration-700, transition-none, ease-in-out_infinite, hover-transforms

```tsx
<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
```

**HeroSection** — `src/components/home/HeroSection.jsx`
- Props: `slides`, `active`
- Key Styles: `rounded-full`, `border-white/30`, `bg-sky-400`, `gap-2`, `text-xs`, `font-semibold`, `backdrop-blur-md`, `hover:bg-sky-400`
- Animation: tw-transitions: transition-all, duration-1000, ease-out, duration-700, duration-300, transition-transform, duration-500, hover-transforms

```tsx
<>
      {slides.map((s, i
```

**HistoryList** — `src/components/inventory/HistoryList.jsx`
- Props: `summary`
- Key Styles: `rounded-xl`, `border-slate-100`, `bg-red-50`, `mt-1`, `text-xs`, `font-semibold`
- State: useState

**NavBar** — `src/components/layout/public/NavBar.jsx`
- Variants: `home`, `collection`, `about`
- Props: `top`, `behavior`
- Key Styles: `rounded-full`, `border-slate-200`, `bg-white/75`, `px-4`, `text-sm`, `font-[`, `shadow-lg`, `pointer-events-none`
- Animation: tw-transitions: transition-all, duration-300, transition-transform, transition-colors, hover-transforms
- State: useState

```tsx
<Link
      to={to}
      aria-current={active ? "location" : undefined}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300 ${
        active
          ? "bg-[#0B1330] text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#0B1330]"
      }`}
    >
      {children}
    </Link>
```

**NavLinks** — `src/components/layout/public/NavLinks.jsx`
- Props: `isActive`
- Animation: motion-variant: variants = {
  // Over images / dark backgrounds (header, hero, footer card)
  glass: {
    link: ({ isActive }, tw-transitions: transition-all, duration-300, hover-transforms

```tsx
<button
        type="button"
        className={`${base[safeVariant]} ${sizeClass} ${getState({ isActive: false }
```

*...and 5 more navigation components.*

### Data Display (3)

**VisitTable** — `src/components/attendance/VisitTable.jsx`
- Variants: `None`
- Props: `rows`, `onChanged`
- Key Styles: `border-slate-100`, `bg-[#F7F6FB]`, `px-5`, `text-xs`, `font-semibold`, `hover:bg-[#F7F6FB]/50`
- State: useState, useRef

```tsx
<>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-[#F7F6FB]">
            <tr>
              {[
                "Visitor/card",
                "Visitor type / year level",
                "Purpose / classifications",
                "Time in",
                "Time out",
                "Duration / status",
```

**Enrollments** — `src/pages/PrivatePages/Enrollments/Enrollments.jsx`
- Variants: `Unassigned`
- Props: `yearId`, `row`
- Key Styles: `border-slate-100`, `bg-[#F7F6FB]`, `space-y-6`, `text-xs`, `font-semibold`, `hover:bg-[#F7F6FB]/50`
- State: useState

**Statistics** — `src/pages/PrivatePages/Statistics/Statistics.jsx`
- Key Styles: `rounded-2xl`, `border-dashed`, `bg-[#F7F6FB]/60`, `space-y-6`, `text-xl`, `font-serif`

```tsx
<div className="space-y-6">
      <WorkspaceHeader
        title="Statistics"
        description="Library activity summaries at a glance."
      />
      <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#F7F6FB]/60 px-5 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F0EDFA] text-[#3B4A86]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
```

### Data Input (17)

**EnrollmentForm** — `src/components/attendance/EnrollmentForm.jsx`
- Props: `profile`, `year`, `enrollment`, `onSaved`, `onCancel`, `onBusy`
- Key Styles: `rounded-xl`, `border-slate-100`, `bg-[#F7F6FB]`, `space-y-5`, `text-xs`, `font-semibold`
- State: useState

**LoginModal** — `src/components/auth/LoginModal.jsx`
- Props: `email`, `password`, `remember`
- Key Styles: `rounded-t-2xl`, `border-2`, `bg-[#E8EEFF]`, `my-auto`, `text-xl`, `font-serif`, `shadow-[8px_8px_0_#0B1330]`, `hover:text-[#0B1330]`
- State: useState, useRef

**BorrowAction** — `src/components/borrow/BorrowAction.jsx`
- Props: `copy`, `onDone`, `onCancel`
- Key Styles: `rounded-xl`, `border-slate-100`, `bg-[#F7F6FB]`, `space-y-5`, `text-xs`, `font-semibold`, `hover:underline`
- State: useState, useRef

```tsx
<section aria-label={`Borrow ${copy.accession_number}`} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-[#3B4A86] hover:underline"
          onClick={onCancel}
        >
          ← Back to copies
        </button>
        <p className="text-xs text-slate-500">
          Copy <strong className="text-[#0B1330]">{copy.accession_number}</strong>
        </p>
```

**AddBookDialog** — `src/components/catalog/AddBookDialog.jsx`
- Variants: `Couldn`
- Props: `key`, `accession_number`, `shelf_id`
- Key Styles: `rounded-xl`, `border-red-100`, `bg-red-50`, `space-y-6`, `text-xs`, `font-bold`, `hover:underline`
- State: useState

**EditBook** — `src/components/catalog/EditBook.jsx`
- Variants: `Couldn`, `text`
- Props: `book`, `lookups`, `role`, `onClose`, `onSaved`
- Key Styles: `rounded-2xl`, `border-white/10`, `bg-[#0B1330]`, `p-6`, `text-lg`, `font-serif`, `opacity-[0.16]`, `pointer-events-none`
- State: useState

```tsx
<CatalogDialog
      title="Edit book record"
      onClose={closeEditor}
      busy={saving || preparing}
    >
      <form onSubmit={submit} className="p-6">
        {/* Context strip: shows the record as currently saved */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0B1330] p-4 sm:p-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={dots}
```

**ReviewTab** — `src/components/inventory/ReviewTab.jsx`
- Props: `session`, `onCounts`
- Key Styles: `rounded-xl`, `border-slate-100`, `bg-red-50`, `gap-2`, `text-xs`, `font-semibold`
- State: useState

**StartInventoryDialog** — `src/components/inventory/StartInventoryDialog.jsx`
- Props: `onCreated`, `onClose`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-red-50`, `space-y-4`, `text-xs`
- State: useState

```tsx
<Modal
      title="Start an inventory"
      description="Name it and choose its year — for example Annual Inventory 2026."
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-5 w-5"
          aria-hidden="true"
        >
```

**PeriodForm** — `src/components/periods/PeriodForm.jsx`
- Props: `kind`, `record`, `years`, `onSaved`, `onCancel`, `onBusy`
- Key Styles: `rounded-xl`, `border-slate-100`, `bg-[#F7F6FB]`, `space-y-5`, `text-xs`
- State: useState

```tsx
<form onSubmit={save} className="space-y-5 p-6">
      <p className="rounded-xl bg-[#F7F6FB] px-4 py-3 text-xs leading-relaxed text-slate-500">
        {semester
          ? "Use the official semester name and school dates. Saving does not activate this semester."
          : "Set the school calendar for this academic year. Both semesters must fit within these dates."}
      </p>
      <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
        {semester ? (
          <>
            <Field label="Academic year">
              <select
                required
```

*...and 9 more data input components.*

### Feedback (4)

**NotificationBell** — `src/components/layout/member/NotificationBell.jsx`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-red-500`, `p-2.5`, `text-xs`, `font-bold`, `shadow-xl`, `hover:bg-slate-50`
- Animation: tw-transitions: transition-colors
- State: useState, useRef

**Loading** — `src/components/ui/Loading.jsx`
- Props: `size`, `color`, `className`
- Key Styles: `bg-white/90`, `gap-4`, `text-xs`, `font-medium`, `backdrop-blur-sm`, `cursor-wait`
- State: useRef

```tsx
<span aria-hidden="true" className={`inline-flex ${className}`}>
      <Metronome
        size={PIXELS[size] ?? PIXELS.md}
        speed={1.6}
        color={color}
      />
    </span>
```

**Skeleton** — `src/components/ui/Skeleton.jsx`
- Props: `className`
- Key Styles: `rounded-2xl`, `border-slate-200`, `bg-white`, `gap-4`
- Animation: framer-motion, tw-animate-pulse, tw-animate-none

```tsx
<span
      aria-hidden="true"
      className={`block animate-pulse rounded-lg bg-[#F0EDFA] motion-reduce:animate-none ${className}`}
    />
```

**Toast** — `src/components/ui/Toast.jsx`
- Variants: `error`
- Props: `variant`, `title`, `message`, `onClose`
- Key Styles: `rounded-xl`, `border-2`, `gap-3`, `text-sm`, `font-bold`, `shadow-lg`, `pointer-events-auto`
- Animation: tw-transitions: transition-opacity

```tsx
<div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className={`toast-in pointer-events-auto flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-lg shadow-slate-900/10 ${palette.wrap}`}
    >
      <span className={`mt-0.5 shrink-0 ${palette.icon}`}>
        {ICONS[variant] ?? ICONS.info}
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <p className={`text-sm font-bold leading-snug ${palette.text}`}>
            {title}
          </p>
```

### Overlay (1)

**Modal** — `src/components/ui/Modal.jsx`
- Props: `title`, `description`, `icon`, `tone`, `size`, `busy`, `onClose`, `footer` (+3 more)
- Key Styles: `rounded-lg`, `border-slate-200`, `bg-gradient-to-r`, `gap-4`, `text-lg`, `font-serif`, `opacity-[0.16]`, `hover:bg-slate-100`
- Animation: tw-transitions: transition-colors
- State: useRef

```tsx
<dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event
```

### Other (5)

**ManilaClock** — `src/components/attendance/ManilaClock.jsx`
- State: useState

**CatalogDialog** — `src/components/catalog/CatalogDialog.jsx`

**ArrowIcon** — `src/components/home/ArrowIcon.jsx`
- Props: `direction`

```tsx
<svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${
        direction === "left" ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
```

**DeferredRender** — `src/components/ui/DeferredRender.jsx`
- Props: `children`, `id`, `reserveClassName`, `rootMargin`
- State: useState, useRef

**Reveal** — `src/components/ui/Reveal.jsx`
- Props: `children`, `direction`, `delay`, `duration`, `distance`, `threshold`, `once`, `easing` (+1 more)
- State: useState, useRef



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- **Border radius:** 4px, 8px, 12px, 16px, 24px
- **Grid usage:** `grid-cols-2`, `grid-cols-1`, `grid-cols-3`, `col-span-3`, `col-span-2`
- **Container:** Tailwind `container` class with responsive padding

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 4-8px | Tight: related items within a group |
| 12-16px | Medium: between groups |
| 24-32px | Wide: between sections |
| 48px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

No box-shadow values detected. The design appears to use a flat visual style.


---

## 7. Animation & Motion

This project uses **expressive motion**. Animations are an integral part of the experience.

### Framer Motion Patterns

```tsx
// Standard enter animation
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
/>

// List stagger
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } }
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 }
}
```

### CSS Animations

- `@keyframes toast-in`
- `@keyframes animate-none`
- `@keyframes animate-pulse`

### Animated Components

- **StaffUi**: tw-transitions: transition-colors
- **WorkspaceUi**: tw-transitions: transition-colors
- **BookCover**: tw-transitions: transition-opacity, duration-300
- **About**: tw-transitions: transition-transform, duration-700, hover-transforms
- **BookCollection**: tw-transitions: transition-all, duration-1000, ease-out, hover-transforms

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use `#f7f6fb` as the primary page background
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use border and background shifts for elevation — not shadows
- Use border-radius from the scale: 4px, 8px, 12px, 16px, 24px
- Reuse existing components from Section 4 before creating new ones

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't add box-shadow — this design system uses flat elevation
- Don't use gradients — the design uses solid colors only
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first

### Anti-Patterns (detected from codebase)

- No box-shadow on any element
- No gradient backgrounds
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

No breakpoints detected. Consider adding responsive breakpoints to the design system.

---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #f7f6fb
Border: 1px solid var(--border)
Radius: 12px
Padding: 16px
Font: sans-serif
No shadows — use borders and surface colors for depth.
```

### Build a Button

```
Primary: bg var(--accent), text white
Ghost: bg transparent, border var(--border)
Padding: 8px 16px
Radius: 12px
Hover: opacity 0.9 or lighter shade
Focus: ring with var(--accent)
```

### Build a Page Layout

```
Background: #f7f6fb
Max-width: 1280px, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #f7f6fb
Label: var(--text-muted) (muted, 12px, uppercase)
Value: #0b1330 (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: #f7f6fb
Input border: 1px solid var(--border)
Focus: border-color var(--accent)
Label: var(--text-muted) 12px
Spacing: 16px between fields
Radius: 12px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: sans-serif, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: flat, surface shifts
```
