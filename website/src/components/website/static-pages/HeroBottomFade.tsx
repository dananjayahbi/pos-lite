'use client';

/**
 * Bottom fade for the static-page hero (`PageHero`).
 *
 * `.about-hero-vignette` is a RADIAL gradient sized to the farthest corner, so
 * its coverage is very uneven on a wide, short box: measured on the About hero
 * (1325 × 479) the bottom-*centre* of the box sits at only 34% of the gradient
 * ray, i.e. roughly halfway between the 40% and 85% stops. The hero therefore
 * never reaches the solid page colour at its own bottom edge, and the boundary
 * with the section below reads as a hard horizontal line.
 *
 * A border cannot fix that — it draws the very line we are trying to remove.
 * This layer sits above the vignette and ramps the last stretch of the hero
 * linearly to the exact page background (`--site-bg`, #051610), so the image
 * dissolves into the page with no seam and no hairline.
 *
 * Kept as its own component (rather than a bare <div> in PageHero) because the
 * fade needs to stay aligned with the hero's bottom edge on every breakpoint,
 * and PageHero is already carrying the parallax + reveal wiring.
 */
export function HeroBottomFade() {
  return (
    <div
      aria-hidden="true"
      data-testid="hero-bottom-fade"
      className="hero-bottom-fade absolute inset-x-0 bottom-0 h-40 pointer-events-none"
    />
  );
}
