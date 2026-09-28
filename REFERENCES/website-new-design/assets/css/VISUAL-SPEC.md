# Wedagedara — Pixel-Perfect Visual & Animation Spec

> Research-only spec derived from `REFERENCES/website-new-design/assets/`. All values are exact.
> This is the reference "Wedagedara" design that the ERP/website redesign must match.

---

## Global Design Tokens (used across all modules)

| Token | Value |
|---|---|
| Brand lime accent | `#97c93e` (hover: `#b2db58`) |
| Deep forest base | `#051610` |
| Deep emerald panel | `#082017` |
| Darker gradient footer | `#030e0a` → `#010705` |
| Emerald card bg (modal-left) | `#0d2e22` / `#09241b` |
| Off-white text | `#e2e8f0`, `#ffffff` |
| Muted text | `#94a3b8`, `#cbd5e1`, `#64748b` |
| Serif font | `var(--font-serif)` (Cinzel) |
| Sans font | `var(--font-sans)` |
| Standard easing | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Standard corner radius scale | `20px` / `24px` / `28px` / `32px` / `36px` / `40px` / pill `9999px` |

---

## 1. TESTIMONIALS — Dual-Stream Kinetic Marquee River

### 1.1 Section & Container

**`#testimonials-section`**
```css
position: relative;
background-color: #051610;
/* HTML also adds: py-20 sm:py-28 lg:py-36 overflow-hidden border-t border-white/5 */
```

**`.testimonials-river-container`**
```css
position: relative;
width: 100%;
overflow: hidden;
display: flex;
flex-direction: column;      /* streams stack vertically */
gap: 24px;                   /* gap between row 1 and row 2 */
padding: 10px 0;
```

### 1.2 Edge Vignettes (mask fades)

**`.testimonials-vignette-left`**
```css
position: absolute;
left: 0; top: 0; bottom: 0;
width: 60px;
background: linear-gradient(to right, #051610 0%, rgba(5,22,16,0.8) 40%, transparent 100%);
pointer-events: none;
z-index: 25;
```
**`.testimonials-vignette-right`**
```css
position: absolute;
right: 0; top: 0; bottom: 0;
width: 60px;
background: linear-gradient(to left, #051610 0%, rgba(5,22,16,0.8) 40%, transparent 100%);
pointer-events: none;
z-index: 25;
```
Responsive widths: **`@media (min-width:640px) → 120px`**, **`@media (min-width:1024px) → 180px`**.

### 1.3 Row Track

**`.testimonials-row-track`**
```css
display: flex;
gap: 24px;
width: max-content;
will-change: transform;
```

### 1.4 Dual-Stream Marquees (opposite directions)

```css
.stream-row-left  { animation: marqueeStreamLeft  44s linear infinite; }
.stream-row-right { animation: marqueeStreamRight 48s linear infinite; }

/* Pause BOTH streams on container hover for readable text */
.testimonials-river-container:hover .stream-row-left,
.testimonials-river-container:hover .stream-row-right {
  animation-play-state: paused;
}

@keyframes marqueeStreamLeft {
  0%   { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-50%, 0, 0); }  /* moves LEFT */
}

@keyframes marqueeStreamRight {
  0%   { transform: translate3d(-50%, 0, 0); }
  100% { transform: translate3d(0, 0, 0); }     /* moves RIGHT */
}
```

> **Key nuance:** both `@keyframes` use `-50%` as the loop boundary. `translate3d` avoids repaint/jank. `-50%` works because the track is duplicated 3× (see JS) — the loop point is at half the track width.

### 1.5 Testimonial Card

**`.testimonial-card`** (base)
```css
position: relative;
width: 310px;
flex-shrink: 0;
background: rgba(8, 32, 23, 0.72);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 28px;
padding: 24px;
box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.6);
cursor: pointer;
overflow: hidden;
transform-style: preserve-3d;
transition: transform 400ms cubic-bezier(0.16,1,0.3,1),
            box-shadow 400ms cubic-bezier(0.16,1,0.3,1),
            border-color 350ms ease;
will-change: transform, box-shadow;
display: flex;
flex-direction: column;
justify-content: space-between;
```
Responsive: **`@ ≥640px → width:360px, padding:28px`**, **`@ ≥1024px → width:390px`**.

**`.testimonial-card:hover`**
```css
transform: translateY(-8px) scale(1.02);
border-color: rgba(151, 201, 62, 0.45);
box-shadow: 0 25px 50px -10px rgba(0,0,0,0.85), 0 0 30px rgba(151,201,62,0.16);
```

### 1.6 Card Interior

**`.testimonial-stars`**
```css
display: inline-flex; align-items: center; gap: 4px;
color: #97c93e; font-size: 13px; margin-bottom: 14px;
```

**`.testimonial-quote`**
```css
font-size: 0.875rem; line-height: 1.68;
color: #e2e8f0; font-style: italic; font-weight: 300;
margin-bottom: 20px; font-family: var(--font-sans);
/* @ ≥640px → font-size: 0.9375rem */
```

