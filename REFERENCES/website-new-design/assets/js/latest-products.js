/**
 * Wedagedara - Latest Products Module
 * 7 Latest Products with Engineered Asymmetric Bento Mesh and Modal Integration.
 */

// ========================================================
// LATEST PRODUCTS CONFIGURATION (7 Products - Strict Schema)
// ========================================================
const latestProductsConfig = [
  {
    id: 301,
    title: "FACE WASH",
    productName: "Suwanda Kaha Radiant Cleanser",
    price: "Rs. 2,150.00",
    volume: "150ml Pump Bottle",
    description: "Gentle wild turmeric and sandalwood foaming cleanser for daily pore purification.",
    fullDetails: "Infused with cold-pressed Suwanda Kaha, red sandalwood root extract, and organic Ceylon honey. Cleanses away daily impurities, balances excess sebum without stripping moisture, and leaves skin radiantly soft.",
    keyIngredients: ["Suwanda Kaha (Fragrant Turmeric)", "Rath Sandun (Red Sandalwood)", "Forest Bee Honey"],
    dosha: "Balances Pitta & Kapha",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 302,
    title: "HAIR CARE",
    productName: "Argan & Gotu Kola Hair Mask",
    price: "Rs. 3,400.00",
    volume: "200g Deep Conditioning Tub",
    description: "Deep nourishing herbal root treatment to repair damaged hair follicles and split ends.",
    fullDetails: "An intensive restorative mask formulated with cold-pressed Argan Oil, Centella Asiatica (Gotu Kola), and virgin coconut cream. Penetrates dry strands to restore protein structure, reduce breakage, and boost lustrous bounce.",
    keyIngredients: ["Organic Argan Oil", "Centella Asiatica (Gotu Kola)", "Virgin Coconut Milk"],
    dosha: "Balances Vata & Pitta",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 303,
    title: "WELLNESS TEA",
    productName: "Triphala Detoxifying Herbal Tea",
    price: "Rs. 1,950.00",
    volume: "20 Pyramid Herbal Infusion Bags",
    description: "Ancestral 3-fruit decoction supporting healthy digestion and gentle internal detox.",
    fullDetails: "Crafted with the legendary Ayurvedic triad of Amalaki, Bibhitaki, and Haritaki. Enhances nutrient absorption, purifies the digestive tract naturally, and boosts cellular vitality with potent antioxidants.",
    keyIngredients: ["Amalaki (Indian Gooseberry)", "Bibhitaki (Terminalia Bellirica)", "Haritaki (Terminalia Chebula)"],
    dosha: "Tridosha Cleansing Master",
    image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 304,
    title: "BODY CARE",
    productName: "Sandalwood & Vetiver Body Scrub",
    price: "Rs. 2,750.00",
    volume: "250g Exfoliating Paste",
    description: "Mineral-rich herbal body scrub with micro-fine walnut shells and Ceylon vetiver.",
    fullDetails: "Gently polishes away dead dermal layers with natural walnut shell granules and pure Sandalwood paste. Soothes fatigued muscles with earthy Vetiver oil, leaving skin remarkably silky and subtly fragrant.",
    keyIngredients: ["White Sandalwood Powder", "Sevendarawa (Vetiver)", "Crushed Walnut Shell"],
    dosha: "Balances Pitta Heat",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 305,
    title: "WELLNESS TINCTURE",
    productName: "Brahmi Cognitive Clarity Drops",
    price: "Rs. 3,850.00",
    volume: "50ml Dropper Tincture",
    description: "Potent water-extracted Bacopa Monnieri to sharpen memory, focus, and mental calm.",
    fullDetails: "Extracted from freshly harvested Ceylon Brahmi leaves using low-temperature vacuum decoction. Calms cortisol spikes, optimizes neurotransmitter health, and sharpens cognitive endurance throughout high-stress days.",
    keyIngredients: ["Brahmi (Bacopa Monnieri)", "Gotu Kola Extract", "Pure Vegetable Glycerin"],
    dosha: "Pacifies Vata & Pitta",
    image: "https://images.unsplash.com/photo-1608248597359-281b67b12d59?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 306,
    title: "FACE CARE",
    productName: "Neem & Tea Tree Clarifying Serum",
    price: "Rs. 2,600.00",
    volume: "30ml Dropper Bottle",
    description: "Antimicrobial botanicals targeting blemishes, redness, and excess skin shine.",
    fullDetails: "A fast-absorbing non-comedogenic elixir powered by cold-pressed Kohomba (Neem) leaf extract and pure Tea Tree oil. Neutralizes acne-causing bacteria, calms inflammation, and promotes clear, balanced skin.",
    keyIngredients: ["Kohomba (Neem Leaf Extract)", "Australian Tea Tree", "Aloe Vera Nectar"],
    dosha: "Balances Kapha & Pitta",
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 307,
    title: "THERAPEUTIC OIL",
    productName: "Ceylon Cinnamon & Nutmeg Oil",
    price: "Rs. 3,100.00",
    volume: "100ml Warming Massage Oil",
    description: "Invigorating warming oil to relieve muscle stiffness and improve micro-circulation.",
    fullDetails: "Infused with pure Ceylon Cinnamon bark, Nutmeg, and sesame taila. Delivers deep soothing warmth to aching joints, relieves chronic muscular fatigue, and enhances peripheral blood circulation during massage.",
    keyIngredients: ["True Ceylon Cinnamon Bark", "Nutmeg Essential Oil", "Black Sesame Taila"],
    dosha: "Dispels Vata & Kapha Cold",
    image: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=800&q=80"
  }
];

