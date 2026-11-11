import { describe, expect, it } from 'vitest';
import { BroadcastSendSchema } from '@/lib/validators/broadcast.validators';

describe('BroadcastSendSchema — email', () => {
  it('accepts a subject with an HTML body and image URLs', () => {
    const parsed = BroadcastSendSchema.parse({
      channel: 'EMAIL',
      subject: 'A special offer',
      html: '<p>Hi {{name}}</p>',
      imageUrls: ['https://cdn.example.com/promo.jpg'],
    });
    expect(parsed.channel).toBe('EMAIL');
    expect(parsed.imageUrls).toHaveLength(1);
  });

  it('accepts a plain-text message when HTML is omitted', () => {
    const parsed = BroadcastSendSchema.parse({
      channel: 'EMAIL',
      subject: 'Hello',
      message: 'Hi {{name}}',
    });
    expect(parsed.message).toBe('Hi {{name}}');
  });

  it('requires a subject', () => {
    const parsed = BroadcastSendSchema.safeParse({
      channel: 'EMAIL',
      html: '<p>Hi</p>',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes('subject'))).toBe(true);
    }
  });

  it('requires an HTML body or a plain-text message', () => {
    const parsed = BroadcastSendSchema.safeParse({
      channel: 'EMAIL',
      subject: 'Hello',
    });
    expect(parsed.success).toBe(false);
  });

  it('caps image attachments at 10', () => {
    const parsed = BroadcastSendSchema.safeParse({
      channel: 'EMAIL',
      subject: 'Hello',
      html: '<p>Hi</p>',
      imageUrls: Array.from({ length: 11 }, (_, index) => `https://cdn.example.com/${index}.jpg`),
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects non-URL image values', () => {
    const parsed = BroadcastSendSchema.safeParse({
      channel: 'EMAIL',
      subject: 'Hello',
      html: '<p>Hi</p>',
      imageUrls: ['not-a-url'],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('BroadcastSendSchema — SMS', () => {
  it('accepts a short message', () => {
    const parsed = BroadcastSendSchema.parse({ channel: 'SMS', message: 'Hi {{name}}' });
    expect(parsed.channel).toBe('SMS');
  });

  it('requires a message', () => {
    expect(BroadcastSendSchema.safeParse({ channel: 'SMS' }).success).toBe(false);
    expect(BroadcastSendSchema.safeParse({ channel: 'SMS', message: '   ' }).success).toBe(false);
  });

  it('rejects messages over 500 characters', () => {
    const parsed = BroadcastSendSchema.safeParse({
      channel: 'SMS',
      message: 'x'.repeat(501),
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown channel', () => {
    expect(BroadcastSendSchema.safeParse({ channel: 'PIGEON', message: 'Hi' }).success).toBe(false);
  });
});
