/**
 * Wedagedara - Shop Catalog Module
 * Product Database, Live Search, Category Filters, Price Slider & Sorting Engine
 */

// ========================================================
// 01. PRODUCT DATABASE (12 Classical Ayurvedic Products)
// ========================================================
const ayurvedicProducts = [
  {
    id: "bhringraj-hair-oil",
    title: "Bhringraj Hair Oil",
    category: "Herbal Oils",
    price: 2084,
    rating: 4.9,
    reviewsCount: 48,
    stock: 32,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
    tags: ["hair", "hair-growth", "scalp"],
    variants: [
      { sku: "DAB-09-OIL-100ML", label: "100ml Bottle", price: 2084 },
      { sku: "DAB-09-OIL-200ML", label: "200ml Apothecary", price: 3850 },
      { sku: "DAB-09-OIL-500ML", label: "500ml Sanctuary Reserve", price: 8200 }
    ],
    description: "Traditional Bhringraj oil slow-cooked with fresh botanical extracts and cold-pressed sesame oil for deep root nourishment, accelerated hair growth, and scalp equilibrium."
  },
  {
    id: "mahanarayan-taila",
    title: "Mahanarayan Taila",
    category: "Herbal Oils",
    price: 2099,
    rating: 4.8,
    reviewsCount: 36,
    stock: 24,
    image: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=800&q=80",
    tags: ["joints", "vata", "massage"],
    variants: [
      { sku: "MAH-100ML", label: "100ml Dispenser", price: 2099 },
      { sku: "MAH-250ML", label: "250ml Family Pack", price: 4650 }
    ],
    description: "Ancient classical restorative formula with 54 Himalayan herbs for profound joint relief, muscle restoration, and balancing elevated Vata bio-energy."
  },
  {
    id: "kumkumadi-tailam",
    title: "Kumkumadi Sacred Tailam",
    category: "Skin Elixirs",
    price: 3450,
    rating: 5.0,
    reviewsCount: 89,
    stock: 18,
    image: "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80",
    tags: ["saffron", "glow", "skin"],
    variants: [
      { sku: "KUM-15ML", label: "15ml Dropper", price: 3450 },
      { sku: "KUM-30ML", label: "30ml Grand Dropper", price: 6200 }
    ],
    description: "Miraculous saffron beauty elixir infused with 26 precious herbs, sandalwood, and goat milk decoction for luminous cellular glow and complexion perfection."
  },
  {
    id: "brahmi-neelibringadi",
    title: "Brahmi Neelibringadi Oil",
    category: "Herbal Oils",
    price: 1850,
    rating: 4.7,
    reviewsCount: 31,
    stock: 40,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
    tags: ["cooling", "stress-relief", "hair"],
    variants: [
      { sku: "BRH-100ML", label: "100ml Bottle", price: 1850 },
      { sku: "BRH-200ML", label: "200ml Apothecary", price: 3400 }
    ],
    description: "Cooling cranial therapy formulated with fresh Brahmi and Indigo leaves to calm mental fatigue, soothe eye strain, and promote restorative deep sleep."
  },
  {
    id: "vata-restorative-balm",
    title: "Vata Restorative Balm",
    category: "Restorative Balms",
    price: 850,
    rating: 4.9,
    reviewsCount: 64,
    stock: 55,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    tags: ["pain-relief", "eucalyptus", "balm"],
    variants: [
      { sku: "BALM-25G", label: "25g Compact", price: 850 },
      { sku: "BALM-50G", label: "50g Jar", price: 1550 }
    ],
    description: "Fast-acting ancestral herbal balm enriched with Ceylon cinnamon, camphor, and eucalyptus oil for instant sinus clearing, headache relief, and muscle comfort."
  },
  {
    id: "ashwagandharishta-tonic",
    title: "Ashwagandharishta Tonic",
    category: "Sacred Arishtas",
    price: 1650,
    rating: 4.8,
    reviewsCount: 42,
    stock: 28,
    image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80",
    tags: ["vitality", "immunity", "ojas"],
    variants: [
      { sku: "ASH-375ML", label: "375ml Classic", price: 1650 },
      { sku: "ASH-750ML", label: "750ml Grand Flacon", price: 2950 }
    ],
    description: "Naturally fermented classical restorative arishta that elevates Ojas (vital vigor), combats nervous exhaustion, and reinforces immunological stamina."
  },
  {
    id: "centella-rejuvenating-cream",
    title: "Centella Rejuvenating Cream",
    category: "Skin Elixirs",
    price: 2200,
    rating: 4.9,
    reviewsCount: 53,
    stock: 22,
    image: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80",
    tags: ["centella", "collagen", "rejuvenation"],
    variants: [
      { sku: "CEN-50G", label: "50g Glass Jar", price: 2200 },
      { sku: "CEN-100G", label: "100g Vault Jar", price: 3950 }
    ],
    description: "Rich botanical collagen renewal cream powered by Ceylon Gotukola (Centella Asiatica) for firm, youthfully resilient, and deeply nourished skin."
  },
  {
    id: "organic-triphala-churnam",
    title: "Organic Triphala Churnam",
    category: "Sacred Arishtas",
    price: 950,
    rating: 4.9,
    reviewsCount: 77,
    stock: 60,
    image: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80",
    tags: ["detox", "digestion", "triphala"],
    variants: [
      { sku: "TRI-100G", label: "100g Pouch", price: 950 },
      { sku: "TRI-250G", label: "250g Jar", price: 2100 }
    ],
    description: "The sacred trinity of Amalaki, Bibhitaki, and Haritaki for gentle internal purification, metabolic balance, and superior antioxidant defense."
  },
  {
    id: "kasthuri-turmeric-ubtan",
    title: "Kasthuri Golden Turmeric Ubtan",
    category: "Skin Elixirs",
    price: 1450,
    rating: 4.7,
    reviewsCount: 29,
    stock: 35,
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
    tags: ["turmeric", "exfoliation", "glow"],
    variants: [
      { sku: "TUR-100G", label: "100g Earthen Jar", price: 1450 }
    ],
    description: "Wild Kasturi Manjal root powder blended with red sandalwood and almond meal for gentle skin exfoliation and natural blemish clearing."
  },
  {
    id: "pinda-taila-soothing-oil",
    title: "Pinda Pitta Soothing Oil",
    category: "Herbal Oils",
    price: 1750,
    rating: 4.8,
    reviewsCount: 25,
    stock: 19,
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
    tags: ["pitta", "cooling", "joint-heat"],
    variants: [
      { sku: "PIN-150ML", label: "150ml Flacon", price: 1750 },
      { sku: "PIN-300ML", label: "300ml Flacon", price: 3200 }
    ],
    description: "Cooling ruby elixir formulated with Manjistha, Sariva, and bees-wax to alleviate inflammatory joint heat, redness, and gout discomfort."
  },
  {
    id: "dashamularishta-tonic",
    title: "Dashamularishta Tonic",
    category: "Sacred Arishtas",
    price: 1800,
    rating: 4.8,
    reviewsCount: 38,
    stock: 26,
    image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80",
    tags: ["ten-roots", "vitality", "strength"],
    variants: [
      { sku: "DAS-375ML", label: "375ml Classic", price: 1800 },
      { sku: "DAS-750ML", label: "750ml Flacon", price: 3200 }
    ],
    description: "Legendary ten-root fermented elixir prescribed for systemic rejuvenation, physical stamina, and post-illness vitality."
  },
  {
    id: "neem-tulsi-cleanser",
    title: "Neem & Sacred Tulsi Cleanser",
    category: "Skin Elixirs",
    price: 1250,
    rating: 4.9,
    reviewsCount: 44,
    stock: 45,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    tags: ["neem", "tulsi", "purifying"],
    variants: [
      { sku: "NEM-150ML", label: "150ml Pump Bottle", price: 1250 }
    ],
    description: "Purifying herbal face wash crafted with cold-pressed Neem leaf hydrosol and Holy Basil to detoxify pores and restore dermal balance."
  }
];

