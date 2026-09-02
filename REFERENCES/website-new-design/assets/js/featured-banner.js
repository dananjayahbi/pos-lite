/**
 * Wedagedara - Spotlight Featured Banner Module
 * 2-Column Showcase with Mouse Tilt, Parallax Drift, and Modal Integration.
 */

// ========================================================
// SPOTLIGHT PRODUCT CONFIGURATION (ERP Customizable)
// ========================================================
const spotlightProductData = {
  id: 201,
  title: "FLAGSHIP ELIXIR",
  productName: "Maha Aushadha Royal Restorative Elixir",
  price: "Rs. 5,400.00",
  volume: "100ml Pure Herbal Extract",
  description: "Ancestral master formulation crafted with 32 sacred herbs for total mind-body equilibrium.",
  fullDetails: "The crowning achievement of Wedagedara's master herbalists. Prepared according to the ancient Ola Leaf manuscripts of Ceylon, this royal elixir is slow-decocted over 72 hours with Wild Ginseng, Kashmiri Saffron, Blue Water Lily, and pure Forest Bee Honey. Recharges depleted Ojas (vital essence), enhances mental clarity, and shields against oxidative stress.",
  keyIngredients: ["Maha Aushadha Decoction", "Kashmiri Saffron (Grade A)", "Nil Manel (Blue Water Lily)", "Pure Forest Bee Honey"],
  dosha: "Tri-Dosha Master Balancing",
  image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=85"
};

// ========================================================
// SPOTLIGHT BANNER CONTROLLER CLASS
// ========================================================
class FeaturedBanner {
  constructor(product) {
    this.product = product;
    this.frame = document.querySelector('.spotlight-img-frame');
    this.buyBtn = document.getElementById('spotlight-buy-btn');
    this.init();
  }

  init() {
    this.bindHoverTilt();
    this.bindBuyButton();
  }

  bindHoverTilt() {
    if (!this.frame) return;

    this.frame.addEventListener('mousemove', (e) => {
      const rect = this.frame.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const percentX = (x - centerX) / centerX;
      const percentY = (y - centerY) / centerY;

      const rotateX = percentY * -8;
      const rotateY = percentX * 8;

      this.frame.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    this.frame.addEventListener('mouseleave', () => {
      this.frame.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  }

  bindBuyButton() {
    if (this.buyBtn) {
      this.buyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof openProductDetailsModal === 'function') {
          openProductDetailsModal(this.product);
        }
      });
    }
  }
}
