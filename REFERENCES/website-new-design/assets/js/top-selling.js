/**
 * Wedagedara - Top Selling Items Module
 * 7 Top Selling Products with Swipeable Carousel, 3D Sheen, and Modal Integration.
 */

// ========================================================
// TOP SELLING PRODUCTS CONFIGURATION (7 Products)
// ========================================================
const topSellingProductsConfig = [
  {
    id: 101,
    title: "FACE CARE",
    productName: "Kasthuri Kaha Glow Serum",
    price: "Rs. 2,850.00",
    volume: "50ml Dropper Bottle",
    description: "Wild Ceylon turmeric & red sandalwood extract formulated for deep cellular radiance.",
    fullDetails: "Formulated with 100% authentic wild Kasthuri Kaha, red sandalwood, and virgin coconut nectar. Penetrates deep into dermal layers to reduce pigmentation, soothe skin inflammation, and restore natural youthful glow.",
    keyIngredients: ["Kasthuri Kaha (Wild Turmeric)", "Rath Sandun (Red Sandalwood)", "Gotu Kola Extract"],
    dosha: "Balances Pitta & Vata",
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
    themeClass: "theme-emerald",
    tags: ["100% Herbal", "Radiance Elixir"]
  },
  {
    id: 102,
    title: "THERAPEUTIC OILS",
    productName: "Kumkumadi Sacred Taila",
    price: "Rs. 4,500.00",
    volume: "30ml Gold Dropper",
    description: "Rare Kashmiri saffron and lotus stamen distilled for timeless youth & complexion renewal.",
    fullDetails: "The golden crown of classical Ayurveda. Crafted with 26 rare medicinal herbs, Grade-A Saffron filaments, and pure goat milk. Imparts a luminous complexion, fades hyperpigmentation, and regenerates cell texture.",
    keyIngredients: ["Kumkuma (Kashmiri Saffron)", "Chandana (Sandalwood)", "Manjistha (Indian Madder)"],
    dosha: "Tridoshic Rejuvenator",
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80",
    themeClass: "theme-amber",
    tags: ["Top Rated", "Grade-A Saffron"]
  },
  {
    id: 103,
    title: "WELLNESS ELIXIR",
    productName: "Ashwagandha Calming Drops",
    price: "Rs. 3,600.00",
    volume: "30ml Liquid Extract",
    description: "Ancient adaptogenic root extract designed to alleviate stress and restore vital energy.",
    fullDetails: "Highly concentrated water-soluble Ashwagandha and Brahmi extract crafted through traditional decoction distillation. Supports adrenal wellness, calms racing thoughts, promotes deep restorative sleep, and bolsters immune vigor.",
    keyIngredients: ["Organic Ashwagandha (Withania Somnifera)", "Brahmi (Bacopa Monnieri)", "Wild Forest Honey"],
    dosha: "Pacifies Vata & Kapha",
    image: "https://images.unsplash.com/photo-1608248597359-281b67b12d59?auto=format&fit=crop&w=800&q=80",
    themeClass: "theme-moss",
    tags: ["Doctor Certified", "Stress Relief"]
  },
  {
    id: 104,
    title: "FACE CREAM",
    productName: "Kasthuri Kaha Night Cream",
    price: "Rs. 3,200.00",
    volume: "50g Glass Jar",
    description: "Overnight cellular renewal with precious Ceylon herbal botanicals & virgin sesame.",
    fullDetails: "A luxurious nighttime cream infused with Venivel, Kasthuri Kaha, and cold-pressed sesame oil. Repairs daily oxidative damage, deeply moisturizes, and revitalizes skin elasticity while you rest peacefully.",
    keyIngredients: ["Venivel (Tree Turmeric)", "Ceylon Licorice", "Pure Sandalwood Oil"],
    dosha: "Tri-Dosha Harmonizing",
    image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80",
    themeClass: "theme-emerald",
    tags: ["Overnight Care", "Hydration Boost"]
  },
  {
    id: 105,
    title: "HAIR CARE",
    productName: "Black Seed Vitalizing Oil",
    price: "Rs. 2,450.00",
    volume: "100ml Glass Bottle",
    description: "Pure Kalonji & Gotu Kola roots for root strengthening and deep lustrous shine.",
    fullDetails: "Ancestral hair nourishment oil prepared using slow-boiled Kalonji (Black Seed), Keekirindiya, and Neelyadi herbal extracts. Strengthens hair follicles from the root, eliminates scalp dryness, and prevents premature graying.",
    keyIngredients: ["Kalonji (Black Seed)", "Keekirindiya (Eclipta Alba)", "Neelyadi Taila Herbs"],
    dosha: "Balances Pitta Heat",
    image: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=800&q=80",
    themeClass: "theme-moss",
    tags: ["Root Nourishing", "Ancient Formula"]
  },
  {
    id: 106,
    title: "BODY CARE",
    productName: "Olu Botanical Body Lotion",
    price: "Rs. 2,650.00",
    volume: "250ml Pump Bottle",
    description: "Hydrating sacred water lily extract blended with soothing Ceylon aloe.",
    fullDetails: "Formulated with pure Nil Manel (Blue Water Lily) essence and indigenous Aloe Vera gel. Delivers weightless, non-greasy hydration while enveloping your senses in a calming, authentic botanical aroma.",
    keyIngredients: ["Olu Flower Extract (Water Lily)", "Organic Aloe Vera", "Almond Essence"],
    dosha: "Balances Vata Dryness",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    themeClass: "theme-amber",
    tags: ["Weightless Moisture", "Organic Aloe"]
  },
  {
    id: 107,
    title: "FACIAL BALMS",
    productName: "Gotu Kola Restorative Balm",
    price: "Rs. 2,900.00",
    volume: "30g Balm Tin",
    description: "Gentle herbal nourishment for fine lines and under-eye cellular renewal.",
    fullDetails: "Infused with cold-extracted Centella Asiatica (Gotu Kola) and beeswax. Gently tightens under-eye skin, reduces dark circles, and stimulates collagen synthesis naturally without synthetic additives.",
    keyIngredients: ["Gotu Kola (Centella Asiatica)", "Cera Alba (Natural Beeswax)", "Moringa Seed Oil"],
    dosha: "Balances Pitta & Kapha",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
    themeClass: "theme-emerald",
    tags: ["Collagen Boost", "100% Organic"]
  }
];