**`.testimonial-author-wrap`**
```css
display: flex; flex-direction: column;
border-top: 1px solid rgba(255, 255, 255, 0.08);
padding-top: 14px;
```

**`.testimonial-name`**
```css
font-family: var(--font-serif); font-size: 0.9375rem; font-weight: 700;
color: #ffffff; letter-spacing: 0.04em; line-height: 1.2;
/* @ ≥640px → font-size: 1rem */
```

**`.testimonial-title`**
```css
font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.1em;
text-transform: uppercase; color: #97c93e; margin-top: 3px; font-family: var(--font-sans);
/* @ ≥640px → font-size: 0.75rem */
```

### 1.7 JS: Infinite-Loop Card Duplication (`testimonials.js`)

Card HTML shape (class list: `testimonial-card group select-none`):
```
<div class="testimonial-stars">     5× <i class="fa-solid fa-star"></i>
<p class="testimonial-quote"> "…quote…" </p>
<div class="testimonial-author-wrap">
  <span class="testimonial-name"> name </span>
  <span class="testimonial-title"> title </span>
</div>
```

**Stream constructor** (`TestimonialsManager`):
- Config: 8 testimonials array (`testimonialsConfig`), each has `{id, name, title, quote, rating:5}`.
- `group1 = testimonials.slice(0, 4)` → Stream 1.
- `group2 = testimonials.slice(4, 8)` → Stream 2.
- **Each group is duplicated 3×**: `[...group1, ...group1, ...group1]` and `[...group2, ...group2, ...group2]`.
- Both stream tracks injected via `innerHTML` into `#testimonials-stream-1` / `#testimonials-stream-2`.

> **Why 3× duplicate:** with the `-50%` loop translation, a single copy would produce a visible jump. Duplicating 3× guarantees the track is ≥2×content so `-50%` loops seamlessly with no gap.

**3D tilt mouse interaction** (`bindCardInteractions`, skipped on touch devices):
```js
const rotateX = percentY * -6;
const rotateY = percentX * 6;
card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;
// mouseleave reset:
card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)';
```
Max tilt = **±6deg** on both axes; card lifts `translateY(-8px)` + `scale(1.02)` on hover.

---

## 2. STORE REFERENCE — Glassmorphic Sanctuary Portal

### 2.1 Section & Background

**`#store-reference-section`**
```css
position: relative; overflow: hidden; background-color: #051610;
/* HTML adds: py-24 sm:py-32 lg:py-40 border-t border-white/5 */
```

**`.store-bg-layer`** (full-bleed parallax image)
```css
position: absolute;
inset: -60px 0 -60px 0;               /* bleeds 60px top & bottom so parallax never reveals edge */
width: 100%;
height: calc(100% + 120px);
background-image: url('https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1920&q=85');
background-size: cover;
background-position: center;
filter: brightness(0.25) saturate(0.8);   /* dark + desaturated cinematic look */
will-change: transform;
```
> Parallax applied in `parallax.js` (section D): `storeBg.style.transform = translate3d(0, ${relativeCenter * 0.1}px, 0)`.

**`.store-bg-vignette`**
```css
position: absolute; inset: 0;
background: radial-gradient(
  circle at 50% 50%,
  rgba(5, 22, 16, 0.75) 0%,
  rgba(5, 22, 16, 0.92) 65%,
  #051610 100%
);
pointer-events: none;
z-index: 2;
```

### 2.2 Glassmorphic Portal Box

**`.store-portal-box`**
```css
position: relative;
z-index: 10;
background: rgba(8, 32, 23, 0.78);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 36px;
padding: 32px 24px;
box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9),
            0 0 35px rgba(151, 201, 62, 0.08);
overflow: hidden;
```
Responsive padding: **`@ ≥640px → 40px 36px`**, **`@ ≥1024px → 56px 48px`**.

### 2.3 Typography

**`.store-title`**
```css
font-family: var(--font-serif); font-size: 2rem; font-weight: 700;
color: #ffffff; line-height: 1.2; letter-spacing: 0.02em;
/* @ ≥640px → 2.5rem;  @ ≥1024px → 3rem */
```

**`.store-subtitle`**
```css
font-size: 0.9375rem; color: #cbd5e1; font-weight: 300; line-height: 1.7;
font-family: var(--font-sans); margin-top: 14px;
/* @ ≥640px → font-size: 1rem */
```

(*Section eyebrow label* in HTML: `text-xs tracking-[0.3em] uppercase text-[#97c93e]`.)

### 2.4 Address Card

**`.store-address-box`**
```css
display: flex; align-items: flex-start; gap: 16px;
margin-top: 28px; padding: 18px 22px;
background: rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 20px;
transition: border-color 300ms ease, background-color 300ms ease;
```

**`.store-address-box:hover`**
```css
background: rgba(151, 201, 62, 0.06);
border-color: rgba(151, 201, 62, 0.25);
```

