/**
 * Wedagedara - About Page Module
 * Configuration Data and Interactive Controllers for about.html
 */

// ========================================================
// ABOUT PAGE CONFIGURATION (Strict Config Dashboard Match)
// ========================================================
const aboutConfig = {
  pageTitle: "About Us",
  pageSubtitle: "Learn more about our story and mission",
  heroImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1920&q=85",
  
  storyTitle: "Our Story",
  storyContent: [
    "It all started when our founders, direct descendants of royal Ceylon Ayurvedic physicians, recognized that modern wellness had lost touch with the pure botanical alchemy of ancestral medicine.",
    "Rooted in centuries-old Ola Leaf manuscripts preserved through family generations, Wedagedara was born to revive authentic Ayurvedic remedies. We combine ethical forest harvesting with slow-fire earthen decoction methods to extract the unadulterated healing essence of nature."
  ],
  storyImage: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=1000&q=85",
  
  missionTitle: "Our Mission",
  missionContent: "We believe in the timeless balance of mind, body, and spirit. Our sacred mission is to restore cellular vitality and holistic longevity by delivering purest, non-commercialized Ceylon Ayurvedic elixirs crafted with unwavering reverence for nature.",
  
  valuesSectionTitle: "Our Values",
  values: [
    {
      id: "01",
      title: "Ancestral Ola Leaf Purity",
      description: "Every formula adheres strictly to classical texts and ancestral decoction techniques without synthetic dilution."
    },
    {
      id: "02",
      title: "Ethical Forest Sanctuaries",
      description: "We sustainably wild-harvest herbs from certified organic Ceylon forest reserves, honoring the natural regeneration cycles of the earth."
    },
    {
      id: "03",
      title: "Tridosha Equilibrium",
      description: "Our remedies are carefully crafted to balance Vata, Pitta, and Kapha bio-energies for deep, holistic restoration."
    },
    {
      id: "04",
      title: "Sacred Sustainability",
      description: "From earthen brewing vessels to zero-waste glass bottling, every touchpoint reflects our deep reverence for mother earth."
    }
  ]
};

// ========================================================
// ABOUT PAGE MANAGER CLASS
// ========================================================
class AboutPageManager {
  constructor(config) {
    this.config = config;
    this.valuesGrid = document.getElementById('about-values-grid');
    this.heroBg = document.querySelector('.about-hero-bg');
    this.init();
  }

  init() {
    this.renderValues();
    this.bindParallax();
  }

  renderValues() {
    if (!this.valuesGrid) return;

    const valuesHTML = this.config.values.map(val => `
      <div class="value-card group select-none">
        <div>
          <span class="value-num">${val.id}</span>
          <h3 class="value-title">${val.title}</h3>
          <p class="value-desc">${val.description}</p>
        </div>
      </div>
    `).join('');

    this.valuesGrid.innerHTML = valuesHTML;
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
  window.aboutPageManagerInstance = new AboutPageManager(aboutConfig);
  if (typeof setupMobileMenu === 'function') setupMobileMenu();
  if (typeof setupHeaderScroll === 'function') setupHeaderScroll();
  if (typeof setupParallaxAndScrollEffects === 'function') setupParallaxAndScrollEffects();
  if (typeof FooterManager === 'function') window.footerManagerInstance = new FooterManager();
});
