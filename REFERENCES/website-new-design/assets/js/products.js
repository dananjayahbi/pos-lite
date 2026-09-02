/**
 * Wedagedara - Products Slider Configuration & Controller
 * ERP Customizable product data + ProductsSlider class.
 */

// Fallback high-res image in case of any external asset loading issue
const FALLBACK_AYURVEDA_IMG = "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80";

// ========================================================
// FEATURED PRODUCTS CONFIGURATION (7 Cards + Full Modal Data)
// ========================================================
const erpProductsConfig = {
  sectionBadge: "AUTHENTIC AYURVEDIC CARE",
  sectionHeading: "CURATED BOTANICAL COLLECTIONS",
  sectionSubtext: "Handcrafted formulas extracted from Ceylon medicinal herbs to balance mind, body, and spirit.",
  maxProducts: 7,
  products: [
    {
      id: 1,
      title: "FACE SERUM",
      subtitle: "4 PRODUCTS",
      productName: "Kasthuri Kaha Glow Serum",
      price: "Rs. 2,850.00",
      volume: "50ml Dropper Bottle",
      description: "Wild turmeric & sandalwood extract for deep cellular radiance.",
      fullDetails: "Formulated with 100% authentic wild Kasthuri Kaha, red sandalwood, and virgin coconut nectar. Penetrates deep into dermal layers to reduce pigmentation, soothe skin inflammation, and restore natural youthful glow.",
      keyIngredients: ["Kasthuri Kaha (Wild Turmeric)", "Rath Sandun (Red Sandalwood)", "Gotu Kola Extract"],
      dosha: "Balances Pitta & Vata",
      image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
      link: "#products-face-serum"
    },
    {
      id: 2,
      title: "FACE CREAM",
      subtitle: "10 PRODUCTS",
      productName: "Kasthuri Kaha Night Cream",
      price: "Rs. 3,200.00",
      volume: "50g Glass Jar",
      description: "Overnight cellular renewal with precious Ceylon herbal botanicals.",
      fullDetails: "A luxurious nighttime cream infused with Venivel, Kasthuri Kaha, and cold-pressed sesame oil. Repairs daily oxidative damage, deeply moisturizes, and revitalizes skin elasticity while you rest peacefully.",
      keyIngredients: ["Venivel (Tree Turmeric)", "Ceylon Licorice", "Pure Sandalwood Oil"],
      dosha: "Tri-Dosha Harmonizing",
      image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80",
      link: "#products-face-cream"
    },
    {
      id: 3,
      title: "HAIR CARE",
      subtitle: "1 PRODUCT",
      productName: "Black Seed Vitalizing Oil",
      price: "Rs. 2,450.00",
      volume: "100ml Glass Bottle",
      description: "Pure Kalonji & Gotu Kola roots for root strengthening and gloss.",
      fullDetails: "Ancestral hair nourishment oil prepared using slow-boiled Kalonji (Black Seed), Keekirindiya, and Neelyadi herbal extracts. Strengthens hair follicles from the root, eliminates scalp dryness, and prevents premature graying.",
      keyIngredients: ["Kalonji (Black Seed)", "Keekirindiya (Eclipta Alba)", "Neelyadi Taila Herbs"],
      dosha: "Balances Pitta Heat",
      image: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=800&q=80",
      link: "#products-hair-care"
    },
    {
      id: 4,
      title: "BODY CARE",
      subtitle: "14 PRODUCTS",
      productName: "Olu Botanical Body Lotion",
      price: "Rs. 2,650.00",
      volume: "250ml Pump Bottle",
      description: "Hydrating sacred water lily extract blended with soothing aloe.",
      fullDetails: "Formulated with pure Nil Manel (Blue Water Lily) essence and indigenous Aloe Vera gel. Delivers weightless, non-greasy hydration while enveloping your senses in a calming, authentic botanical aroma.",
      keyIngredients: ["Olu Flower Extract (Water Lily)", "Organic Aloe Vera", "Almond Essence"],
      dosha: "Balances Vata Dryness",
      image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
      link: "#products-body-care"
    },
    {
      id: 5,
      title: "WELLNESS ELIXIR",
      subtitle: "6 PRODUCTS",
      productName: "Ashwagandha Calming Drops",
      price: "Rs. 3,600.00",
      volume: "30ml Liquid Extract",
      description: "Ancient adaptogenic root extract to relieve stress & boost vitality.",
      fullDetails: "Highly concentrated water-soluble Ashwagandha and Brahmi extract crafted through traditional decoction distillation. Supports adrenal wellness, calms racing thoughts, promotes deep restorative sleep, and bolsters immune vigor.",
      keyIngredients: ["Organic Ashwagandha (Withania Somnifera)", "Brahmi (Bacopa Monnieri)", "Wild Forest Honey"],
      dosha: "Pacifies Vata & Kapha",
      image: "https://images.unsplash.com/photo-1608248597359-281b67b12d59?auto=format&fit=crop&w=800&q=80",
      link: "#products-elixirs"
    },
    {
      id: 6,
      title: "FACIAL BALMS",
      subtitle: "8 PRODUCTS",
      productName: "Gotu Kola Restorative Balm",
      price: "Rs. 2,900.00",
      volume: "30g Balm Tin",
      description: "Gentle herbal nourishment for fine lines and under-eye renewal.",
      fullDetails: "Infused with cold-extracted Centella Asiatica (Gotu Kola) and beeswax. Gently tightens under-eye skin, reduces dark circles, and stimulates collagen synthesis naturally without synthetic additives.",
      keyIngredients: ["Gotu Kola (Centella Asiatica)", "Cera Alba (Natural Beeswax)", "Moringa Seed Oil"],
      dosha: "Balances Pitta & Kapha",
      image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
      link: "#products-balms"
    },
    {
      id: 7,
      title: "THERAPEUTIC OILS",
      subtitle: "5 PRODUCTS",
      productName: "Kumkumadi Sacred Taila",
      price: "Rs. 4,500.00",
      volume: "30ml Gold Dropper",
      description: "Rare Kashmiri saffron and lotus stamina for timeless radiance.",
      fullDetails: "The golden crown of classical Ayurveda. Crafted with 26 rare medicinal herbs, Grade-A Saffron filaments, and pure goat milk. Imparts a luminous complexion, fades hyperpigmentation, and regenerates cell texture.",
      keyIngredients: ["Kumkuma (Kashmiri Saffron)", "Chandana (Sandalwood)", "Manjistha (Indian Madder)"],
      dosha: "Tridoshic Rejuvenator",
      image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80",
      link: "#products-therapeutic-oils"
    }
  ]
};

