/**
 * Restore the `dilani` (Ayur Wellness Centre / Wedagedara) storefront content.
 *
 * Context: `erp/tests/29_website_cms.spec.ts` wiped this tenant's WebsiteConfig
 * on 2026-09-17 (PUT-to-empty baseline + A2/A3 hard reset) and left QA fixtures
 * behind. Images were never deleted — they still live in Cloudflare R2 under
 * older tenant-id prefixes — so the content is rebuilt by re-pointing the
 * config at those preserved URLs.
 *
 * Everything is written through the ERP's OWN HTTP API so the storefront
 * revalidation fires exactly as it would from the admin UI.
 *
 * Usage: node scripts/restore-website-content.mjs            (dry run)
 *        node scripts/restore-website-content.mjs --apply    (write)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const erpRoot = resolve(__dirname, '..');

const BASE = process.env.ERP_BASE_URL || 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const APPLY = process.argv.includes('--apply');

// ── Preserved media (Cloudflare R2, bucket `poslite`) ────────────────────────
// Recovered from tenant-id prefixes left by earlier DB generations.
const R2 = 'https://pub-cb9257401309450fbbba5c298fcf0acc.r2.dev';
const G1 = `${R2}/cmshcv31q0001nosm4vb3yc0g`;
const G2 = `${R2}/cmrq7rqm50001zum1oab9v4j7`;

const IMG = {
  // Branding (verified: the සිංහල "ආයුර්වේද" logo mark)
  logo: `${G1}/logo/logo-1788206526157`,

  // Wide hero / scenery
  heroPots: `${G1}/website/images/1788253360868-Ayurvedic_products_website_backg__2K_202609011425.jpeg-1788253360871`,
  heroRiver: `${G1}/website/images/1788253363283-Ayurvedic_products_website_backg__2K_202609011428.jpeg-1788253363284`,
  heroBotanical: `${G1}/website/images/1788012013362-pexels-quang-nguyen-vinh-222549-6870864.jpg-1788012013373`,

  // Ayurveda product photography
  amrita: `${G1}/variants/1788254372893-1788254372893`,
  amritayuSet: `${G1}/variants/1788254382247-1788254382248`,
  amberDropper: `${G1}/variants/1788254377380-1788254377381`,
  amberMortar: `${G1}/variants/1788254396565-1788254396565`,
  ayurvedaJar: `${G1}/variants/1788254402838-1788254402838`,
  balancingElixir: `${G1}/variants/1788254382247-1788254382248`,
  p1: `${G1}/variants/1788253969059-1788253969060`,
  p2: `${G1}/variants/1788253993920-1788253993921`,
  p3: `${G1}/variants/1788254179985-1788254179986`,
  p4: `${G1}/variants/1788254196118-1788254196119`,
  p5: `${G1}/variants/1788254205247-1788254205247`,
  p6: `${G1}/variants/1788254216988-1788254216990`,
  p7: `${G1}/variants/1788254407923-1788254407924`,

  // Older-generation Ayurveda product shots
  mmvCream: `${G1}/categories/image-1786040826079`,
  coabJar: `${G1}/categories/image-1786040986901`,
  coabJar2: `${G1}/categories/image-1786041351561`,
  oilForest: `${G1}/variants/1786039230233-1786039230234`,
  balmForest: `${G1}/variants/1786040204390-1786040204390`,
  turboJar: `${G1}/variants/1786040246063-1786040246064`,
  scrubJar: `${G1}/variants/1786040267944-1786040267945`,
  amberGround: `${G1}/variants/1786040284845-1786040284846`,
  booksOils: `${G1}/variants/1786040304062-1786040304063`,
  woodBottles: `${G2}/website/images/1785007017824-0425165edb25d6f006cc3c4778992d99.jpg-1785007017824`,

  // Brand marks
  baidyanathLogo: `${G1}/variants/1788253926968-1788253926970`,
  mmvLogo: `${G1}/brands/logo-1788120251057`,
};

// ── Business facts (from the design reference + seed data) ───────────────────
const PHONE = '+94 (0) 11 234 5678';
const EMAIL = 'care@wedagedara.lk';
const ADDRESS = 'No. 42, Horton Place, Colombo 07, Western Province, Sri Lanka (00700)';

const CATEGORY_IDS = {
  oils: 'cmu4ur414000lt0smgvqpdidj',
  capsules: 'cmu4ur414000kt0sm27218dcs',
  powders: 'cmu4ur414000jt0sm4zouc94d',
  teas: 'cmu4ur414000nt0smg3ju69lu',
  immunity: 'cmu4ur414000pt0smrmc6na6f',
  skinHair: 'cmu4ur414000ot0smkgf1izux',
};

// ── Hero slides (real marketing copy from the design reference) ──────────────
const HERO_SLIDES = [
  {
    mediaType: 'image',
    mediaUrl: IMG.heroPots,
    title: 'PROTECT NATURE',
    subtitle: 'Ayurvedic Botanical Healing',
    description:
      'Experience the profound harmony of authentic Ayurvedic elixirs, hand-harvested from pristine medicinal forests to restore natural vitality and peace.',
    ctaText: 'Explore Remedies',
    ctaLink: '/shop',
    isActive: true,
    sortOrder: 0,
  },
  {
    mediaType: 'image',
    mediaUrl: IMG.heroBotanical,
    title: 'ANCIENT WISDOM',
    subtitle: 'Time-Honored Formulations',
    description:
      'Personalized herbal remedies crafted to balance Vata, Pitta, and Kapha energies through sacred botanical science and pure organic extracts.',
    ctaText: 'Discover Dosha Care',
    ctaLink: '/shop',
    isActive: true,
    sortOrder: 1,
  },
  {
    mediaType: 'image',
    mediaUrl: IMG.amritayuSet,
    title: 'SACRED HERBS',
    subtitle: '100% Certified Organic Roots',
    description:
      'Potent Ashwagandha, Ceylon Cinnamon, and Brahmi distilled via traditional methods to strengthen immunity and rejuvenate cellular health.',
    ctaText: 'Shop Immunity',
    ctaLink: '/shop',
    isActive: true,
    sortOrder: 2,
  },
  {
    mediaType: 'image',
    mediaUrl: IMG.heroRiver,
    title: 'HOLISTIC HEALING',
    subtitle: 'Doctor Approved Therapies',
    description:
      'Sacred infused oils formulated to release tension, soothe joint discomfort, and deeply nourish skin and mind through ancestral healing arts.',
    ctaText: 'View Herbal Oils',
    ctaLink: '/shop',
    isActive: true,
    sortOrder: 3,
  },
  {
    mediaType: 'image',
    mediaUrl: IMG.amberMortar,
    title: "NATURE'S SANCTUARY",
    subtitle: 'Sustainable Sri Lankan Cultivation',
    description:
      'Directly sourced from indigenous herbal sanctuaries, supporting biodiversity and delivering unmatched purity straight to your wellness routine.',
    ctaText: 'Learn Our Story',
    ctaLink: '/about',
    isActive: true,
    sortOrder: 4,
  },
];

// ── Testimonials (real copy from the design reference) ───────────────────────
const TESTIMONIALS = [
  {
    customerName: 'Dr. Rohana Wijesinghe',
    customerTitle: 'Senior Ayurvedic Physician & Researcher',
    quote:
      "Wedagedara's dedication to authentic classical decoctions is unprecedented. The Kumkumadi Taila and Maha Aushadha elixir adhere strictly to traditional Ola Leaf formulas with pure, unadulterated botanical potency.",
    rating: 5,
  },
  {
    customerName: 'Elena Rostova',
    customerTitle: 'Founder & CEO, Geneva Wellness Sanctuary',
    quote:
      "Incorporating Wedagedara's Kasthuri Kaha serum into our holistic rejuvenation programs transformed our clients' skin vitality within weeks. The purity and cellular radiance it imparts is truly extraordinary.",
    rating: 5,
  },
  {
    customerName: 'Marcus Sterling',
    customerTitle: 'Managing Director, Global Health Ventures',
    quote:
      'The Ashwagandha Calming Drops have become an essential part of my daily executive routine. My sleep quality and mental resilience under high pressure have improved remarkably.',
    rating: 5,
  },
  {
    customerName: 'Priya Senanayake',
    customerTitle: 'Holistic Yoga & Mindfulness Master',
    quote:
      "A true gift from Ceylon's sacred soil. Every aroma, texture, and therapeutic oil carries the authentic healing spirit of genuine Ayurveda. I recommend Wedagedara to all my global retreat students.",
    rating: 5,
  },
  {
    customerName: 'Dr. Arthur Vance',
    customerTitle: 'Chief Medical Officer, Integrative Botanicals',
    quote:
      'What sets Wedagedara apart is the zero-compromise approach to chemical additives. 100% natural, slow-decocted, and ethically harvested from certified forest sanctuaries in Sri Lanka.',
    rating: 5,
  },
  {
    customerName: 'Aurelia Dubois',
    customerTitle: "Luxury Spa Director, Côte d'Azur",
    quote:
      "Our guests immediately notice the difference between commercial products and Wedagedara's sacred Tailas. The natural glow, deep hydration, and calming botanical aroma are simply peerless.",
    rating: 5,
  },
].map((t, i) => ({ ...t, sortOrder: i, isActive: true }));

// ── The config body (matches the storefront's exact field contract) ──────────
const CONFIG = {
  // Branding
  siteName: 'Wedagedara',
  tagline: 'Authentic Ayurvedic Remedies & Holistic Health',
  logoUrl: IMG.logo,
  faviconUrl: null,

  // Colours — match the dark "Wedagedara" theme tokens in globals.css
  primaryColor: '#97c93e',
  accentColor: '#c5a059',
  bgColor: '#051610',
  headingColor: '#ffffff',
  bodyColor: '#e6e6e6',

  // SEO
  metaTitle: 'Wedagedara | Authentic Ayurvedic Remedies & Holistic Health',
  metaDescription:
    'Hand-harvested Ceylon Ayurvedic elixirs, oils and formulations crafted from classical Ola Leaf recipes for mind, body and spirit.',

  // Social
  socialLinks: {
    facebook: 'https://facebook.com/wedagedara',
    instagram: 'https://instagram.com/wedagedara',
    youtube: 'https://youtube.com/@wedagedara',
    whatsapp: PHONE,
    phone: PHONE,
    email: EMAIL,
  },

  announcementBar: {
    text: 'Ayurvedic delivery across Sri Lanka & Worldwide',
    link: '/shop',
    isActive: true,
  },

  // NOTE: `buildHeaderNav` (website/src/lib/navigation.ts) ALWAYS prepends a
  // HOME link and ALWAYS appends the Appointments pill. `navItems` must
  // therefore list only the middle links — including HOME or Appointments here
  // renders them twice.
  navItems: [
    { label: 'ABOUT', href: '/about' },
    { label: 'SHOP', href: '/shop' },
    { label: 'CONTACT', href: '/contact' },
  ],

  sections: {
    hero: {
      isActive: true,
      sortOrder: 1,
      showConsultDoctor: true,
      consultDoctorLabel: 'Consult Doctor',
      consultDoctorLink: '/appointments',
      showCraftedBy: true,
      craftedByText: 'Crafted by Wedagedara Herbal Sanctuary',
      showSocialLinks: true,
      socialLinks: {
        facebook: 'https://facebook.com/wedagedara',
        instagram: 'https://instagram.com/wedagedara',
        youtube: 'https://youtube.com/@wedagedara',
        whatsapp: PHONE,
      },
    },
    imageSlider: {
      isActive: true,
      sortOrder: 2,
      label: 'AUTHENTIC AYURVEDIC CARE',
      title: 'CURATED BOTANICAL COLLECTIONS',
      subtitle:
        'Handcrafted formulas extracted from Ceylon medicinal herbs to balance mind, body, and spirit.',
      productCount: 7,
      productIds: [],
    },
    bestSelling: {
      isActive: true,
      sortOrder: 3,
      label: 'MOST LOVED BOTANICAL REMEDIES',
      title: 'TOP SELLING ITEMS',
      productCount: 7,
      productIds: [],
    },
    infoAd: {
      isActive: true,
      sortOrder: 4,
      desktopImageUrl: IMG.heroBotanical,
      mobileImageUrl: IMG.heroBotanical,
      title: 'INNER BALANCE',
      subtitle:
        'Ancient rituals for modern wellness. 100% natural Ayurvedic formulas, slow-prepared in small batches.',
      buttonText: 'Explore Remedies',
      buttonLink: '/shop',
    },
    categories: {
      isActive: true,
      sortOrder: 5,
      label: 'CURATED AYURVEDIC LINEUP',
      title: 'BOTANICAL CATEGORIES',
      categoryIds: Object.values(CATEGORY_IDS),
      categoryImages: {
        [CATEGORY_IDS.oils]: IMG.amberDropper,
        [CATEGORY_IDS.capsules]: IMG.p1,
        [CATEGORY_IDS.powders]: IMG.amrita,
        [CATEGORY_IDS.teas]: IMG.booksOils,
        [CATEGORY_IDS.immunity]: IMG.amritayuSet,
        [CATEGORY_IDS.skinHair]: IMG.mmvCream,
      },
    },
    latestProducts: {
      isActive: true,
      sortOrder: 6,
      label: 'NEW HERBAL ARRIVALS',
      title: 'FRESH APOTHECARY',
      productCount: 7,
      productIds: [],
    },
    testimonials: {
      isActive: true,
      sortOrder: 7,
      label: 'VOICES OF HEALING',
      title: 'TRUSTED BY PHYSICIANS & WELLNESS SEEKERS',
      subtitle:
        'From senior Ayurvedic physicians to spa directors across the world.',
      items: TESTIMONIALS,
    },
    storeReference: {
      isActive: true,
      sortOrder: 8,
      desktopImageUrl: IMG.heroPots,
      title: 'VISIT OUR SANCTUARY',
      subtitle:
        'Our flagship apothecary and consultation rooms are open every day for personalised Ayurvedic care.',
      addressLine1: 'No. 42, Horton Place',
      addressLine2: 'Colombo 07, Sri Lanka',
    },
    footer: { isActive: true, sortOrder: 9 },
  },

  footerAbout:
    'Wedagedara revives ancestral Ceylon Ayurvedic medicine with ethically wild-harvested herbs and slow earthen decoctions.',
  footerColumns: [
    {
      title: 'EXPLORE APOTHECARY',
      links: [
        { label: 'Featured Elixirs & Oils', href: '/shop' },
        { label: 'Top Selling Remedies', href: '/shop' },
        { label: 'Botanical Categories', href: '/shop' },
        { label: 'Fresh Herbal Arrivals', href: '/shop' },
        { label: 'Physical Sanctuary', href: '/contact' },
      ],
    },
    {
      title: 'THE SANCTUARY',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Appointments', href: '/appointments' },
        { label: 'Order Tracking', href: '/track' },
      ],
    },
  ],

  appointments: {
    enabled: false,
    navLabel: 'Appointments',
    title: 'Book an Appointment',
    subtitle: 'Consult our Ayurvedic physicians for personalised care.',
    serviceIds: [],
    intro:
      'Choose a service and a time that suits you — our physicians will confirm by phone.',
  },

  // About page
  aboutPageTitle: 'About Us',
  aboutPageSubtitle: 'Learn more about our story and mission',
  aboutHeroImageUrl: IMG.heroRiver,
  aboutStoryTitle: 'Our Story',
  aboutStoryContent:
    'It all started when our founders, direct descendants of royal Ceylon Ayurvedic physicians, recognised that modern wellness had lost touch with the pure botanical alchemy of ancestral medicine.\n\nRooted in centuries-old Ola Leaf manuscripts preserved through family generations, Wedagedara was born to revive authentic Ayurvedic remedies. We combine ethical forest harvesting with slow-fire earthen decoction methods to extract the unadulterated healing essence of nature.',
  aboutStoryImageUrl: IMG.amritayuSet,
  aboutMissionTitle: 'Our Mission',
  aboutMissionContent:
    'We believe in the timeless balance of mind, body, and spirit. Our sacred mission is to restore cellular vitality and holistic longevity by delivering the purest, non-commercialised Ceylon Ayurvedic elixirs crafted with unwavering reverence for nature.',
  aboutValuesSectionTitle: 'Our Values',
  aboutValues: [
    {
      title: 'Ancestral Ola Leaf Purity',
      description:
        'Every formula adheres strictly to classical texts and ancestral decoction techniques without synthetic dilution.',
    },
    {
      title: 'Ethical Forest Sanctuaries',
      description:
        'We sustainably wild-harvest herbs from certified organic Ceylon forest reserves, honouring the natural regeneration cycles of the earth.',
    },
    {
      title: 'Tridosha Equilibrium',
      description:
        'Our remedies are carefully crafted to balance Vata, Pitta, and Kapha bio-energies for deep, holistic restoration.',
    },
    {
      title: 'Sacred Sustainability',
      description:
        'From earthen brewing vessels to zero-waste glass bottling, every touchpoint reflects our deep reverence for mother earth.',
    },
  ],
  aboutPhoneLabel: 'Speak to a Physician',
  aboutPhoneNumber: PHONE,

  // Contact page
  contactPageTitle: 'Contact Us',
  contactPageSubtitle: 'Visit our sanctuary or reach us directly.',
  contactHeroImageUrl: IMG.heroPots,
  contactInfoTitle: 'VISIT OUR SANCTUARY',
  contactAddress: ADDRESS,
  contactPhoneDisplay: PHONE,
  contactEmailDisplay: EMAIL,
  contactBusinessHours: 'Monday – Sunday: 8:00 AM – 7:00 PM',

  // Shop page
  shopPageTitle: 'Shop All Remedies',
  shopPageSubtitle: '100% Organically Wild-Harvested',
  shopHeroImageUrl: IMG.heroBotanical,
  shopPageDescription:
    'Authentic Ceylon Ayurvedic formulations — elixirs, tailas, ubtans and tonics — prepared from classical Ola Leaf recipes.',
  shopProductsPerPage: 24,

  // Relation rows
  heroSlides: HERO_SLIDES,
  ads: [
    {
      name: 'Inner Balance — Botanical Elixir',
      mediaType: 'image',
      mediaUrl: IMG.amrita,
      targetUrl: '/shop',
      position: 'between_sections',
      displayAfterSection: 'bestSelling',
      startsAt: '',
      endsAt: '',
      isActive: true,
    },
  ],
};

// ── Catalog image assignments (product id -> image) ─────────────────────────
const PRODUCT_IMAGES = {
  cmu4ur7u5000vt0sm4kobd37b: IMG.p1, // Ashwagandha Powder
  cmu4urnmu001at0sm0vdj74q3: IMG.p2, // Ashwagandha Capsules
  cmu4us0q4001qt0sm1pnauq7c: IMG.amberDropper, // Bhringraj Hair Oil
  cmu4urebb0013t0sm5yz8ab3n: IMG.p3, // Brahmi Powder
  cmu4urt72001gt0smosfk8249: IMG.p4, // Giloy Tablets
  cmu4urxzw001mt0sms2ezm6r4: IMG.p5, // Mahanarayan Oil
  cmu4urc8d000zt0smrs5fgzt7: IMG.scrubJar, // Triphala Churna
  cmu4urv9o001jt0sm220wzo6z: IMG.p6, // Triphala Tablets
  cmu4urr3h001dt0smvjemz538: IMG.turboJar, // Turmeric Curcumin Capsules
  cmu4uriak0016t0sm50n3jtb5: IMG.amrita, // Turmeric Powder
};

const CATEGORY_IMAGES = {
  [CATEGORY_IDS.oils]: IMG.amberDropper,
  [CATEGORY_IDS.capsules]: IMG.turboJar,
  [CATEGORY_IDS.powders]: IMG.amrita,
  [CATEGORY_IDS.teas]: IMG.booksOils,
  [CATEGORY_IDS.immunity]: IMG.amritayuSet,
  [CATEGORY_IDS.skinHair]: IMG.mmvCream,
};

const BRAND_LOGOS = {
  cmu4ur68i000st0sm1vh07a5e: IMG.baidyanathLogo, // Baidyanath
};

// ── Client ──────────────────────────────────────────────────────────────────
let cookie = '';
async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual',
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function login() {
  // Prime CSRF + session.
  await call('GET', '/api/auth/csrf');
  const csrf = JSON.parse(await (await fetch(`${BASE}/api/auth/csrf`, {
    headers: cookie ? { cookie } : {},
  })).text()).csrfToken;

  const form = new URLSearchParams({
    email: OWNER.email,
    password: OWNER.password,
    csrfToken: csrf,
    callbackUrl: `${BASE}/dashboard`,
    json: 'true',
  });
  await call('POST', '/api/auth/callback/credentials', undefined);
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: form.toString(),
    redirect: 'manual',
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  return res.status;
}

const log = (...a) => console.log(...a);
const results = { ok: 0, failed: [] };

async function main() {
  log(`Target ERP : ${BASE}`);
  log(`Mode       : ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no writes)'}\n`);

  const status = await login();
  const me = await call('GET', '/api/auth/session');
  const email = me.json?.user?.email;
  log(`Auth       : ${email ? `signed in as ${email}` : `FAILED (status ${status})`}`);
  if (!email) {
    log('Aborting — could not authenticate.');
    process.exitCode = 1;
    return;
  }

  // ── 1. Website config + hero slides + ads (single reconcile PUT) ──────────
  const before = await call('GET', '/api/store/website');
  log(`\n[1] Website config`);
  log(`    before: siteName=${JSON.stringify(before.json?.data?.siteName)} ` +
      `heroSlides=${before.json?.data?.heroSlides?.length ?? '?'} ads=${before.json?.data?.ads?.length ?? '?'}`);
  log(`    after : siteName="Wedagedara" heroSlides=${HERO_SLIDES.length} ads=1 ` +
      `+ about/contact/shop/footer/nav/testimonials`);

  if (APPLY) {
    const res = await call('PUT', '/api/store/website', CONFIG);
    log(`    PUT /api/store/website -> ${res.status}`);
    if (res.status !== 200) {
      log(`    ERROR: ${res.text.slice(0, 500)}`);
      results.failed.push(['config', res.status, res.text.slice(0, 300)]);
    } else {
      results.ok += 1;
      const after = await call('GET', '/api/store/website');
      log(`    verified: siteName=${JSON.stringify(after.json?.data?.siteName)} ` +
          `heroSlides=${after.json?.data?.heroSlides?.length} ads=${after.json?.data?.ads?.length}`);
    }
  }

  // ── 2. Catalog images ─────────────────────────────────────────────────────
  const catalog = [
    ...Object.entries(CATEGORY_IMAGES).map(([id, url]) => ['categories', id, { imageUrl: url }]),
    ...Object.entries(BRAND_LOGOS).map(([id, url]) => ['brands', id, { logoUrl: url }]),
    ...Object.entries(PRODUCT_IMAGES).map(([id, url]) => ['products', id, { mainImageUrl: url }]),
  ];

  log(`\n[2] Catalog images (${catalog.length})`);
  for (const [kind, id, body] of catalog) {
    if (!APPLY) {
      log(`    would PATCH /api/store/${kind}/${id} ${JSON.stringify(body)}`);
      continue;
    }
    const res = await call('PATCH', `/api/store/${kind}/${id}`, body);
    if (res.status === 200) {
      results.ok += 1;
      log(`    ok   ${kind}/${id}`);
    } else {
      results.failed.push([`${kind}/${id}`, res.status, res.text.slice(0, 200)]);
      log(`    FAIL ${kind}/${id} -> ${res.status} ${res.text.slice(0, 160)}`);
    }
  }

  log(`\n── Summary ──`);
  log(`  succeeded: ${results.ok}`);
  log(`  failed   : ${results.failed.length}`);
  for (const [what, code, msg] of results.failed) log(`    - ${what} (${code}): ${msg}`);
  if (!APPLY) log('\n(dry run — re-run with --apply to write)');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exitCode = 1;
});
