/**
 * Wedagedara - High-Performance Viewport-Relative Parallax & Scroll Engine
 * Smooth 60fps/120fps requestAnimationFrame loop with section-relative offsets.
 */

// ========================================================
// ADVANCED SECTION-RELATIVE PARALLAX & SCROLL ENGINE
// ========================================================
function setupParallaxAndScrollEffects() {
  const sections = document.querySelectorAll('section, header');
  const heroSection = document.getElementById('hero-section');
  const heroBg = document.getElementById('hero-bg-container');
  const heroContent = heroSection ? heroSection.querySelector('.grid') : null;

  let isTicking = false;

  function updateParallax() {
    const windowHeight = window.innerHeight;
    const scrollY = window.scrollY;

    // 1. Hero Section Soft Drift (Only active when Hero is visible)
    if (heroSection && scrollY < windowHeight) {
      if (heroBg) {
        const bgShift = scrollY * 0.25;
        heroBg.style.transform = `translate3d(0, ${bgShift.toFixed(1)}px, 0) scale(${Math.min(1.08, 1 + scrollY * 0.0001)})`;
      }
      if (heroContent) {
        const contentShift = -scrollY * 0.15;
        const opacity = Math.max(0, Math.min(1, 1 - (scrollY / (windowHeight * 0.75))));
        heroContent.style.transform = `translate3d(0, ${contentShift.toFixed(1)}px, 0)`;
        heroContent.style.opacity = opacity.toFixed(2);
      }
    }

    // 2. Section-Relative Parallax for Leaves, Glows, and Background Layers
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();

      // Only compute and update when section is in or near the viewport
      if (rect.bottom > -150 && rect.top < windowHeight + 150) {
        // Distance from center of viewport (-windowHeight/2 to +windowHeight/2)
        const relativeCenter = rect.top - (windowHeight / 2) + (rect.height / 2);

        // A. Floating Botanical Leaves in this section
        const leaves = section.querySelectorAll('.parallax-leaf');
        leaves.forEach((leaf, idx) => {
          const speed = parseFloat(leaf.getAttribute('data-speed') || (0.12 * (idx + 1)));
          // Limit shift to max +/- 45px so it never leaves its section bounds
          const rawShift = relativeCenter * speed * -0.4;
          const shiftY = Math.max(-45, Math.min(45, rawShift));
          const rotate = Math.max(-20, Math.min(20, relativeCenter * 0.03 * (idx % 2 === 0 ? 1 : -1)));
          leaf.style.transform = `translate3d(0, ${shiftY.toFixed(1)}px, 0) rotate(${rotate.toFixed(1)}deg)`;
        });

        // B. Ambient Glow Halos in this section
        const glows = section.querySelectorAll('.ambient-glow, .spotlight-halo');
        glows.forEach((glow, idx) => {
          const speed = 0.08 * (idx + 1);
          const rawShift = relativeCenter * speed * 0.3;
          const shiftY = Math.max(-30, Math.min(30, rawShift));
          glow.style.transform = `translate3d(0, ${shiftY.toFixed(1)}px, 0)`;
        });

        // C. Spotlight Featured Image Vertical Glide
        const spotlightImg = section.querySelector('.spotlight-img');
        if (spotlightImg) {
          const shiftY = Math.max(-20, Math.min(20, relativeCenter * -0.04));
          spotlightImg.style.transform = `scale(1.06) translateY(${shiftY.toFixed(1)}px)`;
        }

        // D. Store Reference Cinematic Background Parallax Drift
        const storeBg = section.querySelector('.store-bg-layer');
        if (storeBg) {
          const shiftY = relativeCenter * 0.1;
          storeBg.style.transform = `translate3d(0, ${shiftY.toFixed(1)}px, 0)`;
        }
      }
    });

    isTicking = false;
  }

  // Throttled Scroll Listener using requestAnimationFrame
  window.addEventListener('scroll', () => {
    if (!isTicking) {
      requestAnimationFrame(updateParallax);
      isTicking = true;
    }
  }, { passive: true });

  // Initial call on page load
  updateParallax();

  // Scroll Reveal Observer (Smooth Fade & Rise into view)
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -30px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));
}
