/**
 * Wedagedara - Application Entry Point
 * Initializes all section controllers on DOMContentLoaded.
 */

// ========================================================
// INITIALIZE ALL SECTIONS ON DOM READY
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  window.heroSliderInstance = new HeroSlider(heroSlides);
  window.productsSliderInstance = new ProductsSlider(erpProductsConfig);
  window.topSellingManagerInstance = new TopSellingManager(topSellingProductsConfig);
  window.featuredBannerInstance = new FeaturedBanner(spotlightProductData);
  window.categoriesManagerInstance = new CategoriesManager(categoriesConfig);
  window.latestProductsManagerInstance = new LatestProductsManager(latestProductsConfig);
  window.testimonialsManagerInstance = new TestimonialsManager(testimonialsConfig);
  window.storeReferenceManagerInstance = new StoreReferenceManager(storeReferenceConfig);
  window.footerManagerInstance = new FooterManager();
  setupProductModalEvents();
  setupMobileMenu();
  setupShareButton();
  setupHeaderScroll();
  setupParallaxAndScrollEffects();
});