**`.store-address-icon`**
```css
width: 44px; height: 44px; border-radius: 9999px;
background: rgba(151, 201, 62, 0.15);
border: 1px solid rgba(151, 201, 62, 0.3);
display: flex; align-items: center; justify-content: center;
color: #97c93e; font-size: 18px; flex-shrink: 0;
```

**`.store-address-line1`**
```css
font-size: 1rem; font-weight: 700; color: #ffffff;
letter-spacing: 0.02em; font-family: var(--font-sans); line-height: 1.3;
/* @ ≥640px → 1.0625rem */
```

**`.store-address-line2`**
```css
font-size: 0.8125rem; color: #97c93e; font-weight: 500;
letter-spacing: 0.04em; margin-top: 4px; font-family: var(--font-sans);
/* @ ≥640px → 0.875rem */
```

### 2.5 Map Frame

**`.store-map-frame`**
```css
position: relative; width: 100%;
border-radius: 24px; overflow: hidden;
border: 1px solid rgba(255, 255, 255, 0.15);
box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.8);
height: 320px;
/* @ ≥640px → height: 360px;  @ ≥1024px → height: 400px */
```

**`.store-map-iframe`**
```css
width: 100%; height: 100%; border: 0;
filter: grayscale(85%) invert(92%) hue-rotate(180deg) brightness(85%) contrast(110%);
transition: filter 500ms ease;
```

**`.store-map-frame:hover .store-map-iframe`**
```css
filter: grayscale(35%) invert(92%) hue-rotate(180deg) brightness(92%) contrast(105%);
```

> **Map dark-theme trick:** `invert(92%) + grayscale + hue-rotate(180deg)` turns the default light Google Map into a dark map. On hover, grayscale drops 85→35% (reveals more color) and brightness/contrast soften.

### 2.6 Store JS (`store-reference.js`)

- Config `storeReferenceConfig`: `title, subtitle, addressLine1, addressLine2, mapEmbedUrl`.
- **Map 3D tilt** (skip on touch): `rotateX = percentY * -4`, `rotateY = percentX * 4`, plus `scale3d(1.01,1.01,1.01)`. Reset on mouseleave to `perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)`.
- Map tilt is applied to the **`.store-map-frame`** element, not the iframe.

---

## 3. FOOTER — Luxury 3-Column Ancestral Layout

### 3.1 Section

**`#main-footer`**
```css
position: relative;
background: linear-gradient(180deg, #051610 0%, #030e0a 50%, #010705 100%);
border-top: 1px solid rgba(255, 255, 255, 0.08);
overflow: hidden;
/* HTML adds: pt-20 pb-12 */
```

### 3.2 Grid

**`.footer-grid`**
```css
display: grid; grid-template-columns: 1fr; gap: 40px;
/* @ ≥768px  → repeat(2, minmax(0, 1fr)); gap: 48px */
/* @ ≥1024px → repeat(3, minmax(0, 1fr)); gap: 56px */
```

### 3.3 Column Title (shared)

**`.footer-col-title`**
```css
font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 700;
color: #ffffff; letter-spacing: 0.1em; text-transform: uppercase;
margin-bottom: 22px; position: relative; padding-bottom: 12px;
```
**`.footer-col-title::after`** (underline accent)
```css
content: ''; position: absolute; bottom: 0; left: 0;
width: 36px; height: 2px; background-color: #97c93e; border-radius: 9999px;
```

### 3.4 Column 1 — Brand & Logo

**`.footer-brand-logo`**
```css
display: inline-flex; align-items: center; gap: 10px;
font-family: var(--font-serif); font-size: 1.375rem; font-weight: 800;
letter-spacing: 0.12em; color: #ffffff; margin-bottom: 16px;
transition: opacity 300ms ease;
```
Hover: `opacity: 0.9`. (Logo box inside: `w-10 h-10 rounded-xl bg-white p-1 border border-[#97c93e]/40`, `group-hover:scale-105`.)

**`.footer-brand-text`**
```css
font-size: 0.875rem; color: #94a3b8; font-weight: 300;
line-height: 1.7; font-family: var(--font-sans);
```

### 3.5 Social Buttons

**`.footer-social-wrap`**
```css
display: flex; align-items: center; gap: 12px; margin-top: 24px;
```

**`.footer-social-btn`**
```css
width: 40px; height: 40px; border-radius: 9999px;
background: rgba(255, 255, 255, 0.04);
border: 1px solid rgba(255, 255, 255, 0.1);
color: #cbd5e1; display: flex; align-items: center; justify-content: center;
font-size: 14px;
transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
```

**`.footer-social-btn:hover`**
```css
background: #97c93e; color: #051610; border-color: #97c93e;
transform: translateY(-3px);
box-shadow: 0 8px 20px rgba(151, 201, 62, 0.3);
```

### 3.6 Column 2 — Navigation Links

**`.footer-nav-list`**
```css
display: flex; flex-direction: column; gap: 14px;
```

