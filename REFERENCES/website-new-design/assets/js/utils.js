/**
 * Wedagedara - Utilities (Share Button & Toast)
 */

// ========================================================
// SHARE FUNCTIONALITY
// ========================================================
function setupShareButton() {
  const shareBtn = document.getElementById('hero-share-btn');
  const shareToast = document.getElementById('share-toast');

  if (!shareBtn) return;

  shareBtn.addEventListener('click', async () => {
    const shareData = {
      title: 'Wedagedara - Authentic Ayurvedic Remedies',
      text: 'Explore handcrafted Ayurvedic healing and authentic natural remedies from Wedagedara.',
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User canceled
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        if (shareToast) {
          shareToast.innerHTML = `<i class="fa-solid fa-circle-check text-[#97c93e] text-sm"></i><span>Link copied to clipboard!</span>`;
          shareToast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
          shareToast.classList.add('opacity-100', 'translate-y-0');
          setTimeout(() => {
            shareToast.classList.remove('opacity-100', 'translate-y-0');
            shareToast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
          }, 2500);
        }
      } catch (err) {
        console.error('Clipboard copy failed', err);
      }
    }
  });
}
