# Subcontractor Truck Management System - Design System

## Overview
ระบบจัดการรถบรรทุกผู้รับเหมาช่วง สำหรับธุรกิจ Logistics/Transportation

## Design Philosophy
**Industrial Refined** - ผสมผสานความเป็น Professional ของธุรกิจขนส่งกับความทันสมัย

---

## 1. Color Palette

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Cyan 500** | `#06b6d4` | Primary actions, links |
| **Blue 500** | `#3b82f6` | Secondary actions |
| **Amber 500** | `#f59e0b` | Warnings, pending states |

### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Emerald 500** | `#10b981` | Success, completed |
| **Rose 500** | `#f43f5e` | Error, rejected |
| **Slate 900** | `#0f172a` | Dark backgrounds |
| **Slate 50** | `#f8fafc` | Light backgrounds |

### Status Colors
| Status | Background | Text | Border |
|--------|------------|------|--------|
| New Request | `bg-rose-50` | `text-rose-700` | `border-rose-200` |
| Pending Pricing | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| Assigned | `bg-blue-50` | `text-blue-700` | `border-blue-200` |
| Completed | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |
| Billed | `bg-slate-50` | `text-slate-700` | `border-slate-200` |

---

## 2. Typography

### Font Families
- **Display/Headings**: `Outfit` - Modern geometric sans-serif
- **Body/UI**: `Plus Jakarta Sans` - Readable, professional

### Font Sizes
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | `text-2xl` (24px) | `font-black` (900) | 1.2 |
| H2 | `text-xl` (20px) | `font-bold` (700) | 1.3 |
| H3 | `text-lg` (18px) | `font-bold` (700) | 1.4 |
| Body | `text-sm` (14px) | `font-medium` (500) | 1.5 |
| Caption | `text-xs` (12px) | `font-bold` (700) | 1.4 |
| Label | `text-[10px]` | `font-black` (900) | 1.2 |

### Typography Rules
- Labels: UPPERCASE, tracking-widest
- Numbers: font-mono for IDs and prices
- Thai text: Ensure proper line-height (1.5+)

---

## 3. Spacing & Layout

### Border Radius
| Element | Radius |
|---------|--------|
| Buttons | `rounded-xl` (12px) |
| Cards | `rounded-2xl` (16px) |
| Modals | `rounded-3xl` (24px) |
| Pills/Tags | `rounded-full` |

### Shadows
| Level | Class | Usage |
|-------|-------|-------|
| Subtle | `shadow-sm` | Cards at rest |
| Medium | `shadow-lg` | Hover states |
| Strong | `shadow-2xl` | Modals, dropdowns |

### Spacing Scale
- Base unit: 4px
- Common: `p-4`, `p-6`, `p-8`, `gap-4`, `gap-6`

---

## 4. Components

### Buttons
```css
/* Primary */
.btn-primary {
  @apply px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest;
  @apply hover:bg-blue-700 active:scale-95 transition-all;
}

/* Secondary */
.btn-secondary {
  @apply px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest;
  @apply hover:bg-slate-200 active:scale-95 transition-all;
}

/* Danger */
.btn-danger {
  @apply px-6 py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest;
  @apply hover:bg-rose-700 active:scale-95 transition-all;
}
```

### Cards
```css
.card {
  @apply bg-white rounded-2xl border border-slate-100 shadow-sm;
  @apply hover:shadow-lg transition-all;
}

.card-dark {
  @apply bg-slate-900 rounded-2xl border border-slate-800;
}
```

### Form Inputs
```css
.input {
  @apply w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50;
  @apply focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500;
  @apply outline-none transition-all font-bold text-slate-800;
}
```

---

## 5. Accessibility (CRITICAL)

### Color Contrast
- Minimum 4.5:1 ratio for normal text
- Minimum 3:1 for large text (18px+ or 14px bold)