// ========================================================
// 02. SHOP CATALOG CONTROLLER CLASS
// ========================================================
class ShopManager {
  constructor(products) {
    this.allProducts = products;
    this.filteredProducts = [...products];
    
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.maxPrice = 7000;
    this.currentSort = 'featured';

    this.grid = document.getElementById('shop-product-grid');
    this.searchInput = document.getElementById('shop-search');
    this.categoryPills = document.querySelectorAll('.category-pill');
    this.priceSlider = document.getElementById('price-slider');
    this.priceDisplay = document.getElementById('price-display');
    this.sortSelect = document.getElementById('shop-sort');
    this.resultCount = document.getElementById('results-count');
    this.heroBg = document.querySelector('.shop-hero-bg');

    this.init();
  }

  init() {
    this.bindEvents();
    this.render();
    this.bindParallax();
  }

  bindEvents() {
    // Search
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFilters();
      });
    }

    // Categories
    this.categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedCategory = pill.getAttribute('data-category');
        this.applyFilters();
      });
    });

    // Price Slider
    if (this.priceSlider) {
      this.priceSlider.addEventListener('input', (e) => {
        this.maxPrice = Number(e.target.value);
        if (this.priceDisplay) {
          this.priceDisplay.textContent = `Under Rs. ${this.maxPrice.toLocaleString()}`;
        }
        this.applyFilters();
      });
    }

    // Sort Dropdown
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.applyFilters();
      });
    }
  }

  applyFilters() {
    this.filteredProducts = this.allProducts.filter(product => {
      const matchCat = this.selectedCategory === 'all' || product.category === this.selectedCategory;
      const matchSearch = product.title.toLowerCase().includes(this.searchQuery) ||
                          product.tags.some(tag => tag.toLowerCase().includes(this.searchQuery)) ||
                          product.category.toLowerCase().includes(this.searchQuery);
      const matchPrice = product.price <= this.maxPrice;

      return matchCat && matchSearch && matchPrice;
    });

    // Sorting
    if (this.currentSort === 'price-low') {
      this.filteredProducts.sort((a, b) => a.price - b.price);
    } else if (this.currentSort === 'price-high') {
      this.filteredProducts.sort((a, b) => b.price - a.price);
    } else if (this.currentSort === 'rating') {
      this.filteredProducts.sort((a, b) => b.rating - a.rating);
    }

    this.render();
  }

  render() {
    if (!this.grid) return;

    if (this.resultCount) {
      this.resultCount.textContent = `Showing ${this.filteredProducts.length} Ayurvedic Formulation${this.filteredProducts.length === 1 ? '' : 's'}`;
    }

    if (this.filteredProducts.length === 0) {
      this.grid.innerHTML = `
        <div class="col-span-full py-16 text-center">
          <div class="w-16 h-16 rounded-full bg-[#97c93e]/10 border border-[#97c93e]/30 flex items-center justify-center text-[#97c93e] text-2xl mx-auto mb-4">
            <i class="fa-solid fa-leaf"></i>
          </div>
          <h3 class="font-cinzel text-xl text-white font-bold mb-2">No Sacred Remedies Found</h3>
          <p class="text-sm text-gray-400 max-w-md mx-auto">Try adjusting your keyword search, category filter, or price limit to find available elixirs.</p>
        </div>
      `;
      return;
    }

    const cardsHTML = this.filteredProducts.map(p => `
      <div class="shop-card group">
        <div>
          <div class="shop-card-img-wrap">
            <img src="${p.image}" alt="${p.title}" class="shop-card-img" loading="lazy" />
            <span class="shop-card-badge">${p.category}</span>
          </div>

          <a href="product-detail.html?id=${p.id}" class="block">
            <h3 class="shop-card-title">${p.title}</h3>
          </a>

          <div class="flex items-center gap-1.5 mt-2">
            <div class="flex text-amber-400 text-xs">
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star-half-stroke"></i>
            </div>
            <span class="text-xs text-gray-400 font-sans">(${p.reviewsCount})</span>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <span class="shop-card-price">Rs. ${p.price.toLocaleString()}</span>
            <span class="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
              <i class="fa-solid fa-check mr-1"></i> In Stock
            </span>
          </div>

          <a href="product-detail.html?id=${p.id}" class="shop-card-cta">
            <span>View Details</span>
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </a>
        </div>
      </div>
    `).join('');

    this.grid.innerHTML = cardsHTML;
  }

  bindParallax() {
    if (!this.heroBg) return;

    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      if (scrollY < window.innerHeight) {
        this.heroBg.style.transform = `translate3d(0, ${(scrollY * 0.25).toFixed(1)}px, 0) scale(${1 + scrollY * 0.0001})`;
      }
    }, { passive: true });
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.shopManagerInstance = new ShopManager(ayurvedicProducts);
  if (typeof setupMobileMenu === 'function') setupMobileMenu();
  if (typeof setupHeaderScroll === 'function') setupHeaderScroll();
  if (typeof setupParallaxAndScrollEffects === 'function') setupParallaxAndScrollEffects();
  if (typeof FooterManager === 'function') window.footerManagerInstance = new FooterManager();
});