**`.footer-nav-link`**
```css
display: inline-flex; align-items: center; gap: 10px;
color: #94a3b8; font-size: 0.875rem; font-weight: 400;
transition: all 250ms ease; font-family: var(--font-sans);
/* @ ≥640px → font-size: 0.9375rem */
```

**`.footer-nav-link:hover`**
```css
color: #97c93e; transform: translateX(6px);
```

### 3.7 Column 3 — About Us + Hours

**`.footer-about-text`**
```css
font-size: 0.875rem; color: #94a3b8; font-weight: 300;
line-height: 1.7; font-family: var(--font-sans);
```

**`.footer-hours-card`**
```css
margin-top: 18px; padding: 14px 18px;
background: rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 18px;
display: flex; flex-direction: column; gap: 4px;
```

**`.footer-hours-label`**
```css
font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.1em;
text-transform: uppercase; color: #97c93e;
```

**`.footer-hours-val`**
```css
font-size: 0.8125rem; color: #e2e8f0; font-family: var(--font-sans);
```
*(Extra line in HTML: `text-xs text-gray-400 mt-1` — the street address.)*

### 3.8 Bottom Bar

**`.footer-bottom-bar`**
```css
border-top: 1px solid rgba(255, 255, 255, 0.06);
padding-top: 28px; margin-top: 56px;
display: flex; flex-direction: column; align-items: center;
justify-content: space-between; gap: 16px;
/* @ ≥640px → flex-direction: row */
```

**`.footer-copy-text`**
```css
font-size: 0.8125rem; color: #64748b; font-family: var(--font-sans);
```

**`.footer-back-top-btn`**
```css
display: inline-flex; align-items: center; gap: 8px;
padding: 8px 16px; border-radius: 9999px;
background: rgba(8, 32, 23, 0.8);
border: 1px solid rgba(151, 201, 62, 0.3);
color: #97c93e; font-size: 0.75rem; font-weight: 600;
letter-spacing: 0.08em; text-transform: uppercase;
transition: all 300ms ease; cursor: pointer;
```
**`.footer-back-top-btn:hover`**
```css
background: #97c93e; color: #051610; transform: translateY(-3px);
box-shadow: 0 8px 25px rgba(151, 201, 62, 0.35);
```

### 3.9 Footer JS (`footer.js`)

- `#footer-back-to-top` → `window.scrollTo({top:0, behavior:'smooth'})`.
- All `.footer-nav-link[href^="#"]` → `targetEl.scrollIntoView({behavior:'smooth', block:'start'})` (prevents default).

---

## 4. CART DRAWER — Slide-Out Sanctuary Basket

### 4.1 Backdrop

**`#cart-backdrop`**
```css
position: fixed; inset: 0;
background: rgba(0, 0, 0, 0.75);
backdrop-filter: blur(8px);
-webkit-backdrop-filter: blur(8px);
z-index: 60;
opacity: 0; pointer-events: none;
transition: opacity 300ms ease;
```
**body.cart-open `#cart-backdrop`** → `opacity: 1; pointer-events: auto;`

### 4.2 Drawer Panel

**`#cart-drawer`**
```css
position: fixed; top: 0; right: 0; bottom: 0;
width: 100%; max-width: 440px;
background: #082017;
border-left: 1px solid rgba(255, 255, 255, 0.1);
z-index: 70;
transform: translateX(100%);
transition: transform 350ms cubic-bezier(0.16, 1, 0.3, 1);
display: flex; flex-direction: column;
box-shadow: -15px 0 50px rgba(0, 0, 0, 0.85);
```
**body.cart-open `#cart-drawer`** → `transform: translateX(0);`

### 4.3 Header Badge (cart-badge)

**`.cart-badge`**
```css
position: absolute; top: -4px; right: -4px;
min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9999px;
background: #97c93e; color: #051610;
font-size: 0.6875rem; font-weight: 800;
display: flex; align-items: center; justify-content: center;
font-family: var(--font-sans);
box-shadow: 0 0 10px rgba(151, 201, 62, 0.5);
transition: transform 250ms ease;
```
**`.cart-badge.bump`** → `transform: scale(1.3);`

> The trigger button uses class `cart-toggle-btn` (no dedicated CSS — only HTML utilities + `.cart-badge`). Clicking any `.cart-toggle-btn` calls `toggle()`.

### 4.4 Items Container

**`#cart-items-container`**
```css
flex: 1 1 0%;
overflow-y: auto;
padding: 20px 24px;
display: flex; flex-direction: column; gap: 16px;
```

**`.cart-item-card`**
```css
display: flex; gap: 14px; padding: 14px;
background: rgba(5, 22, 16, 0.7);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 20px;
transition: border-color 250ms ease;
```
Hover: `border-color: rgba(151, 201, 62, 0.35)`.

**`.cart-item-img`**
```css
width: 72px; height: 72px; border-radius: 14px; object-fit: cover;
background: #051610; flex-shrink: 0; border: 1px solid rgba(255, 255, 255, 0.06);
```