// ========================================================
// FULL-WIDTH PRODUCTS SLIDER CONTROLLER CLASS
// ========================================================
class ProductsSlider {
  constructor(config) {
    this.config = config;
    this.track = document.getElementById('products-slider-track');
    this.prevBtn = document.getElementById('products-flank-prev');
    this.nextBtn = document.getElementById('products-flank-next');
    this.progressBar = document.getElementById('products-progress-bar');
    this.isDown = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.hasDragged = false;

    this.init();
  }

  init() {
    this.renderProducts();
    this.bindControls();
    this.bindMouseDrag();
    this.updateProgressBar();
    this.handleHorizontalParallax();
  }

  renderProducts() {
    if (!this.track) return;
    this.track.innerHTML = '';

    const items = this.config.products.slice(0, this.config.maxProducts || 7);

    items.forEach((item, index) => {
      const cardWrap = document.createElement('div');
      cardWrap.className = 'product-card-wrap flex-shrink-0 w-[260px] sm:w-[300px] md:w-[320px] lg:w-[350px] xl:w-[380px] py-4';
      
      const card = document.createElement('div');
      card.className = 'product-card flex flex-col group cursor-pointer select-none bg-[#092218]/90 p-3 sm:p-4 rounded-xl border border-white/5 shadow-xl';
      card.setAttribute('data-product-id', item.id);
      card.innerHTML = `
        <div class="product-image-wrap aspect-square w-full bg-[#0d3022] rounded-lg overflow-hidden relative shadow-2xl">
          <img 
            src="${item.image}" 
            alt="${item.title} - ${item.productName}" 
            class="product-slider-img w-full h-full object-cover object-center transform" 
            loading="lazy"
            onerror="this.onerror=null; this.src='${FALLBACK_AYURVEDA_IMG}';"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70 group-hover:opacity-30 transition-opacity duration-500"></div>
          
          <!-- Subtle Matte Sheen -->
          <div class="card-glare-overlay"></div>

          <!-- Category Indicator Badge -->
          <div class="absolute top-3 left-3 z-20">
            <span class="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] tracking-widest uppercase text-[#97c93e] font-medium">
              0${index + 1} / 07
            </span>
          </div>

          <!-- Quick View Action Button -->
          <div class="absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
            <span class="w-10 h-10 rounded-full bg-[#97c93e] text-black flex items-center justify-center text-xs shadow-xl hover:scale-110 transition-transform">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </span>
          </div>
        </div>

        <!-- Typography Layout with 3D Depth -->
        <div class="product-card-content mt-4 sm:mt-5 text-center flex flex-col items-center pb-2">
          <h4 class="text-sm sm:text-base lg:text-lg font-semibold tracking-[0.2em] uppercase text-white group-hover:text-[#97c93e] transition-colors">
            ${item.title}
          </h4>
          <span class="text-[11px] sm:text-xs tracking-[0.25em] uppercase text-[#97c93e]/80 font-medium mt-1">
            ${item.subtitle}
          </span>
          <p class="text-[11px] sm:text-xs text-gray-400 font-light mt-1.5 line-clamp-1 max-w-[90%] font-sans">
            ${item.description}
          </p>
        </div>
      `;

      // 3D Tilt with Glare Tracking
      const glare = card.querySelector('.card-glare-overlay');

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'box-shadow 300ms ease, border-color 300ms ease';
        if (glare) glare.style.opacity = '1';
      });

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const percentX = (x - centerX) / centerX;
        const percentY = (y - centerY) / centerY;

        const rotateX = percentY * -12;
        const rotateY = percentX * 12;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px)`;

        if (glare) {
          const glareX = (x / rect.width) * 100;
          const glareY = (y / rect.height) * 100;
          glare.style.background = `radial-gradient(circle at ${glareX.toFixed(1)}% ${glareY.toFixed(1)}%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 65%)`;
        }
      });

      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 500ms cubic-bezier(0.2, 1, 0.3, 1), box-shadow 400ms ease';
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        if (glare) glare.style.opacity = '0';
      });

      // Click to Open Modal (if not dragged)
      card.addEventListener('click', () => {
        if (!this.hasDragged) {
          openProductDetailsModal(item);
        }
      });

      cardWrap.appendChild(card);
      this.track.appendChild(cardWrap);
    });
  }

  bindControls() {
    if (!this.track) return;

    const getScrollStep = () => {
      const firstCard = this.track.querySelector('.product-card-wrap');
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
    const images = this.track.querySelectorAll('.product-slider-img');
    const trackRect = this.track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;

    images.forEach(img => {
      const cardRect = img.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const offset = (cardCenter - trackCenter) / (trackRect.width / 2);
      const shiftX = Math.max(-18, Math.min(18, offset * 14));
      img.style.transform = `scale(1.12) translateX(${shiftX.toFixed(2)}px)`;
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
