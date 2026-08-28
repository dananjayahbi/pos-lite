/**
 * Wedagedara - Header Scroll Effect & Mobile Menu Controller
 */

// ========================================================
// MOBILE MENU CONTROLLER
// ========================================================
function setupMobileMenu() {
  const menuToggleBtn = document.getElementById('mobile-menu-btn');
  const closeMenuBtn = document.getElementById('mobile-menu-close');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  const openDrawer = () => {
    if (mobileDrawer && mobileBackdrop) {
      mobileDrawer.classList.remove('translate-x-full');
      mobileBackdrop.classList.remove('opacity-0', 'pointer-events-none');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeDrawer = () => {
    if (mobileDrawer && mobileBackdrop) {
      mobileDrawer.classList.add('translate-x-full');
      mobileBackdrop.classList.add('opacity-0', 'pointer-events-none');
      document.body.style.overflow = '';
    }
  };

  if (menuToggleBtn) menuToggleBtn.addEventListener('click', openDrawer);
  if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeDrawer);
  if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeDrawer);
  mobileNavLinks.forEach(link => link.addEventListener('click', closeDrawer));
}

// ========================================================
// HEADER SCROLL EFFECT
// ========================================================
function setupHeaderScroll() {
  const header = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('glass-nav', 'py-3.5', 'shadow-2xl');
      header.classList.remove('py-5');
    } else {
      header.classList.remove('glass-nav', 'py-3.5', 'shadow-2xl');
      header.classList.add('py-5');
    }
  });
}
