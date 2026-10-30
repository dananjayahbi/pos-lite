import { describe, it, expect } from 'vitest';
import { computeDropdownRect } from '@/hooks/useDropdownAnchor';

// The PO order-line search input is rendered inside a Card (overflow-hidden)
// and near the bottom of a scrolling pane. These cases pin the geometry that
// keeps the result list fully on screen.
const VIEWPORT_H = 800;

describe('computeDropdownRect', () => {
  it('opens below the anchor when there is room', () => {
    const rect = computeDropdownRect(
      { top: 100, bottom: 136, left: 40, width: 300 },
      VIEWPORT_H,
    );
    expect(rect.flipped).toBe(false);
    expect(rect.top).toBe(140); // box.bottom + 4px gap
    expect(rect.left).toBe(40);
    expect(rect.width).toBe(300);
  });

  it('shrinks maxHeight to the space below instead of overflowing the viewport', () => {
    const rect = computeDropdownRect(
      { top: 400, bottom: 436, left: 0, width: 300 },
      VIEWPORT_H,
    );
    expect(rect.flipped).toBe(false);
    // 800 - 436 - 4 = 360, capped at the 320px ceiling
    expect(rect.maxHeight).toBe(320);
  });

  it('clamps maxHeight when only a little space remains below', () => {
    const rect = computeDropdownRect(
      { top: 700, bottom: 736, left: 0, width: 300 },
      VIEWPORT_H,
    );
    // 800 - 736 - 4 = 60 -> below the 120px minimum, but more room above, so flip
    expect(rect.flipped).toBe(true);
    expect(rect.top).toBe(696); // anchored by its own bottom edge (box.top - 4)
  });

  it('flips above the anchor when the space below is too small', () => {
    const rect = computeDropdownRect(
      { top: 740, bottom: 776, left: 10, width: 250 },
      300,
    );
    expect(rect.flipped).toBe(true);
    expect(rect.top).toBe(736);
    expect(rect.maxHeight).toBeGreaterThanOrEqual(120);
  });

  it('never reports a maxHeight below the usable minimum', () => {
    const rect = computeDropdownRect(
      { top: 10, bottom: 46, left: 0, width: 200 },
      100,
    );
    expect(rect.maxHeight).toBeGreaterThanOrEqual(120);
  });
});