**`.cart-item-title`**
```css
font-family: var(--font-serif); font-size: 0.875rem; font-weight: 700;
color: #ffffff; line-height: 1.3;
display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
```

**`.cart-item-variant`**
```css
font-size: 0.6875rem; color: #97c93e; font-weight: 600;
letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px;
```

**`.cart-item-price`**
```css
font-size: 0.9375rem; font-weight: 800; color: #ffffff; font-family: var(--font-sans);
```

### 4.5 Item Stepper (qty +/-)

**`.cart-stepper`**
```css
display: flex; align-items: center;
border: 1px solid rgba(255, 255, 255, 0.12);
border-radius: 9999px;
background: rgba(8, 32, 23, 0.8);
padding: 2px 8px;
```

**`.cart-stepper-btn`**
```css
width: 24px; height: 24px;
display: flex; align-items: center; justify-content: center;
color: #cbd5e1; font-size: 0.875rem; font-weight: bold;
cursor: pointer; transition: color 200ms ease;
```
Hover: `color: #97c93e`.

**`.cart-stepper-val`**
```css
width: 24px; text-align: center; font-size: 0.8125rem; font-weight: 700; color: #ffffff;
```

**`.cart-remove-btn`**
```css
color: #94a3b8; font-size: 0.875rem; padding: 4px; cursor: pointer;
transition: color 200ms ease, transform 200ms ease;
```
Hover: `color: #f87171; transform: scale(1.1);`

### 4.6 Empty State

**`.cart-empty-wrap`**
```css
display: flex; flex-direction: column; align-items: center; justify-content: center;
text-align: center; height: 100%; padding: 40px 20px;
```

**`.cart-empty-icon`**
```css
width: 72px; height: 72px; border-radius: 9999px;
background: rgba(151, 201, 62, 0.12);
border: 1px solid rgba(151, 201, 62, 0.3);
display: flex; align-items: center; justify-content: center;
color: #97c93e; font-size: 28px; margin-bottom: 20px;
```

### 4.7 Footer & Checkout

**`#cart-footer`**
```css
padding: 20px 24px 28px;
background: rgba(5, 22, 16, 0.95);
border-top: 1px solid rgba(255, 255, 255, 0.1);
```

**`.cart-checkout-btn`**
```css
width: 100%; padding: 15px; border-radius: 9999px;
background: #97c93e; color: #051610;
font-family: var(--font-serif); font-size: 0.9375rem; font-weight: 800;
letter-spacing: 0.12em; text-transform: uppercase;
display: flex; align-items: center; justify-content: center; gap: 10px;
cursor: pointer; border: none;
transition: all 250ms ease;
box-shadow: 0 8px 25px rgba(151, 201, 62, 0.3);
```
**`.cart-checkout-btn:hover`**
```css
background: #b2db58; transform: translateY(-2px);
box-shadow: 0 12px 30px rgba(151, 201, 62, 0.45);
```

### 4.8 Cart Drawer HTML Structure (`index.html`)

- Header: logo block (`w-8 h-8 rounded-lg bg-white`), title **"YOUR BASKET"**, count `#cart-drawer-count`, close `#cart-drawer-close`.
- Body: `#cart-items-container` (injected).
- Footer `#cart-footer`: **Subtotal** label + `#cart-subtotal-val`; delivery note "Ayurvedic delivery across Sri Lanka & Worldwide" (`text-[11px] text-[#97c93e]/80`); `#cart-checkout-cta` `cart-checkout-btn` with lock icon.

### 4.9 Cart JS (`cart.js`) — `CartManager`

- **Storage key:** `wedagedara_cart_items` in `localStorage`.
- **Default seed item** (so basket is pre-populated): `{id:"bhringraj-hair-oil", title:"Bhringraj Hair Oil", variantSku:"DAB-09-OIL-100ML", price:2084, qty:1, image:"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80"}`.
- **Add item** `addItem(product, variantSku, qty=1)`: sku = `variantSku || product.variants[0].sku || 'STANDARD'`. If same `id`+`variantSku` exists → `qty += qty`, else push new entry (price resolved from `product.variants.find(v=>v.sku===sku)` or `product.price`). Then `saveCart() → render() → bumpBadge() → open()`.
- **Update qty** `updateQty(id, variantSku, delta)`: `qty += delta`; if `qty <= 0` → `removeItem()`, else save/render/bumpBadge.
- **Remove** `removeItem(id, variantSku)`: filter items, save/render/bumpBadge.
- **Totals**: `getTotalCount()` = Σ qty; `getSubtotal()` = Σ (price × qty).
- **Open/close/toggle**: manipulate `body.cart-open` class.
- **Badge bump**: adds `.bump` class for `300ms` (setTimeout), then removes.
- **Bindings**: `.cart-toggle-btn` → `toggle()`; close btn + backdrop → `close()`; `#cart-checkout-cta` → `alert(...)`.
- **render()**: updates badge count (hides badge if 0), drawer count `(N items)`, subtotal `Rs. X,XXX`. Empty → injects empty-state markup + hides `#cart-footer`. Non-empty → injects item cards, re-binds steppers/remove via `data-id`/`data-sku`.
- Instantiated on `DOMContentLoaded` as `window.globalCartInstance`.

