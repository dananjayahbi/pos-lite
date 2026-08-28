/**
 * Wedagedara - Footer Module
 * Smooth Scroll to Top and Anchor Link Controller.
 */

// ========================================================
// FOOTER CONTROLLER
// ========================================================
class FooterManager {
  constructor() {
    this.backToTopBtn = document.getElementById('footer-back-to-top');
    this.init();
  }

  init() {
    this.bindBackToTop();
    this.bindNavLinks();
  }

  bindBackToTop() {
    if (!this.backToTopBtn) return;

    this.backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  bindNavLinks() {
    const footerLinks = document.querySelectorAll('.footer-nav-link[href^="#"]');
    footerLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId !== '#') {
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }
      });
    });
  }
}
