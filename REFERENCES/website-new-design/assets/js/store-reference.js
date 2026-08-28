/**
 * Wedagedara - Store Reference Module
 * Sanctuary Location with Glassmorphic Portal and Dark-Themed Google Map.
 */

// ========================================================
// STORE CONFIGURATION (ERP Customizable - Strict Schema)
// ========================================================
const storeReferenceConfig = {
  title: "OUR FLAGSHIP SANCTUARY",
  subtitle: "Step into our serene apothecary lounge in Colombo 07. Experience personalized herbal consultations, explore classical fresh decoctions, and discover handcrafted remedies prepared in our sacred forest sanctuaries.",
  addressLine1: "No. 42, Horton Place, Colombo 07",
  addressLine2: "Western Province, Sri Lanka (00700)",
  mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.772583543977!2d79.8687799!3d6.9177519!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ae25974a63fae3b%3A0x63a34a36f56f4d54!2sHorton%20Pl%2C%20Colombo%2000700!5e0!3m2!1sen!2slk!4v1700000000000!5m2!1sen!2slk"
};

// ========================================================
// STORE REFERENCE MANAGER CLASS
// ========================================================
class StoreReferenceManager {
  constructor(config) {
    this.config = config;
    this.mapFrame = document.querySelector('.store-map-frame');
    this.init();
  }

  init() {
    this.bindHoverInteractions();
  }

  bindHoverInteractions() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice || !this.mapFrame) return;

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