---

## 5. PRODUCT MODAL — Rotating Squircle Wave Pill

### 5.1 Modal Shell

**`#product-details-modal`**
```css
transition: opacity 350ms cubic-bezier(0.16,1,0.3,1),
            visibility 350ms cubic-bezier(0.16,1,0.3,1);
/* HTML: fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 opacity-0 invisible pointer-events-none */
```

**`#product-modal-card`**
```css
display: flex; align-items: center; justify-content: center;
transition: transform 400ms cubic-bezier(0.16,1,0.3,1),
            opacity 400ms cubic-bezier(0.16,1,0.3,1);
will-change: transform, opacity;
```

**State classes:**
```css
#product-details-modal.modal-active {
  opacity: 1; visibility: visible; pointer-events: auto;
}
#product-details-modal.modal-active #product-modal-card {
  transform: scale(1) translateY(0); opacity: 1;
}
```
> Default (closed) card state set by HTML: `transform: scale-95 opacity-0`; closes to `scale(0.95), opacity 0`.

### 5.2 Left Pill

**`.modal-pill-left`**
```css
background: linear-gradient(135deg, #0d2e22 0%, #09241b 60%, #051610 100%);
box-shadow: -15px 12px 40px rgba(0, 0, 0, 0.7);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 40px;
overflow: hidden;
position: relative;
```

**`@media (min-width:1024px)`** (desktop, strict fixed dimensions):
```css
.modal-pill-left {
  height: 530px !important;
  min-height: 530px !important;
  max-height: 530px !important;
  width: 360px !important;
}
```
HTML mobile default: `w-full min-h-[260px]`, padding `p-6 sm:p-8 lg:py-14`.

### 5.3 Right Body

**`.modal-body-right`**
```css
background: var(--color-emerald-card);
box-shadow: 15px 12px 40px rgba(0, 0, 0, 0.7);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 32px;
```

**`@media (min-width:1024px)`** (desktop):
```css
.modal-body-right {
  height: 430px !important;
  min-height: 430px !important;
  max-height: 430px !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  border-radius: 0 40px 40px 0 !important;   /* only rounded on right edge */
}
```
HTML overlap: `lg:-ml-8 -mt-3 lg:mt-0` creates the left-pill overlap; `pt-12 lg:pt-6`.

> Combined silhouette: Left pill **530px tall × 360px wide**, right body **430px tall**, right body overlaps left pill by `32px` (`-ml-8`), sitting vertically centered.

### 5.4 Rotating Squircle Waves (desktop)

**`.rot-wave-shape`**
```css
position: absolute;
width: 620px; height: 620px;
top: -45px; right: -420px;      /* anchored to RIGHT edge of the pill, off-canvas */
border-radius: 250px;
pointer-events: none;
filter: blur(1px);
```

| Class | Background | Opacity | z-index | border-radius | Animation |
|---|---|---|---|---|---|
| `.rot-wave-1` | `#c5a059` (gold) | `0.38` | 1 | `230px` | `rotateBlob 24s linear infinite` |
| `.rot-wave-2` | `#97c93e` (lime) | `0.42` | 2 | `245px` | `rotateBlobReverse 18s linear infinite` |
| `.rot-wave-3` | `#154232` (deep) | `0.65` | 3 | `260px` | `rotateBlob 30s linear infinite` |

### 5.5 Mobile Waves (bottom edge)

**`.rot-wave-shape-mob`**
```css
position: absolute;
width: 580px; height: 580px;
bottom: -430px; left: 50%; margin-left: -290px;
border-radius: 240px;
pointer-events: none;
filter: blur(1px);
```

| Class | Background | Opacity | z-index | border-radius | Animation |
|---|---|---|---|---|---|
| `.rot-wave-mob-1` | `#c5a059` | `0.38` | 1 | `220px` | `rotateBlob 20s linear infinite` |
| `.rot-wave-mob-2` | `#97c93e` | `0.42` | 2 | `235px` | `rotateBlobReverse 15s linear infinite` |
| `.rot-wave-mob-3` | `#154232` | `0.65` | 3 | `250px` | `rotateBlob 26s linear infinite` |

### 5.6 Wave Keyframes

```css
@keyframes rotateBlob {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes rotateBlobReverse {
  from { transform: rotate(360deg); }
  to   { transform: rotate(0deg); }
}
```

> Because each squircle has a **different border-radius** (approaching a circle but not equal), rotating them produces the organic "blob/wave" liquid-shape morphing effect. Desktop waves sit on the pill's **right edge**; mobile waves sit on the pill's **bottom edge** (`hidden lg:block` vs `block lg:hidden`).

### 5.7 Left Pill Content