// ========================================================
// TOP SELLING SECTION MANAGER CLASS (Swipeable Carousel)
// ========================================================
class TopSellingManager {
  constructor(products) {
    this.products = products;
    this.track = document.getElementById('top-selling-track');
    this.prevBtn = document.getElementById('top-selling-prev');
    this.nextBtn = document.getElementById('top-selling-next');
    this.progressBar = document.getElementById('top-selling-progress-bar');
    this.isDown = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.hasDragged = false;

    this.init();
  }

  init() {
    this.renderCards();
    this.bindControls();
    this.bindMouseDrag();
    this.updateProgressBar();
    this.handleHorizontalParallax();
  }

  renderCards() {
    if (!this.track) return;
    this.track.innerHTML = '';

    this.products.forEach((product, index) => {
      const cardWrap = document.createElement('div');
      cardWrap.className = 'top-selling-card-wrap py-4';

      const card = document.createElement('div');
      card.className = `top-selling-card ${product.themeClass || 'theme-emerald'} p-4 sm:p-5 cursor-pointer group select-none`;
      card.innerHTML = `
        <div>
          <!-- Top Image with Gradient Fade -->
          <div class="top-selling-img-wrap rounded-2xl mb-4">
            <img 
              src="${product.image}" 
              alt="${product.productName}" 
              class="top-selling-img"
              loading="lazy"
              onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80';"
            />
            <div class="top-selling-img-fade"></div>
          </div>

          <!-- Title & Price Row -->
          <div class="flex items-start justify-between gap-3 mb-2.5 px-1 min-h-[2.25rem]">
            <h3 class="text-lg sm:text-xl font-bold font-cinzel text-white leading-tight group-hover:text-[#97c93e] transition-colors line-clamp-1">
              ${product.productName}
            </h3>
            <span class="top-selling-price-badge font-cinzel">
              ${product.price}
            </span>
          </div>

          <!-- 2-Line Subtitle Description -->
          <p class="text-xs text-gray-300 font-light leading-relaxed mb-6 px-1 line-clamp-2 min-h-[2.5rem]">
            ${product.description}
          </p>
        </div>

        <!-- Full-Width Pill Action Button -->
        <div class="pt-2 px-1">
          <button 
            class="top-selling-action-btn"
            aria-label="View details for ${product.productName}"
          >
            <span>View Details</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </button>
        </div>
      `;

      // Click to open unified modal (only if user did not drag)
      card.addEventListener('click', (e) => {
        if (!this.hasDragged) {
          if (typeof openProductDetailsModal === 'function') {
            openProductDetailsModal(product);
          }
        }
      });

      cardWrap.appendChild(card);
      this.track.appendChild(cardWrap);
    });
  }

