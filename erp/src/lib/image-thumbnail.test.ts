import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  createThumbnail,
  resolveDisplayImage,
  THUMBNAIL_EDGE,
} from '@/lib/image-thumbnail';

async function samplePng(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } },
  })
    .png()
    .toBuffer();
}

describe('createThumbnail', () => {
  it('crops and resizes to a square WebP', async () => {
    const output = await createThumbnail(await samplePng());
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(THUMBNAIL_EDGE);
    expect(metadata.height).toBe(THUMBNAIL_EDGE);
  });

  it('is much smaller than the source for large images', async () => {
    const source = await samplePng(2000, 1500);
    const thumb = await createThumbnail(source);
    expect(thumb.length).toBeLessThan(source.length / 4);
  });

  it('accepts a custom edge size', async () => {
    const output = await createThumbnail(await samplePng(), 96);
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(96);
    expect(metadata.height).toBe(96);
  });
});

describe('resolveDisplayImage', () => {
  it('prefers the thumbnail and falls back to the full image', () => {
    expect(resolveDisplayImage('full.webp', 'thumb.webp')).toBe('thumb.webp');
    expect(resolveDisplayImage('full.webp', null)).toBe('full.webp');
    expect(resolveDisplayImage(null, null)).toBeNull();
  });
});
