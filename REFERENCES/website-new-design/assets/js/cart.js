/**
 * Wedagedara - Global Cart Drawer Engine
 * Persistent LocalStorage Basket Management & Interactive Drawer Controller
 */

class CartManager {
  constructor() {
    this.storageKey = 'wedagedara_cart_items';
    this.items = this.loadCart();
    
    this.backdrop = document.getElementById('cart-backdrop');
    this.drawer = document.getElementById('cart-drawer');
    this.itemsContainer = document.getElementById('cart-items-container');
    this.subtotalDisplay = document.getElementById('cart-subtotal-val');
    this.headerBadge = document.getElementById('header-cart-badge');
    this.drawerCount = document.getElementById('cart-drawer-count');
    this.footer = document.getElementById('cart-footer');
    this.closeBtn = document.getElementById('cart-drawer-close');

    this.init();
  }

  init() {
    this.bindHeaderTriggers();
    this.bindDrawerControls();
    this.render();
  }

  loadCart() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading cart from localStorage', e);
    }
    // Default initial item so patron experiences populated basket immediately
    return [
      {
        id: "bhringraj-hair-oil",
        title: "Bhringraj Hair Oil",
        variantSku: "DAB-09-OIL-100ML",
        price: 2084,
        qty: 1,
        image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80"
      }
    ];
  }

  saveCart() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch (e) {
      console.warn('Error saving cart to localStorage', e);
    }
  }

  addItem(product, variantSku, qty = 1) {
    const sku = variantSku || (product.variants ? product.variants[0].sku : 'STANDARD');
    const existingIndex = this.items.findIndex(item => item.id === product.id && item.variantSku === sku);

    if (existingIndex > -1) {
      this.items[existingIndex].qty += qty;
    } else {
      let unitPrice = product.price;
      if (product.variants) {
        const foundVar = product.variants.find(v => v.sku === sku);
        if (foundVar) unitPrice = foundVar.price;
      }

      this.items.push({
        id: product.id,
        title: product.title,
        variantSku: sku,
        price: unitPrice,
        qty: qty,
        image: product.image
      });
    }

    this.saveCart();
    this.render();
    this.bumpBadge();
    this.open();
  }

  updateQty(id, variantSku, delta) {
    const item = this.items.find(i => i.id === id && i.variantSku === variantSku);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      this.removeItem(id, variantSku);
      return;
    }

    this.saveCart();
    this.render();
    this.bumpBadge();
  }

  removeItem(id, variantSku) {
    this.items = this.items.filter(i => !(i.id === id && i.variantSku === variantSku));
    this.saveCart();
    this.render();
    this.bumpBadge();
  }

  getTotalCount() {
    return this.items.reduce((total, item) => total + item.qty, 0);
  }

  getSubtotal() {
    return this.items.reduce((total, item) => total + (item.price * item.qty), 0);
  }

  open() {
    document.body.classList.add('cart-open');
  }

  close() {
    document.body.classList.remove('cart-open');
  }

  toggle() {
    document.body.classList.toggle('cart-open');
  }

  bumpBadge() {
    if (this.headerBadge) {
      this.headerBadge.classList.add('bump');
      setTimeout(() => this.headerBadge.classList.remove('bump'), 300);
    }
  }

  bindHeaderTriggers() {
    const triggerBtns = document.querySelectorAll('.cart-toggle-btn');
    triggerBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
    });
  }

  bindDrawerControls() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => this.close());
    }

    // Checkout CTA action
    const checkoutBtn = document.getElementById('cart-checkout-cta');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        alert('Proceeding to Wedagedara Secure Ayurvedic Checkout. Total: Rs. ' + this.getSubtotal().toLocaleString());
      });
    }
  }

  render() {
    const totalCount = this.getTotalCount();
    const subtotal = this.getSubtotal();

    // Badges & Counters
    if (this.headerBadge) {
      this.headerBadge.textContent = totalCount;
      this.headerBadge.style.display = totalCount > 0 ? 'flex' : 'none';
    }

    if (this.drawerCount) {
      this.drawerCount.textContent = `(${totalCount} item${totalCount === 1 ? '' : 's'})`;
    }

    if (this.subtotalDisplay) {
      this.subtotalDisplay.textContent = `Rs. ${subtotal.toLocaleString()}`;
    }

    // Items Container
    if (!this.itemsContainer) return;

    if (this.items.length === 0) {
      this.itemsContainer.innerHTML = `
        <div class="cart-empty-wrap">
          <div class="cart-empty-icon">
            <i class="fa-solid fa-bag-shopping"></i>
          </div>
          <h3 class="font-cinzel text-lg font-bold text-white mb-2">Your Basket is Empty</h3>
          <p class="text-xs text-gray-400 max-w-xs mb-6 font-sans">Discover handcrafted Ceylon herbal elixirs, oils, and restorative balms in our apothecary.</p>
          <a href="shop.html" class="px-6 py-2.5 rounded-full bg-[#97c93e] text-black font-cinzel font-bold text-xs tracking-wider uppercase hover:bg-[#b2db58] transition-colors">
            Browse Apothecary
          </a>
        </div>
      `;
      if (this.footer) this.footer.style.display = 'none';
      return;
    }

    if (this.footer) this.footer.style.display = 'block';

    const itemsHTML = this.items.map(item => `
      <div class="cart-item-card">
        <img src="${item.image}" alt="${item.title}" class="cart-item-img" />
        <div class="flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2">
              <h4 class="cart-item-title">${item.title}</h4>
              <button 
                type="button" 
                class="cart-remove-btn" 
                data-id="${item.id}" 
                data-sku="${item.variantSku}" 
                aria-label="Remove Item"
              >
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            <span class="cart-item-variant">${item.variantSku}</span>
          </div>

          <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <span class="cart-item-price">Rs. ${(item.price * item.qty).toLocaleString()}</span>
            
            <div class="cart-stepper">
              <button 
                type="button" 
                class="cart-stepper-btn cart-qty-minus" 
                data-id="${item.id}" 
                data-sku="${item.variantSku}"
              >-</button>
              <span class="cart-stepper-val">${item.qty}</span>
              <button 
                type="button" 
                class="cart-stepper-btn cart-qty-plus" 
                data-id="${item.id}" 
                data-sku="${item.variantSku}"
              >+</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    this.itemsContainer.innerHTML = itemsHTML;

    // Bind Steppers & Trash clicks
    this.itemsContainer.querySelectorAll('.cart-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const sku = btn.getAttribute('data-sku');
        this.updateQty(id, sku, -1);
      });
    });

    this.itemsContainer.querySelectorAll('.cart-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const sku = btn.getAttribute('data-sku');
        this.updateQty(id, sku, 1);
      });
    });

    this.itemsContainer.querySelectorAll('.cart-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const sku = btn.getAttribute('data-sku');
        this.removeItem(id, sku);
      });
    });
  }
}

// Global Cart Instance
window.globalCartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  window.globalCartInstance = new CartManager();
});
