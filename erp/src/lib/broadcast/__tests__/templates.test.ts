import { describe, expect, it } from 'vitest';
import {
  BROADCAST_TEMPLATES,
  buildEmailHtml,
  buildSmsText,
  escapeHtml,
  getBroadcastTemplate,
  personalizeBroadcastContent,
  textToHtml,
} from '@/lib/broadcast/templates';

describe('personalizeBroadcastContent', () => {
  it('replaces the first name and store name', () => {
    expect(personalizeBroadcastContent('Hi {{name}} from {{storeName}}', 'Nimal Perera', 'Ayur')).toBe(
      'Hi Nimal from Ayur',
    );
  });

  it('replaces every occurrence', () => {
    expect(personalizeBroadcastContent('{{name}} {{name}}', 'Amal', 'Store')).toBe('Amal Amal');
  });
});

describe('escapeHtml / textToHtml', () => {
  it('escapes user-controlled characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('converts blank-line separated text into paragraphs', () => {
    expect(textToHtml('First line\nsecond line\n\nSecond block')).toBe(
      '<p>First line<br />second line</p>\n<p>Second block</p>',
    );
  });
});

describe('buildEmailHtml', () => {
  it('personalises an author-supplied HTML body', () => {
    const html = buildEmailHtml({
      html: '<p>Hi {{name}} from {{storeName}}</p></body>',
      customerName: 'Nimal Perera',
      storeName: 'Ayur',
    });
    expect(html).toContain('Hi Nimal from Ayur');
  });

  it('falls back to paragraph HTML when no template is supplied', () => {
    const html = buildEmailHtml({
      text: 'Hello {{name}}',
      customerName: 'Amal',
      storeName: 'Ayur',
    });
    expect(html).toBe('<p>Hello Amal</p>');
  });

  it('appends uploaded images as a gallery before </body>', () => {
    const html = buildEmailHtml({
      html: '<p>Hello</p></body>',
      customerName: 'Amal',
      storeName: 'Ayur',
      images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    });
    expect(html).toContain('<div class="gallery">');
    expect(html).toContain('src="https://cdn.example.com/a.jpg"');
    expect(html).toContain('src="https://cdn.example.com/b.jpg"');
    expect(html.indexOf('<div class="gallery">')).toBeLessThan(html.indexOf('</body>'));
  });

  it('does not duplicate images already embedded in the template', () => {
    const html = buildEmailHtml({
      html: '<img src="https://cdn.example.com/a.jpg" /></body>',
      customerName: 'Amal',
      storeName: 'Ayur',
      images: ['https://cdn.example.com/a.jpg'],
    });
    expect(html.match(/cdn\.example\.com\/a\.jpg/g)).toHaveLength(1);
  });
});

describe('buildSmsText', () => {
  it('personalises the SMS body', () => {
    expect(
      buildSmsText({
        message: 'Hi {{name}}, visit {{storeName}}',
        customerName: 'Nimal Perera',
        storeName: 'Ayur',
      }),
    ).toBe('Hi Nimal, visit Ayur');
  });
});

describe('BROADCAST_TEMPLATES', () => {
  it('exposes unique templates with a subject and HTML body', () => {
    const ids = BROADCAST_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const template of BROADCAST_TEMPLATES) {
      expect(template.subject.length).toBeGreaterThan(0);
      expect(template.html.length).toBeGreaterThan(0);
      expect(template.html).toContain('{{name}}');
    }
  });

  it('resolves a template by id', () => {
    expect(getBroadcastTemplate('promotion')?.name).toBe('Promotion');
    expect(getBroadcastTemplate('missing')).toBeNull();
  });
});