### Touch Targets
- Minimum 44x44px for all interactive elements
- Add `cursor-pointer` to all clickable elements

### Focus States
- Visible focus rings: `focus:ring-4 focus:ring-blue-100`
- Never remove focus outlines

### ARIA Labels
- Icon-only buttons must have `aria-label`
- Form inputs must have associated labels

---

## 6. Animation Guidelines

### Duration
| Type | Duration |
|------|----------|
| Micro-interactions | 150-200ms |
| Page transitions | 300ms |
| Complex animations | 500ms |

### Easing
- Default: `ease-out`
- Bounce: `cubic-bezier(0.34, 1.56, 0.64, 1)`

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Icons

### Icon Library
- **Lucide React** - Consistent, clean icons
- Size: 16px (small), 20px (default), 24px (large)

### Rules
- ❌ Never use emojis as functional icons
- ✅ Use SVG icons from Lucide
- Emojis allowed only for decorative purposes in content

---

## 8. Anti-Patterns to Avoid

| Don't | Do Instead |
|-------|------------|
| Use Inter/Roboto/Arial | Use Outfit + Plus Jakarta Sans |
| Purple gradients on white | Use brand colors (Cyan/Blue) |
| Emojis as UI icons | Use Lucide icons |
| Scale transforms on hover (causes layout shift) | Use color/opacity transitions |
| Generic rounded corners | Use consistent radius scale |
| Hard-coded colors | Use CSS variables |

---

## 9. File Structure

```
/components
  /ui          - Reusable UI components
  /forms       - Form components
  /modals      - Modal dialogs
  /dashboards  - Dashboard views
/utils
  /format.ts   - Formatting utilities
/types.ts      - TypeScript types
/constants.ts  - App constants
```

---

## 10. Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as functional icons
- [ ] All icons from Lucide
- [ ] Hover states don't cause layout shift
- [ ] Consistent border radius

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Transitions are smooth (150-300ms)
- [ ] Focus states visible

### Accessibility
- [ ] Color contrast 4.5:1 minimum
- [ ] Touch targets 44x44px minimum
- [ ] Form inputs have labels
- [ ] `prefers-reduced-motion` respected

### Performance
- [ ] Images optimized (WebP, lazy loading)
- [ ] No layout shift on load

---

## 11. Mobile & Adaptive Design

### Breakpoints
| Name | Width | Usage |
|------|-------|-------|
| **Mobile** | < 640px | Single column, stacked layouts |
| **Tablet** | 640px - 1024px | 2-column grids |
| **Desktop** | > 1024px | Full layouts, sidebars |

### Mobile-First Principles
1. **Touch Targets**: Minimum 44x44px for all interactive elements
2. **Font Size**: Minimum 16px for inputs (prevents iOS zoom)
3. **Spacing**: Reduced padding/gaps on mobile
4. **Grids**: Stack to single column on mobile
5. **Charts**: Reduced height on mobile (200-250px)

### Responsive Classes
```css
/* Hide on mobile */
.hide-mobile { display: block; }
@media (max-width: 640px) { .hide-mobile { display: none !important; } }

/* Show only on mobile */
.show-mobile { display: none; }
@media (max-width: 640px) { .show-mobile { display: block !important; } }

/* Stack flex items on mobile */
.mobile-stack { /* stacks vertically on mobile */ }

/* Full width on mobile */
.mobile-full-width { /* 100% width on mobile */ }
```

### Touch Device Adjustments
- Remove hover effects on touch devices
- Use active states instead of hover
- Larger touch targets
- Swipe-friendly horizontal scrolling

### Safe Areas (Notched Devices)
```css
.safe-area-inset {
  padding-left: max(1rem, env(safe-area-inset-left));
  padding-right: max(1rem, env(safe-area-inset-right));
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

### Mobile Modal Pattern
- Full screen on mobile (no margins)
- Bottom sheet style for actions
- Slide up animation
- Handle bar for drag indication
