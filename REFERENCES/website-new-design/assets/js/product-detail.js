/**
 * Wedagedara - Product Detail Page Controller
 * Reads product ID from URL, handles variants, quantity, and 5-card recommendations
 */

class ProductDetailPageManager {
  constructor(products) {
    this.products = products;
    this.currentProduct = null;
    this.selectedVariant = null;
    this.quantity = 1;

    this.init();
  }

  init() {
    this.resolveProductFromUrl();
    this.renderProductDetails();
    this.renderRelatedProducts();
    this.bindEvents();
    this.bindParallax();
  }

  resolveProductFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || 'bhringraj-hair-oil';

    this.currentProduct = this.products.find(p => p.id === productId) || this.products[0];
    this.selectedVariant = this.currentProduct.variants ? this.currentProduct.variants[0] : null;
  }

  renderProductDetails() {
    const p = this.currentProduct;
    if (!p) return;

    // Document Title
    document.title = `${p.title} - Wedagedara | Ayurvedic Apothecary`;

    // Breadcrumbs
    const breadcrumbsCurrent = document.getElementById('breadcrumb-product-name');
    if (breadcrumbsCurrent) breadcrumbsCurrent.textContent = p.title;

    // Images
    const mainImg = document.getElementById('detail-main-img');
    if (mainImg) {
      mainImg.src = p.image;
      mainImg.alt = p.title;
    }

    // Title & Tags
    const titleEl = document.getElementById('detail-title');
    if (titleEl) titleEl.textContent = p.title;

    const tagsContainer = document.getElementById('detail-tags-container');
    if (tagsContainer && p.tags) {
      tagsContainer.innerHTML = p.tags.map(t => `<span class="detail-tag-pill">${t}</span>`).join('');
    }

    // Price
    this.updatePriceDisplay();

    // Stock Status
    const stockEl = document.getElementById('detail-stock-status');
    if (stockEl) {
      stockEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mr-1.5"></i> In stock (${p.stock} available)`;
    }

    // Description
    const descEl = document.getElementById('detail-description');
    if (descEl) descEl.textContent = p.description;

    // Variants
    const variantsContainer = document.getElementById('detail-variants-container');
    if (variantsContainer && p.variants) {
      variantsContainer.innerHTML = p.variants.map((v, idx) => `
        <button type="button" class="variant-pill ${idx === 0 ? 'active' : ''}" data-sku="${v.sku}" data-price="${v.price}">
          ${v.sku}
        </button>
      `).join('');

      // Bind Variant clicks
      const variantBtns = variantsContainer.querySelectorAll('.variant-pill');
      variantBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          variantBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const sku = btn.getAttribute('data-sku');
          this.selectedVariant = p.variants.find(v => v.sku === sku);
          this.updatePriceDisplay();
        });
      });
    }
  }

  updatePriceDisplay() {
    const priceEl = document.getElementById('detail-price');
    if (!priceEl) return;

    const currentPrice = this.selectedVariant ? this.selectedVariant.price : this.currentProduct.price;
    priceEl.textContent = `Rs. ${currentPrice.toLocaleString()}`;
  }

  renderRelatedProducts() {
    const relatedContainer = document.getElementById('related-products-grid');
    if (!relatedContainer) return;

    // Get 5 other products
    const related = this.products.filter(p => p.id !== this.currentProduct.id).slice(0, 5);

    const relatedHTML = related.map(item => `
      <div class="related-card group">
        <div>
          <a href="product-detail.html?id=${item.id}" class="block">
            <div class="related-card-img-wrap">
              <img src="${item.image}" alt="${item.title}" class="related-card-img" loading="lazy" />
            </div>
            <h4 class="related-card-title">${item.title}</h4>
          </a>
        </div>
        <div>
          <span class="related-card-price">Rs. ${item.price.toLocaleString()}</span>
        </div>
      </div>
    `).join('');

    relatedContainer.innerHTML = relatedHTML;
  }

  bindEvents() {
    // Quantity controls
    const minusBtn = document.getElementById('qty-minus');
    const plusBtn = document.getElementById('qty-plus');
    const qtyDisplay = document.getElementById('qty-val');

    if (minusBtn && plusBtn && qtyDisplay) {
      minusBtn.addEventListener('click', () => {
        if (this.quantity > 1) {
          this.quantity--;
          qtyDisplay.textContent = this.quantity;
        }
      });

      plusBtn.addEventListener('click', () => {
        if (this.quantity < this.currentProduct.stock) {
          this.quantity++;
          qtyDisplay.textContent = this.quantity;
        }
      });
    }

    // Add to Cart
    const addToCartBtn = document.getElementById('add-to-cart-cta');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', () => {
        if (window.globalCartInstance) {
          const sku = this.selectedVariant ? this.selectedVariant.sku : null;
          window.globalCartInstance.addItem(this.currentProduct, sku, this.quantity);
        }
      });
    }

    // 3D Tilt on main image
    const mainImgFrame = document.querySelector('.product-main-img-frame');
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (mainImgFrame && !isTouchDevice) {
      mainImgFrame.addEventListener('mousemove', (e) => {
        const rect = mainImgFrame.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const percentX = (x - centerX) / centerX;
        const percentY = (y - centerY) / centerY;

        mainImgFrame.style.transform = `perspective(1000px) rotateX(${(-percentY * 5).toFixed(2)}deg) rotateY(${(percentX * 5).toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
      });

      mainImgFrame.addEventListener('mouseleave', () => {
        mainImgFrame.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    }
  }

  bindParallax() {
    // Parallax floating background elements handled by shared parallax.js
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.productDetailPageInstance = new ProductDetailPageManager(ayurvedicProducts);
  if (typeof setupMobileMenu === 'function') setupMobileMenu();
  if (typeof setupHeaderScroll === 'function') setupHeaderScroll();
  if (typeof setupParallaxAndScrollEffects === 'function') setupParallaxAndScrollEffects();
  if (typeof FooterManager === 'function') window.footerManagerInstance = new FooterManager();
});
