/**
 * Wedagedara - Hero Slider Configuration & Controller
 * ERP Customizable hero slide data + HeroSlider class.
 */

// ========================================================
// HERO SLIDER CONFIGURATION (ERP Customizable)
// ========================================================
const heroSlides = [
  {
    id: 1,
    index: "01.",
    leftTitleMain: "PROTECT",
    leftTitleSub: "NATURE",
    leftTagline: "Ayurvedic Botanical Healing",
    rightHeading: "VITALITY & WELLNESS",
    description: "Experience the profound harmony of authentic Ayurvedic elixirs, hand-harvested from pristine medicinal forests to restore natural vitality and peace.",
    bgImage: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=2000&q=85",
    ctaText: "Explore Remedies",
    ctaLink: "#products-section"
  },
  {
    id: 2,
    index: "02.",
    leftTitleMain: "ANCIENT",
    leftTitleSub: "WISDOM",
    leftTagline: "Time-Honored Formulations",
    rightHeading: "TRIDOSHA HARMONY",
    description: "Personalized herbal remedies crafted to balance Vata, Pitta, and Kapha energies through sacred botanical science and pure organic extracts.",
    bgImage: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2000&q=85",
    ctaText: "Discover Dosha Care",
    ctaLink: "#products-section"
  },
  {
    id: 3,
    index: "03.",
    leftTitleMain: "SACRED",
    leftTitleSub: "HERBS",
    leftTagline: "100% Certified Organic Roots",
    rightHeading: "NATURAL IMMUNITY",
    description: "Potent Ashwagandha, Ceylon Cinnamon, and Brahmi distilled via traditional methods to strengthen immunity and rejuvenate cellular health.",
    bgImage: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=2000&q=85",
    ctaText: "Shop Immunity",
    ctaLink: "#products-section"
  },
  {
    id: 4,
    index: "04.",
    leftTitleMain: "HOLISTIC",
    leftTitleSub: "HEALING",
    leftTagline: "Doctor Approved Therapies",
    rightHeading: "THERAPEUTIC OILS",
    description: "Sacred infused oils formulated to release tension, soothe joint discomfort, and deeply nourish skin and mind through ancestral healing arts.",
    bgImage: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=2000&q=85",
    ctaText: "View Herbal Oils",
    ctaLink: "#products-section"
  },
  {
    id: 5,
    index: "05.",
    leftTitleMain: "NATURE'S",
    leftTitleSub: "SANCTUARY",
    leftTagline: "Sustainable Sri Lankan Cultivation",
    rightHeading: "RESTORATIVE CARE",
    description: "Directly sourced from indigenous herbal sanctuaries, supporting biodiversity and delivering unmatched purity straight to your wellness routine.",
    bgImage: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=2000&q=85",
    ctaText: "Learn Our Story",
    ctaLink: "#about"
  }
];

// ========================================================
// HERO SLIDER CONTROLLER CLASS
// ========================================================
class HeroSlider {
  constructor(slides) {
    this.slides = slides;
    this.currentIndex = 0;
    this.autoplayInterval = 6500;
    this.timer = null;
    this.isTransitioning = false;

    // DOM Elements
    this.bgContainer = document.getElementById('hero-bg-container');
    this.leftTitleMainEl = document.getElementById('hero-title-main');
    this.leftTitleSubEl = document.getElementById('hero-title-sub');
    this.leftTaglineEl = document.getElementById('hero-tagline');
    this.slideNumberEl = document.getElementById('hero-slide-number');
    this.rightHeadingEl = document.getElementById('hero-right-heading');
    this.descriptionEl = document.getElementById('hero-description');
    this.ctaBtnEl = document.getElementById('hero-cta-btn');
    this.dotsContainer = document.getElementById('hero-dots-container');
    this.heroSection = document.getElementById('hero-section');

    this.init();
  }

  init() {
    this.renderBackgroundSlides();
    this.renderDots();
    this.setSlideContent(this.slides[0]);
    this.startAutoplay();
    this.bindEvents();
  }

  renderBackgroundSlides() {
    if (!this.bgContainer) return;
    this.bgContainer.innerHTML = '';
    this.slides.forEach((slide, index) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = `hero-bg-slide ${index === 0 ? 'active' : ''}`;
      slideDiv.style.backgroundImage = `url('${slide.bgImage}')`;
      slideDiv.setAttribute('data-slide-index', index);
      this.bgContainer.appendChild(slideDiv);
    });
  }

  renderDots() {
    if (!this.dotsContainer) return;
    this.dotsContainer.innerHTML = '';
    this.slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = `slider-dot ${index === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
      dot.addEventListener('click', () => {
        if (this.currentIndex !== index && !this.isTransitioning) {
          this.updateSlide(index);
          this.resetAutoplay();
        }
      });
      this.dotsContainer.appendChild(dot);
    });
  }

  updateSlide(index) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const slide = this.slides[index];
    this.currentIndex = index;

    // 1. Update background image
    const bgSlides = this.bgContainer ? this.bgContainer.querySelectorAll('.hero-bg-slide') : [];
    bgSlides.forEach((el, idx) => {
      if (idx === index) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // 2. Update pagination dots
    const dots = this.dotsContainer ? this.dotsContainer.querySelectorAll('.slider-dot') : [];
    dots.forEach((dot, idx) => {
      if (idx === index) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // 3. Smooth Text Transition
    const animatedElements = document.querySelectorAll('.slide-text-animate');
    animatedElements.forEach(el => el.classList.add('animate-out'));

    setTimeout(() => {
      this.setSlideContent(slide);
      animatedElements.forEach(el => el.classList.remove('animate-out'));
      setTimeout(() => {
        this.isTransitioning = false;
      }, 400);
    }, 280);
  }

  setSlideContent(slide) {
    if (this.leftTitleMainEl) this.leftTitleMainEl.textContent = slide.leftTitleMain;
    if (this.leftTitleSubEl) this.leftTitleSubEl.textContent = slide.leftTitleSub;
    if (this.leftTaglineEl) this.leftTaglineEl.textContent = slide.leftTagline;
    if (this.slideNumberEl) this.slideNumberEl.textContent = slide.index;
    if (this.rightHeadingEl) this.rightHeadingEl.textContent = slide.rightHeading;
    if (this.descriptionEl) this.descriptionEl.textContent = slide.description;
    if (this.ctaBtnEl) {
      this.ctaBtnEl.textContent = slide.ctaText;
      this.ctaBtnEl.setAttribute('href', slide.ctaLink);
    }
  }

  next() {
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    this.updateSlide(nextIndex);
  }

  prev() {
    const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.updateSlide(prevIndex);
  }

  startAutoplay() {
    this.timer = setInterval(() => this.next(), this.autoplayInterval);
  }

  stopAutoplay() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  resetAutoplay() {
    this.stopAutoplay();
    this.startAutoplay();
  }

  bindEvents() {
    if (this.heroSection) {
      this.heroSection.addEventListener('mouseenter', () => this.stopAutoplay());
      this.heroSection.addEventListener('mouseleave', () => this.startAutoplay());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        this.next();
        this.resetAutoplay();
      } else if (e.key === 'ArrowLeft') {
        this.prev();
        this.resetAutoplay();
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;

    if (this.heroSection) {
      this.heroSection.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      this.heroSection.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            this.next();
          } else {
            this.prev();
          }
          this.resetAutoplay();
        }
      }, { passive: true });
    }
  }
}