- Circular image: `w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 rounded-full bg-[#051610] overflow-hidden p-1.5 border border-white/20`, `hover:scale-105 transition-transform duration-500`. `#modal-product-img` fills it `object-cover rounded-full`.
- Dosha pill below: `#modal-product-dosha` `inline-flex px-3.5 py-1.5 rounded-full bg-black/60 border border-white/15 text-emerald-300 uppercase tracking-wider` + `fa-spa` icon.

### 5.8 Right Body Content & Buttons

- Meta row: `#modal-product-category` (`text-xs font-bold tracking-[0.25em] uppercase text-[#97c93e]`) + `#modal-product-volume` (`text-xs text-gray-400`).
- Title: `#modal-product-title` (`text-xl sm:text-2xl lg:text-3xl font-cinzel font-bold text-white`).
- Price: `#modal-product-price` (`text-lg sm:text-xl font-bold font-cinzel text-[#97c93e]`) + "In Stock • 100% Herbal" tag (`bg-emerald-950 text-emerald-300 border-emerald-800`).
- Narrative: `#modal-product-fulldetails` (`text-xs sm:text-sm text-gray-300 font-light line-clamp-3 max-w-xl`).
- Ingredients: `#modal-product-ingredients` container + label "Sacred Botanical Actives:".
- **Action buttons** (footer, `pt-3 border-t border-white/10`):
  - `#modal-order-whatsapp`: `flex-1 rounded-full bg-[#97c93e] hover:bg-[#b2db58] text-black text-xs sm:text-sm uppercase tracking-wider shadow-md hover:scale-105 active:scale-95` + `fa-whatsapp` icon → "ORDER VIA WHATSAPP".
  - `#modal-proceed-buy`: `flex-1 rounded-full border-2 border-[#97c93e] text-[#b2db58] hover:bg-[#97c93e] hover:text-black text-xs sm:text-sm uppercase tracking-wider shadow-md hover:scale-105 active:scale-95` + `fa-bag-shopping` icon → "PROCEED TO BUY".

### 5.9 Product Modal JS (`product-modal.js`)

- **openProductDetailsModal(product)**: populates `#modal-product-img` (src+alt), `#modal-product-category` (`product.title`), `#modal-product-title` (`product.productName`), `#modal-product-price` (`product.price || "Rs. 2,850.00"`), `#modal-product-volume` (`product.volume || "100% Herbal Formulation"`), `#modal-product-fulldetails` (`product.fullDetails || product.description`), `#modal-product-dosha` (`product.dosha || "Tri-Dosha Balanced"`). Renders ingredients into `#modal-product-ingredients` as tags: `class="px-3 py-1 rounded-full bg-[#97c93e]/10 border border-[#97c93e]/20 text-[11px] font-medium text-emerald-200"` with a `fa-leaf` icon. Then adds `modal-active`, sets `document.body.style.overflow='hidden'`.
- **closeProductDetailsModal()**: removes `modal-active`, resets `body.style.overflow=''`.
- **setupProductModalEvents()**: close btn + `#product-modal-backdrop` → close; **Escape key** → close. WhatsApp button opens `https://wa.me/?text=...` (encoded "Hello Wedagedara Ayurveda, I would like to order: <title>"). Proceed-to-buy shows the share toast (green check + `<title> added to cart!`), self-hides after `2500ms`, then closes the modal.

---

## 6. HEADER — Scroll Glass & Mobile Menu (`header.js`)

### 6.1 Base Header (HTML)

```html
<header id="main-header" class="fixed top-0 left-0 right-0 z-40 transition-all duration-300 px-6 sm:px-10 lg:px-16 py-5">
```

### 6.2 Glass Nav State (CSS — `header.css`)

**`.glass-nav`**
```css
background: rgba(5, 22, 16, 0.85);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(255, 255, 255, 0.08);
```

### 6.3 Scroll Behavior (`setupHeaderScroll`)

```js
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    header.classList.add('glass-nav', 'py-3.5', 'shadow-2xl');
    header.classList.remove('py-5');
  } else {
    header.classList.remove('glass-nav', 'py-3.5', 'shadow-2xl');
    header.classList.add('py-5');
  }
});
```
> **Threshold:** `scrollY > 40` toggles. Scrolled → adds `.glass-nav` (glass bg), reduces padding `py-5 → py-3.5`, adds `shadow-2xl`. At top → reverts to `py-5`, removes glass+shadow. The 300ms `transition-all` on the header animates these paddings/bg.

### 6.4 Mobile Menu (`setupMobileMenu`)

- Elements: `#mobile-menu-btn`, `#mobile-menu-close`, `#mobile-drawer` (`fixed top-0 right-0 bottom-0 w-72 bg-[#082017] translate-x-full transition-transform duration-300 md:hidden shadow-2xl`), `#mobile-backdrop` (`fixed inset-0 bg-black/80 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300 md:hidden`), `.mobile-nav-link`.
- **Open**: `mobileDrawer.classList.remove('translate-x-full')`, `mobileBackdrop.classList.remove('opacity-0','pointer-events-none')`, `body.style.overflow='hidden'`.
- **Close**: adds `translate-x-full`, adds `opacity-0 pointer-events-none`, `body.style.overflow=''`.
- Bound to: toggle btn (open), close btn (close), backdrop (close), each `.mobile-nav-link` (close).