  bindControls() {
    if (!this.track) return;

    const getScrollStep = () => {
      const firstCard = this.track.querySelector('.top-selling-card-wrap');
      return firstCard ? firstCard.offsetWidth + 24 : 360;
    };

    if (this.nextBtn) {
      this.nextBtn.removeAttribute('disabled');
      this.nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const step = getScrollStep();
        const maxScroll = this.track.scrollWidth - this.track.clientWidth;
        
        if (this.track.scrollLeft >= maxScroll - 15) {
          this.track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          this.track.scrollBy({ left: step, behavior: 'smooth' });
        }
      });
    }

    if (this.prevBtn) {
      this.prevBtn.removeAttribute('disabled');
      this.prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const step = getScrollStep();
        const maxScroll = this.track.scrollWidth - this.track.clientWidth;

        if (this.track.scrollLeft <= 15) {
          this.track.scrollTo({ left: maxScroll, behavior: 'smooth' });
        } else {
          this.track.scrollBy({ left: -step, behavior: 'smooth' });
        }
      });
    }

    this.track.addEventListener('scroll', () => {
      this.updateProgressBar();
      this.handleHorizontalParallax();
    }, { passive: true });
  }

  bindMouseDrag() {
    if (!this.track) return;

    this.track.addEventListener('mousedown', (e) => {
      this.isDown = true;
      this.hasDragged = false;
      this.startX = e.pageX - this.track.offsetLeft;
      this.scrollLeft = this.track.scrollLeft;
      this.track.style.cursor = 'grabbing';
      this.track.style.scrollBehavior = 'auto';
    });

    this.track.addEventListener('mouseleave', () => {
      if (this.isDown) {
        this.isDown = false;
        this.track.style.cursor = 'default';
        this.track.style.scrollBehavior = 'smooth';
      }
    });

    this.track.addEventListener('mouseup', () => {
      if (this.isDown) {
        this.isDown = false;
        this.track.style.cursor = 'default';
        this.track.style.scrollBehavior = 'smooth';
      }
    });

    this.track.addEventListener('mousemove', (e) => {
      if (!this.isDown) return;
      e.preventDefault();
      const x = e.pageX - this.track.offsetLeft;
      const walk = (x - this.startX) * 1.6;
      if (Math.abs(walk) > 6) {
        this.hasDragged = true;
      }
      this.track.scrollLeft = this.scrollLeft - walk;
    });
  }

  handleHorizontalParallax() {
    const images = this.track.querySelectorAll('.top-selling-img');
    const trackRect = this.track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;

    images.forEach(img => {
      const cardRect = img.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const offset = (cardCenter - trackCenter) / (trackRect.width / 2);
      const shiftX = Math.max(-16, Math.min(16, offset * 12));
      img.style.transform = `scale(1.08) translateX(${shiftX.toFixed(2)}px)`;
    });
  }

  updateProgressBar() {
    if (!this.track || !this.progressBar) return;
    const maxScrollLeft = this.track.scrollWidth - this.track.clientWidth;
    if (maxScrollLeft <= 0) {
      this.progressBar.style.width = '100%';
      return;
    }
    const percentage = Math.min(100, Math.max(14, (this.track.scrollLeft / maxScrollLeft) * 100));
    this.progressBar.style.width = `${percentage}%`;
  }
}
