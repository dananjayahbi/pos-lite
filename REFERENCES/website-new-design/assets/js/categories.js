/**
 * Wedagedara - Top Categories Module
 * Interactive Kinetic Expanding Accordion Deck (Strict Schema: Image + Title + Count).
 */

// ========================================================
// TOP CATEGORIES CONFIGURATION (7 Categories - Strict Schema)
// ========================================================
const categoriesConfig = [
  {
    id: 1,
    title: "FACE SERUMS",
    productCount: "4 PRODUCTS",
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 2,
    title: "HERBAL CREAMS",
    productCount: "10 PRODUCTS",
    image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 3,
    title: "HAIR THERAPIES",
    productCount: "1 PRODUCT",
    image: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 4,
    title: "BODY WELLNESS",
    productCount: "14 PRODUCTS",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 5,
    title: "WELLNESS ELIXIRS",
    productCount: "6 PRODUCTS",
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 6,
    title: "FACIAL BALMS",
    productCount: "8 PRODUCTS",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 7,
    title: "SACRED TAILAS",
    productCount: "5 PRODUCTS",
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80"
  }
];

// ========================================================
// CATEGORIES MANAGER CLASS (Interactive Accordion Deck)
// ========================================================
class CategoriesManager {
  constructor(categories) {
    this.categories = categories;
    this.container = document.getElementById('categories-accordion');
    this.activeIndex = 0;
    this.init();
  }

  init() {
    this.renderAccordion();
    this.bindInteractions();
  }

  renderAccordion() {
    if (!this.container) return;
    this.container.innerHTML = '';

    this.categories.forEach((category, index) => {
      const slice = document.createElement('div');
      slice.className = `category-slice ${index === this.activeIndex ? 'active' : ''} group`;
      slice.setAttribute('data-category-id', category.id);
      slice.setAttribute('data-slice-index', index);
      slice.setAttribute('tabindex', '0');
      slice.setAttribute('role', 'button');
      slice.setAttribute('aria-label', `${category.title} - ${category.productCount}`);

      slice.innerHTML = `
        <!-- Full-Bleed Photograph -->
        <img 
          src="${category.image}" 
          alt="${category.title}" 
          class="category-slice-img"
          loading="lazy"
          onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80';"
        />

        <!-- Multi-Stop Gradient Vignette -->
        <div class="category-slice-overlay"></div>

        <!-- Collapsed View (Slim Vertical Mode on Desktop) -->
        <div class="category-collapsed-content">
          <span class="category-collapsed-number">0${index + 1}</span>
          <span class="category-collapsed-title">${category.title}</span>
          <div class="category-collapsed-icon">
            <i class="fa-solid fa-leaf"></i>
          </div>
        </div>

        <!-- Expanded View (Cinematic Active Showcase) -->
        <div class="category-expanded-content">
          <!-- Top Product Count Pill Badge -->
          <span class="category-count-badge">
            ${category.productCount}
          </span>

          <!-- Bottom Category Title Layout -->
          <div class="category-bottom-wrap">
            <h3 class="category-expanded-title">
              ${category.title}
            </h3>
            <div class="category-title-bar"></div>
          </div>
        </div>
      `;

      this.container.appendChild(slice);
    });
  }

  bindInteractions() {
    if (!this.container) return;
    const slices = this.container.querySelectorAll('.category-slice');

    slices.forEach((slice, index) => {
      // Mouse Enter Expansion
      slice.addEventListener('mouseenter', () => {
        this.setActive(index);
      });

      // Focus Expansion
      slice.addEventListener('focus', () => {
        this.setActive(index);
      });

      // Click to smooth scroll to products
      slice.addEventListener('click', () => {
        this.setActive(index);
        const productsSection = document.getElementById('products-section');
        if (productsSection) {
          productsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Reset to default on mouseleave
    this.container.addEventListener('mouseleave', () => {
      this.setActive(0);
    });
  }

  setActive(index) {
    if (this.activeIndex === index) return;
    this.activeIndex = index;
    const slices = this.container ? this.container.querySelectorAll('.category-slice') : [];
    slices.forEach((slice, idx) => {
      if (idx === index) {
        slice.classList.add('active');
      } else {
        slice.classList.remove('active');
      }
    });
  }
}