// ========================================================
// LATEST PRODUCTS MANAGER CLASS (Asymmetric Bento Mesh)
// ========================================================
class LatestProductsManager {
  constructor(products) {
    this.products = products;
    this.grid = document.getElementById('latest-products-grid');
    this.init();
  }

  init() {
    this.renderGrid();
  }

  renderGrid() {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    this.products.forEach((product, index) => {
      const card = document.createElement('div');
      card.className = `latest-product-card latest-mesh-${index + 1} group select-none`;
      card.setAttribute('data-product-id', product.id);

      card.innerHTML = `
        <!-- Floating Image Pedestal Frame -->
        <div class="latest-img-frame">
          <div class="latest-img-aura"></div>
          <img 
            src="${product.image}" 
            alt="${product.productName}" 
            class="latest-product-img"
            loading="lazy"
            onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80';"
          />
        </div>

        <!-- 3D Matte Glare Overlay -->
        <div class="latest-glare-overlay"></div>

        <!-- Strict Content (Multi-Line Title + Price - Zero Overlap) -->
        <div class="latest-content">
          <h3 class="latest-title">
            ${product.productName}
          </h3>
          <div class="latest-price-row">
            <span class="latest-price">
              ${product.price}
            </span>
          </div>
        </div>
      `;

      // 3D Tilt with Specular Glare Tracking (Desktop Only)
      if (!isTouchDevice) {
        const glare = card.querySelector('.latest-glare-overlay');

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

          const rotateX = percentY * -8;
          const rotateY = percentX * 8;

          card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px)`;

          if (glare) {
            const glareX = (x / rect.width) * 100;
            const glareY = (y / rect.height) * 100;
            glare.style.background = `radial-gradient(circle at ${glareX.toFixed(1)}% ${glareY.toFixed(1)}%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 65%)`;
          }
        });

        card.addEventListener('mouseleave', () => {
          card.style.transition = 'transform 500ms cubic-bezier(0.2, 1, 0.3, 1), box-shadow 400ms ease';
          card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
          if (glare) glare.style.opacity = '0';
        });
      }

      // Click to open unified Product Details Modal
      card.addEventListener('click', () => {
        if (typeof openProductDetailsModal === 'function') {
          openProductDetailsModal(product);
        }
      });

      this.grid.appendChild(card);
    });
  }
}
