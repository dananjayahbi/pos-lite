import { describe, it, expect } from 'vitest';
import {
  buildTopUpDescription,
  evaluateLowBalance,
  DEFAULT_LOW_BALANCE_THRESHOLD,
} from '@/lib/services/petty-cash.service';

describe('evaluateLowBalance (doc 40)', () => {
  it('returns none when no threshold is configured', () => {
    expect(evaluateLowBalance(100, null, false)).toBe('none');
    expect(evaluateLowBalance(100, undefined, false)).toBe('none');
  });

  it('fires when balance drops to or below the threshold', () => {
    expect(evaluateLowBalance(5000, 5000, false)).toBe('fire');
    expect(evaluateLowBalance(4999, 5000, false)).toBe('fire');
    expect(evaluateLowBalance(0, 5000, false)).toBe('fire');
  });

  it('does nothing when balance is above the threshold and not alerted', () => {
    expect(evaluateLowBalance(5001, 5000, false)).toBe('none');
  });

  it('suppresses repeat alerts while already alerted', () => {
    expect(evaluateLowBalance(4500, 5000, true)).toBe('none');
    expect(evaluateLowBalance(5000, 5000, true)).toBe('none');
  });

  it('clears the alerted state once the balance recovers above the threshold', () => {
    expect(evaluateLowBalance(5001, 5000, true)).toBe('clear');
  });

  it('re-fires after recovery and a subsequent drop', () => {
    // alerted -> recovered (clear) -> drops again (fire)
    const recovered = evaluateLowBalance(6000, 5000, true);
    expect(recovered).toBe('clear');
    const reFire = evaluateLowBalance(4000, 5000, false);
    expect(reFire).toBe('fire');
  });

  it('exposes a sensible default threshold', () => {
    expect(DEFAULT_LOW_BALANCE_THRESHOLD).toBe(5000);
  });
});

describe('buildTopUpDescription (Add Cash In)', () => {
  it('names the source account when no note is given', () => {
    expect(buildTopUpDescription('Bank')).toBe('Petty Cash Replenished from Bank');
  });

  it('uses a neutral description for external cash', () => {
    expect(buildTopUpDescription(null)).toBe('Petty Cash Replenished');
  });

  it('prefers a trimmed user note', () => {
    expect(buildTopUpDescription('Bank', '  Monthly float  ')).toBe('Monthly float');
  });

  it('caps the description at 200 characters', () => {
    expect(buildTopUpDescription('Bank', 'x'.repeat(500))).toHaveLength(200);
  });
});
