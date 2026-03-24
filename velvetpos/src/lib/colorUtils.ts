/**
 * colorUtils.ts
 *
 * Resolves a user-entered colour name (e.g. "Navy Blue", "Burnt Orange",
 * "Sage Green") to a CSS colour string suitable for `style.backgroundColor`.
 *
 * Resolution order:
 *  1. Exact match against the full set of W3C CSS named colours
 *  2. Alias map of common compound / colloquial names
 *  3. Inline hex literal (#rgb / #rrggbb)
 *  4. Sliding-window sub-word search (finds "blue" inside "Navy Blue")
 *  5. Deterministic hsl() derived from a hash of the name (always unique, always visible)
 */

// ─── Full W3C CSS named colours (lowercase, no spaces) ───────────────────────
const CSS_NAMED: ReadonlySet<string> = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque',
  'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue',
  'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey',
  'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
  'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey',
  'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
  'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro',
  'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew',
  'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
  'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink',
  'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey',
  'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon',
  'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen',
  'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
  'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy',
  'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod',
  'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru',
  'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple', 'red', 'rosybrown',
  'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna',
  'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat',
  'white', 'whitesmoke', 'yellow', 'yellowgreen',
]);

// ─── Aliases for common compound / colloquial colour names ───────────────────
const ALIASES: Readonly<Record<string, string>> = {
  // Blues
  navyblue: 'navy',
  electricblue: '#007FFF',
  babyblue: '#89CFF0',
  cobaltblue: '#0047AB',
  powderblue: 'powderblue',
  icyblue: '#99C5C4',
  denimblue: '#1560BD',
  ceruleanblue: '#2A52BE',
  sapphireblue: '#0F52BA',
  steelblue: 'steelblue',
  // Greens
  olivegreen: 'olive',
  armygreen: '#4B5320',
  militarygreen: '#4B5320',
  sagegreen: '#BCB88A',
  mintgreen: '#98FF98',
  emeraldgreen: '#50C878',
  forestgreen: 'forestgreen',
  jadegreen: '#00A36C',
  huntergreen: '#355E3B',
  mosgreen: '#8A9A5B',
  mossgreen: '#8A9A5B',
  // Reds / Pinks
  babypink: '#FFB6C1',
  blushpink: '#FEC5E5',
  dustyrose: '#DCAE96',
  rosewater: '#F4C2C2',
  hotpink: 'hotpink',
  neonpink: '#FF6EC7',
  fuchsiapink: '#FF77FF',
  magentapink: '#FF00FF',
  // Oranges / Browns
  burntorange: '#CC5500',
  terracotta: '#E2725B',
  rust: '#B7410E',
  copperred: '#CB6D51',
  // Yellows
  mustardyellow: '#FFDB58',
  lemon: '#FFF44F',
  champagne: '#F7E7CE',
  // Purples
  lavenderblue: 'mediumpurple',
  lilac: '#C8A2C8',
  mauve: '#E0B0FF',
  wisteria: '#C9A0DC',
  amethyst: '#9966CC',
  eggplant: '#614051',
  plumred: '#8E4585',
  // Neutrals
  offwhite: '#FAF9F6',
  cream: '#FFFDD0',
  eggshell: '#F0EAD6',
  charcoal: '#36454F',
  gunmetal: '#2A3439',
  ashgray: '#B2BEB5',
  warmgray: '#9E9E9E',
  coolgray: '#8C92AC',
  slategray: 'slategray',
  // Metallics
  rose: '#FFB6C1',
  rosegold: '#B76E79',
  gold: 'gold',
  champagnegold: '#F7E7CE',
  silver: 'silver',
  // Misc
  nude: '#E3BC9A',
  camel: '#C19A6B',
  sand: '#C2B280',
  taupe: '#483C32',
  mushroom: '#CD9575',
  mocha: '#967259',
  espresso: '#3A2D28',
  chocolate: 'chocolate',
  caramel: '#C68642',
};

/**
 * Resolves any user-entered colour string to a CSS colour.
 * Returns `null` if input is empty/null (no dot will be rendered).
 */
export function resolveDisplayColor(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  const trimmed = raw.trim();

  // Pass through hex literals directly
  if (/^#[0-9a-fA-F]{3,6}$/.test(trimmed)) return trimmed;

  // Normalise: lowercase, collapse separators
  const key = trimmed.toLowerCase().replace(/[\s\-_]+/g, '');

  // 1. Exact CSS named colour
  if (CSS_NAMED.has(key)) return key;

  // 2. Alias map
  const aliasHit = ALIASES[key];
  if (aliasHit) return aliasHit;

  // 3. Sliding-window sub-word search
  //    e.g. "Navy Blue" → words = ["navy","blue"] → try "navyblue", "navy", "blue"
  const words = trimmed.toLowerCase().split(/[\s\-_]+/);
  for (let len = words.length; len >= 1; len--) {
    for (let start = 0; start <= words.length - len; start++) {
      const candidate = words.slice(start, start + len).join('');
      if (CSS_NAMED.has(candidate)) return candidate;
      const aliasWord = ALIASES[candidate];
      if (aliasWord) return aliasWord;
    }
  }

  // 4. Deterministic fallback: hash the name to a unique, mid-saturation hue
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (trimmed.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  }
  const hue = ((Math.abs(hash) % 360) + 360) % 360;
  return `hsl(${hue}, 60%, 52%)`;
}
