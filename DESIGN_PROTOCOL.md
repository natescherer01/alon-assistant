# Alon Technologies Design Protocol

**Version:** 1.0
**Last Updated:** November 2025
**Status:** Active

---

## Table of Contents

1. [Brand Overview](#brand-overview)
2. [Visual Identity](#visual-identity)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Components](#components)
7. [Motion & Animation](#motion--animation)
8. [Voice & Messaging](#voice--messaging)
9. [Accessibility](#accessibility)
10. [Implementation Guidelines](#implementation-guidelines)

---

## Brand Overview

### Brand Essence

Alon Technologies simplifies the complex world of NIL (Name, Image, Likeness) partnerships through intelligent, AI-powered technology. Our brand communicates clarity, innovation, and empowerment.

### Brand Personality

- **Innovative:** Leading-edge AI technology
- **Trustworthy:** Transparent, compliant, reliable
- **Empowering:** Enabling athletes and brands to succeed
- **Modern:** Contemporary design and technology
- **Accessible:** Complex technology made simple

### Target Audiences

1. College Athletes
2. Brands & Marketers
3. Universities & Athletic Programs
4. Sports Agents
5. Marketing Agencies

---

## Visual Identity

### Logo

- **Primary Logo:** `images/alon-logo.png`
- **Favicon:** `images/favicon.svg`
- **Logo Height:** 40px (navbar)
- **Minimum Clear Space:** 16px on all sides
- **Logo Treatments:**
  - Full color on light backgrounds
  - White on dark backgrounds
  - Never distort, rotate, or apply effects

### Logo Usage

```html
<!-- Standard Logo Implementation -->
<a href="/" class="logo" aria-label="Alon Technologies Home">
  <img src="/images/alon-logo.png" alt="Alon Technologies" class="logo-img">
</a>
```

**Proper Usage:**
- Maintain aspect ratio
- Use on clean, uncluttered backgrounds
- Ensure sufficient contrast

**Improper Usage:**
- Do not place on busy backgrounds
- Do not use gradient overlays on logo
- Do not change brand colors

---

## Color System

### Primary Colors

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Primary Blue | `#0066FF` | Primary actions, links, accents |
| White | `#FFFFFF` | Backgrounds, text on dark |
| Black | `#000000` | Body text, high-contrast elements |

### Secondary Colors

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Light Gray | `#F5F5F7` | Section backgrounds, cards |
| Dark Charcoal | `#1A1A1A` | Footer, dark sections |

### Gradient Colors

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Gradient Purple | `#4040B0` | Background gradients (start) |
| Gradient Cyan | `#00D4DD` | Background gradients (end) |

### CSS Variables

```css
:root {
  /* Colors */
  --color-primary: #0066FF;
  --color-white: #FFFFFF;
  --color-black: #000000;
  --color-light-gray: #F5F5F7;
  --color-dark-charcoal: #1A1A1A;
  --color-gradient-start: #4040B0;
  --color-gradient-end: #00D4DD;
}
```

### Color Application

**Primary Blue (#0066FF)**
- Call-to-action buttons
- Links and navigation active states
- Icons and feature accents
- Hover states (with 0.06-0.1 opacity overlays)

**Gradients**
- Hero section backgrounds (radial gradients with blur)
- CTA section backgrounds
- Applied with multiple radial-gradient layers
- Blur: 180px (desktop), 120px (mobile)

**Example Gradient Implementation:**
```css
background-image:
  radial-gradient(circle 1200px at 15% 20%,
    rgba(64, 64, 176, 0.6) 0%,
    rgba(64, 64, 176, 0.3) 30%,
    rgba(64, 64, 176, 0.1) 50%,
    transparent 70%
  ),
  radial-gradient(circle 1100px at 90% 60%,
    rgba(0, 212, 221, 0.5) 0%,
    rgba(0, 212, 221, 0.25) 35%,
    rgba(0, 212, 221, 0.1) 50%,
    transparent 70%
  );
filter: blur(180px);
```

---

## Typography

### Font Stack

**Primary:** Neue Montreal (Custom)
**Secondary:** Montserrat (Google Fonts)
**System Fallbacks:** -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Arial', sans-serif

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Subtle emphasis, large text |
| Regular | 400 | Body copy, descriptions |
| Medium | 500 | Navigation, labels |
| Bold | 700 | Headings, subheadings |
| Black | 900 | Hero headlines, major headings |

### Type Scale

```css
:root {
  /* Font Sizes */
  --font-size-display: 80px;           /* Hero headlines (desktop) */
  --font-size-display-mobile: 48px;    /* Hero headlines (mobile) */
  --font-size-title: 48px;             /* Section titles (desktop) */
  --font-size-title-mobile: 36px;      /* Section titles (mobile) */
  --font-size-subtitle: 24px;          /* Subtitles, card headings */
  --font-size-body: 18px;              /* Body text, descriptions */
  --font-size-small: 16px;             /* Footer links, secondary text */
  --font-size-tiny: 14px;              /* Labels, card numbers */

  /* Line Heights */
  --line-height-tight: 1.1;            /* Headlines */
  --line-height-normal: 1.6;           /* Body text */
}
```

### Typography Hierarchy

**Hero Headlines (H1)**
```css
font-size: 48px / 80px (mobile / desktop);
font-weight: 900;
line-height: 1.1;
letter-spacing: -0.03em;
```

**Section Titles (H2)**
```css
font-size: 36px / 48px (mobile / desktop);
font-weight: 700;
text-align: center;
```

**Subtitles (H3)**
```css
font-size: 24px;
font-weight: 700;
```

**Body Text (P)**
```css
font-size: 18px;
font-weight: 400;
line-height: 1.6;
```

### Typography Best Practices

- Use font-display: swap for web fonts
- Apply -webkit-font-smoothing: antialiased for Mac
- Use negative letter-spacing (-0.02em to -0.03em) on large headlines
- Maintain minimum body text size of 18px for readability
- Ensure sufficient line-height (1.6) for body copy

---

## Spacing & Layout

### Spacing System (8px Grid)

```css
:root {
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-100: 100px;
  --spacing-120: 120px;
}
```

**All spacing should follow the 8px grid system.**

### Container System

```css
:root {
  --container-max: 1280px;
  --container-padding: 24px;
}

.container {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 0 var(--container-padding);
}
```

### Section Spacing

- **Section Padding:** 100px (mobile/desktop)
- **Hero Section:** 100px top, 120px bottom (mobile); 120px both (desktop)
- **Title Bottom Margin:** 80px
- **Between Elements:** 24px-48px depending on hierarchy

### Grid Systems

**Cards Grid (Who We Serve)**
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns
- Gap: 24px

**Features Grid**
- Mobile: 1 column
- Desktop: 2 columns
- Gap: 32px

**Steps Grid**
- Mobile: 1 column
- Desktop: 3 columns
- Gap: 48px

### Border Radius

```css
:root {
  --radius-card: 24px;
  --radius-button: 16px;
}
```

- Cards: 24px
- Buttons: 16px (primary), 8px (navigation)
- Icons: 16px (feature icons), 50% (step icons)

---

## Components

### Navigation Bar

**Styling:**
- Position: Sticky
- Background: `rgba(255, 255, 255, 0.7)` with backdrop-filter blur(20px)
- Border Bottom: 1px solid rgba(0, 0, 0, 0.06)
- Padding: 16px vertical (12px when scrolled)
- Transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1)

**States:**
- Default: Semi-transparent with blur
- Scrolled: Slightly more opaque, reduced padding, subtle shadow
- Active Page: Primary color with 8% opacity background

**Implementation:**
```css
.navbar {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  padding: 16px 0;
  z-index: 1000;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
```

### Cards

**White Card:**
```css
background-color: #F5F5F7;
color: #000000;
padding: 48px;
border-radius: 24px;
```

**Black Card:**
```css
background-color: #000000;
color: #FFFFFF;
padding: 48px;
border-radius: 24px;
```

**Card Elements:**
- Number Label: Positioned absolute, top-left, 14px, bold, 50% opacity
- Heading: 24px, bold, uppercase, 0.05em letter-spacing
- Description: 18px, 90% opacity

**Hover State:**
```css
transform: translateY(-4px);
box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
transition: transform 0.2s, box-shadow 0.2s;
```

### Buttons

**Primary Button:**
```css
background: #0066FF;
color: #FFFFFF;
padding: 8px 20px;
border-radius: 8px;
font-size: 15px;
font-weight: 500;
```

**Hover State:**
```css
background: #0052CC;
transform: translateY(-1px);
box-shadow: 0 2px 8px rgba(0, 102, 255, 0.2);
```

**Large CTA Button:**
```css
padding: 16px 48px;
background-color: #FFFFFF;
color: #0066FF;
border-radius: 16px;
font-size: 18px;
font-weight: 700;
```

### Feature Cards

```css
padding: 40px;
background-color: #F5F5F7;
border-radius: 24px;
```

**Feature Icon:**
```css
width: 56px;
height: 56px;
background-color: #0066FF;
border-radius: 16px;
display: flex;
align-items: center;
justify-content: center;
font-size: 28px;
color: #FFFFFF;
```

### Mobile Menu

**Design:**
- Position: Fixed right
- Width: 85% (max 400px)
- Background: `rgba(255, 255, 255, 0.98)` with backdrop blur
- Box Shadow: -4px 0 24px rgba(0, 0, 0, 0.1)
- Slide-in Animation: 0.4s cubic-bezier(0.4, 0, 0.2, 1)

**Menu Items:**
- Staggered animation delay (0.05s increments)
- Slide from right with fade-in
- Padding: 16px vertical, 32px horizontal
- Active state: Primary color with background tint

### Forms

**Email Input:**
```css
padding: 16px 24px;
border-radius: 16px;
border: 2px solid #FFFFFF;
font-size: 18px;
background-color: rgba(255, 255, 255, 0.95);
```

**Focus State:**
```css
outline: none;
border-color: #FFFFFF;
box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3);
```

---

## Motion & Animation

### Principles

1. **Purposeful:** Every animation serves a function
2. **Subtle:** Enhance, don't distract
3. **Performant:** Use transform and opacity for animations
4. **Consistent:** Use standard easing and timing

### Easing Functions

- **Standard:** `cubic-bezier(0.4, 0, 0.2, 1)` - General purpose
- **Ease:** Default for simple transitions

### Timing

```css
/* Standard transitions */
transition: all 0.2s ease;  /* Hover states, buttons */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);  /* Navigation, modals */
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);  /* Mobile menu */
```

### Common Animations

**Button Hover:**
```css
transform: translateY(-1px);
box-shadow: 0 2px 8px rgba(0, 102, 255, 0.2);
```

**Card Hover:**
```css
transform: translateY(-4px);
box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
```

**Mobile Menu Items (Staggered):**
```css
opacity: 0;
transform: translateX(20px);
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

/* Active state */
opacity: 1;
transform: translateX(0);
```

### Scroll Behavior

```css
html {
  scroll-behavior: smooth;
}
```

### Performance Optimizations

```css
will-change: transform;  /* For animated elements */
transform: translateZ(0);  /* Force GPU acceleration */
```

---

## Voice & Messaging

### Brand Voice

**Characteristics:**
- **Clear:** No jargon, straightforward language
- **Confident:** Authoritative but not arrogant
- **Empowering:** Focus on user success
- **Direct:** Get to the point quickly
- **Modern:** Contemporary, tech-savvy tone

### Writing Guidelines

**Headlines:**
- Short and punchy (2-5 words)
- Lead with benefit or action
- Use sentence case
- Examples: "NIL, Simplified." "From Concept to Campaign"

**Subheadings:**
- Expand on headline (5-10 words)
- Maintain clarity
- Focus on value proposition

**Body Copy:**
- Concise sentences (15-20 words max)
- Active voice preferred
- Benefit-driven
- 18px minimum for readability

**Call-to-Action:**
- Action verbs
- Clear benefit
- Examples: "Join Waitlist," "Get Started," "Learn More"

### Messaging Hierarchy

1. **Primary Message:** Simplification of NIL
2. **Secondary Message:** AI-powered intelligence
3. **Supporting Messages:** Specific features and benefits

### Tone by Audience

**Athletes:** Empowering, opportunity-focused
**Brands:** Results-driven, ROI-focused
**Universities:** Compliance-focused, protective
**Agents:** Efficiency-focused, deal-closing
**Agencies:** Scale-focused, automation

### Example Messaging

**DO:**
- "Find deals that match your brand"
- "Track deliverables. Know your worth."
- "AI-powered compatibility scoring"

**DON'T:**
- "Leverage synergistic partnerships"
- "Utilize our platform's capabilities"
- "Revolutionary paradigm shift"

---

## Accessibility

### Color Contrast

- **Body Text on White:** AAA compliant (21:1 ratio)
- **Primary Blue on White:** AA compliant
- **White on Primary Blue:** AAA compliant
- Test all new color combinations for WCAG 2.1 AA compliance minimum

### Typography Accessibility

- **Minimum Font Size:** 18px for body text
- **Line Height:** 1.6 minimum for body copy
- **Line Length:** Max 700px for comfortable reading
- **Font Smoothing:** Applied for improved rendering

### ARIA Labels

Always include:
```html
<!-- Navigation -->
<nav role="navigation" aria-label="Main navigation">

<!-- Buttons -->
<button aria-label="Open mobile menu" aria-expanded="false">

<!-- Links with Icons -->
<a href="/" aria-label="Alon Technologies Home">

<!-- Forms -->
<label for="email" class="sr-only">Email address</label>
<input type="email" id="email" aria-required="true">
```

### Screen Reader Support

**Screen Reader Only Text:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Visible focus states required
- Logical tab order maintained
- Skip navigation links for long pages

### Focus States

```css
/* Visible focus indicator */
:focus {
  outline: 2px solid #0066FF;
  outline-offset: 2px;
}

/* For inputs */
input:focus {
  border-color: #FFFFFF;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3);
}
```

### Semantic HTML

- Use proper heading hierarchy (H1 → H2 → H3)
- Use semantic elements (nav, main, section, article, footer)
- Include alt text for all images
- Use button elements for actions, anchor tags for navigation

---

## Implementation Guidelines

### File Structure

```
/
├── index.html
├── [audience-pages].html
├── /images/
│   ├── alon-logo.png
│   ├── favicon.svg
│   └── [other-images]
├── /font/
│   ├── NeueMontreal-Light.otf
│   ├── NeueMontreal-Regular.otf
│   ├── NeueMontreal-Medium.otf
│   └── NeueMontreal-Bold.otf
└── DESIGN_PROTOCOL.md
```

### CSS Organization

Styles should be organized in the following order:
1. Font Faces
2. CSS Reset & Base Styles
3. CSS Variables (Design System)
4. Utility Classes
5. Component Styles (alphabetically)
6. Media Queries (component-specific)

### Responsive Breakpoints

```css
/* Mobile First Approach */

/* Mobile: Default (0-767px) */

/* Tablet: 768px and up */
@media (min-width: 768px) { }

/* Desktop: 1024px and up */
@media (min-width: 1024px) { }
```

### HTML Best Practices

- Include comprehensive meta tags (SEO, social sharing)
- Use semantic HTML5 elements
- Include structured data (schema.org)
- Implement proper heading hierarchy
- Add ARIA labels for accessibility
- Include lang attribute on html element

### Performance

- Use font-display: swap for web fonts
- Lazy load images when appropriate
- Minimize CSS/JS file size
- Use GPU acceleration for animations (transform, opacity)
- Implement smooth scroll with scroll-behavior: smooth

### Browser Support

- Modern browsers (last 2 versions)
- Safari (with -webkit- prefixes for backdrop-filter)
- Progressive enhancement approach
- Graceful degradation for older browsers

### Quality Checklist

Before launching any new page or feature:

- [ ] All colors use CSS variables
- [ ] Spacing follows 8px grid
- [ ] Typography uses defined scale
- [ ] Color contrast meets WCAG AA minimum
- [ ] ARIA labels present where needed
- [ ] Keyboard navigation functional
- [ ] Responsive on mobile, tablet, desktop
- [ ] Animations use performant properties
- [ ] Meta tags and structured data included
- [ ] Images have alt text
- [ ] Forms have proper labels
- [ ] Links have descriptive text

---

## Version History

**Version 1.0** - November 2025
- Initial design protocol documentation
- Established core brand guidelines
- Documented existing design system
- Defined accessibility standards

---

## Maintenance

This design protocol should be reviewed and updated:
- Quarterly for minor updates
- Annually for major reviews
- When introducing new brand elements
- When expanding to new platforms

**Document Owner:** Design Team
**Last Review:** November 2025
**Next Review:** February 2026

---

**For questions or clarifications about this design protocol, contact:**
contact@alontechnologies.com