---

## 7. Global Helpers — Parallax, Share, Toast (`parallax.js` / `utils.js` / `app.js`)

### 7.1 `setupParallaxAndScrollEffects()` — `parallax.js`

A `requestAnimationFrame`-throttled scroll engine over `section, header` elements. Only updates sections within viewport buffer (±150px).

**A. Hero drift** (`#hero-section`, visible when `scrollY < windowHeight`):
- `#hero-bg-container`: `translate3d(0, ${scrollY*0.25}px, 0) scale(min(1.08, 1 + scrollY*0.0001))`.
- Hero `.grid` content: `translate3d(0, ${-scrollY*0.15}px, 0)`, opacity `clamp(0, 1 - scrollY/(windowHeight*0.75), 1)`.

**B. `.parallax-leaf` (floating botanical leaves):**
- Speed from `data-speed` attr (default `0.12*(idx+1)`). `rawShift = relativeCenter * speed * -0.4`.
- Shift clamped to **±45px**; rotation clamped to **±20deg**, direction alternates by index parity.
- `transform: translate3d(0, Ypx, 0) rotate(Xdeg)`.

**C. `.ambient-glow, .spotlight-halo`:** `relativeCenter * (0.08*(idx+1)) * 0.3`, clamped **±30px**.

**D. `.spotlight-img`:** `scale(1.06) translateY(clamp(±20, relativeCenter * -0.04))`.

**E. `.store-bg-layer`:** `translate3d(0, ${relativeCenter * 0.1}px, 0)` — the store parallax drift.

**Scroll-reveal:** elements with `.reveal-on-scroll` get `.revealed` via `IntersectionObserver` (threshold `0.05`, rootMargin `0px 0px -30px 0px`).

### 7.2 Share Button — `utils.js` (`setupShareButton`)

- `#hero-share-btn` click → builds `shareData {title, text, url}`.
- If `navigator.share` exists → `await navigator.share(shareData)`.
- Else → `navigator.clipboard.writeText(window.location.href)`, show toast "Link copied to clipboard!" for `2500ms`.
- **Share toast** (`#share-toast`) is positioned `fixed bottom-6 left-6 z-50` with classes `bg-[#082017] border border-[#97c93e]/40 text-white px-4 py-2.5 rounded-xl shadow-2xl`. Hidden by default via `opacity-0 pointer-events-none translate-y-2`. Shown by removing those and adding `opacity-100 translate-y-0`; hidden again after `2500ms`. The toast message swaps icons/text per trigger.

### 7.3 App Entry — `app.js`

On `DOMContentLoaded` instantiates in order:
> `HeroSlider` → `ProductsSlider` → `TopSellingManager` → `FeaturedBanner` → `CategoriesManager` → `LatestProductsManager` → `TestimonialsManager` → `StoreReferenceManager` → `FooterManager` → `setupProductModalEvents()` → `setupMobileMenu()` → `setupShareButton()` → `setupHeaderScroll()` → `setupParallaxAndScrollEffects()`.
> Each manager is also exposed as `window.<name>Instance`.

---

## Quick Reference — Exact Numbers Cheat-Sheet

| Item | Value |
|---|---|
| Testimonial card width | 310px / 360px (@640) / 390px (@1024) |
| Card radius / gap | 28px / 24px |
| Marquee durations | Left 44s / Right 48s |
| Loop translate | `-50%` |
| Marquee easing | `linear infinite` |
| Card hover lift | `translateY(-8px) scale(1.02)` |
| Card 3D tilt | ±6deg |
| Store portal bg | `rgba(8,32,23,0.78)` blur(20px) radius 36px |
| Store parallax factor | `relativeCenter * 0.1` |
| Map heights | 320 / 360 / 400px |
| Map dark filter | `grayscale(85%) invert(92%) hue-rotate(180deg) brightness(85%) contrast(110%)` |
| Footer grid | 1col → 2col(@768, gap48) → 3col(@1024, gap56) |
| Social btn | 40×40 pill, lift -3px |
| Nav link hover slide | `translateX(6px)` |
| Cart drawer | right slide, 440px max, `translateX(100%)→0`, 350ms ease-out-expo |
| Cart item image | 72×72 radius 14px |
| Cart badge | min-width 18px, pill, bump `scale(1.3)` |
| Modal left pill | 360×530px radius 40px (desktop) |
| Modal right body | 430px height, radius `0 40px 40px 0` |
| Wave blob size | 620px desktop / 580px mobile |
| Wave radii | 230 / 245 / 260px (desktop), 220 / 235 / 250px (mobile) |
| Wave durations | 24s / 18s / 30s (desktop), 20s / 15s / 26s (mobile) |
| Glass nav threshold | `scrollY > 40` |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) |
