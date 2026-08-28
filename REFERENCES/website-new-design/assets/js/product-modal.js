/**
 * Wedagedara - Product Details Popup Modal Controller
 * openProductDetailsModal, closeProductDetailsModal, setupProductModalEvents
 */

// ========================================================
// PRODUCT DETAILS POPUP MODAL CONTROLLER
// ========================================================
function openProductDetailsModal(product) {
  const modal = document.getElementById('product-details-modal');
  if (!modal) return;

  // 1. Populate Modal Elements
  const modalImg = document.getElementById('modal-product-img');
  const modalCategory = document.getElementById('modal-product-category');
  const modalTitle = document.getElementById('modal-product-title');
  const modalPrice = document.getElementById('modal-product-price');
  const modalVolume = document.getElementById('modal-product-volume');
  const modalFullDetails = document.getElementById('modal-product-fulldetails');
  const modalIngredientsContainer = document.getElementById('modal-product-ingredients');
  const modalDosha = document.getElementById('modal-product-dosha');

  if (modalImg) {
    modalImg.src = product.image;
    modalImg.alt = product.productName;
  }
  if (modalCategory) modalCategory.textContent = product.title;
  if (modalTitle) modalTitle.textContent = product.productName;
  if (modalPrice) modalPrice.textContent = product.price || "Rs. 2,850.00";
  if (modalVolume) modalVolume.textContent = product.volume || "100% Herbal Formulation";
  if (modalFullDetails) modalFullDetails.textContent = product.fullDetails || product.description;
  if (modalDosha) modalDosha.textContent = product.dosha || "Tri-Dosha Balanced";

  if (modalIngredientsContainer && product.keyIngredients) {
    modalIngredientsContainer.innerHTML = '';
    product.keyIngredients.forEach(ing => {
      const tag = document.createElement('span');
      tag.className = 'px-3 py-1 rounded-full bg-[#97c93e]/10 border border-[#97c93e]/20 text-[11px] font-medium text-emerald-200';
      tag.innerHTML = `<i class="fa-solid fa-leaf text-[9px] mr-1 text-[#97c93e]"></i> ${ing}`;
      modalIngredientsContainer.appendChild(tag);
    });
  }

  // 2. Open Modal
  modal.classList.add('modal-active');
  document.body.style.overflow = 'hidden';
}

function closeProductDetailsModal() {
  const modal = document.getElementById('product-details-modal');
  if (!modal) return;
  modal.classList.remove('modal-active');
  document.body.style.overflow = '';
}

function setupProductModalEvents() {
  const closeBtn = document.getElementById('product-modal-close');
  const backdrop = document.getElementById('product-modal-backdrop');

  if (closeBtn) closeBtn.addEventListener('click', closeProductDetailsModal);
  if (backdrop) backdrop.addEventListener('click', closeProductDetailsModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductDetailsModal();
    }
  });

  // Action: WhatsApp Order Button
  const orderWhatsAppBtn = document.getElementById('modal-order-whatsapp');
  if (orderWhatsAppBtn) {
    orderWhatsAppBtn.addEventListener('click', () => {
      const modalTitle = document.getElementById('modal-product-title')?.textContent || 'Ayurvedic Product';
      const text = encodeURIComponent(`Hello Wedagedara Ayurveda, I would like to order: ${modalTitle}`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    });
  }

  // Action: Proceed to Buy Button
  const proceedBuyBtn = document.getElementById('modal-proceed-buy');
  if (proceedBuyBtn) {
    proceedBuyBtn.addEventListener('click', () => {
      const modalTitle = document.getElementById('modal-product-title')?.textContent || 'Ayurvedic Product';
      const shareToast = document.getElementById('share-toast');
      if (shareToast) {
        shareToast.innerHTML = `<i class="fa-solid fa-circle-check text-[#97c93e] text-sm"></i><span>Added "${modalTitle}" to cart!</span>`;
        shareToast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
        shareToast.classList.add('opacity-100', 'translate-y-0');
        setTimeout(() => {
          shareToast.classList.remove('opacity-100', 'translate-y-0');
          shareToast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
        }, 2500);
      }
      closeProductDetailsModal();
    });
  }
}
