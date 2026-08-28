/**
 * Wedagedara - Contact Page Module
 * Configuration Data and Interactive Controllers for contact.html
 */

// ========================================================
// CONTACT PAGE CONFIGURATION (Strict Config Dashboard Match)
// ========================================================
const contactConfig = {
  pageTitle: "Contact Us",
  pageSubtitle: "We'd love to hear from you",
  heroImage: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1920&q=85",
  contactInfoTitle: "Get in Touch",
  address: "No. 42, Horton Place, Colombo 07, Western Province, Sri Lanka (00700)",
  phone: "+94 (0) 11 234 5678",
  email: "care@wedagedara.lk",
  businessHours: "Monday – Sunday: 8:00 AM – 7:00 PM",
  mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.772583543977!2d79.8687799!3d6.9177519!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ae25974a63fae3b%3A0x63a34a36f56f4d54!2sHorton%20Pl%2C%20Colombo%2000700!5e0!3m2!1sen!2slk!4v1700000000000!5m2!1sen!2slk"
};

// ========================================================
// CONTACT PAGE MANAGER CLASS
// ========================================================
class ContactPageManager {
  constructor(config) {
    this.config = config;
    this.heroBg = document.querySelector('.contact-hero-bg');
    this.mapFrame = document.querySelector('.contact-map-frame');
    this.init();
  }

  init() {
    this.bindHoverInteractions();
    this.bindParallax();
  }

  bindHoverInteractions() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) return;

    // 3D Tilt on Map Frame
    if (this.mapFrame) {
      this.mapFrame.addEventListener('mousemove', (e) => {
        const rect = this.mapFrame.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const percentX = (x - centerX) / centerX;
        const percentY = (y - centerY) / centerY;

        const rotateX = percentY * -4;
        const rotateY = percentX * 4;

        this.mapFrame.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.01, 1.01, 1.01)`;
      });

      this.mapFrame.addEventListener('mouseleave', () => {
        this.mapFrame.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    }
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
  window.contactPageManagerInstance = new ContactPageManager(contactConfig);
  if (typeof setupMobileMenu === 'function') setupMobileMenu();
  if (typeof setupHeaderScroll === 'function') setupHeaderScroll();
  if (typeof setupParallaxAndScrollEffects === 'function') setupParallaxAndScrollEffects();
  if (typeof FooterManager === 'function') window.footerManagerInstance = new FooterManager();
});
