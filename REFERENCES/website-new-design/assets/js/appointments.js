/**
 * Wedagedara - Appointments Page Module
 * Configuration Data and Interactive Booking Terminal Controller
 */

// ========================================================
// APPOINTMENTS CONFIGURATION (Strict Config Dashboard Match)
// ========================================================
const appointmentsConfig = {
  navigationLabel: "Appointments",
  pageTitle: "Book a Channeling",
  pageSubtitle: "Reserve your appointment with our Ayurvedic doctor.",
  introText: "Select your preferred doctor, treatment service, and consultation time slot below.",
  heroImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1920&q=85",
  services: [
    "Nadi Pariksha (Pulse Diagnosis & Dosha Analysis)",
    "Panchakarma Detox & Cleansing Assessment",
    "Holistic Senior Physician Consultation",
    "Ayurvedic Herbal Rejuvenation & Skin Therapy",
    "Chronic Pain & Joint Relief Consultation"
  ],
  doctors: [
    "Dr. Rohana Wijesinghe - Chief Ayurvedic Physician",
    "Dr. Ananda Jayawardena - Senior Herbalist & Decoction Specialist",
    "Dr. Kanthi Senanayake - Panchakarma & Rejuvenation Master"
  ],
  timeSlots: [
    "09:00 AM", "10:30 AM", "11:45 AM", "02:00 PM", "03:30 PM", "05:00 PM"
  ]
};

// ========================================================
// APPOINTMENTS PAGE MANAGER CLASS
// ========================================================
class AppointmentsPageManager {
  constructor(config) {
    this.config = config;
    this.heroBg = document.querySelector('.appointments-hero-bg');
    this.bookingForm = document.getElementById('channeling-booking-form');
    this.timeSlotButtons = document.querySelectorAll('.time-slot-btn');
    this.selectedTimeInput = document.getElementById('selected-time-slot');
    this.successModal = document.getElementById('booking-success-modal');
    this.successCloseBtn = document.getElementById('booking-success-close');
    this.init();
  }

  init() {
    this.bindTimeSlots();
    this.bindFormSubmit();
    this.bindParallax();
  }

  bindTimeSlots() {
    this.timeSlotButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.timeSlotButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.selectedTimeInput) {
          this.selectedTimeInput.value = btn.getAttribute('data-slot');
        }
      });
    });
  }

  bindFormSubmit() {
    if (!this.bookingForm) return;

    this.bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('patient-name')?.value || 'Valued Patron';
      const doctor = document.getElementById('select-doctor')?.value || 'Chief Ayurvedic Physician';
      const date = document.getElementById('booking-date')?.value || 'Upcoming Date';
      const slot = this.selectedTimeInput?.value || '10:30 AM';

      const summaryText = document.getElementById('booking-summary-text');
      if (summaryText) {
        summaryText.innerHTML = `Thank you, <strong>${name}</strong>. Your consultation with <strong>${doctor}</strong> has been provisionally recorded for <strong>${date} at ${slot}</strong>. Our sanctuary care desk will contact you via WhatsApp to confirm.`;
      }

      if (this.successModal) {
        this.successModal.classList.remove('opacity-0', 'invisible', 'pointer-events-none');
        this.successModal.classList.add('opacity-100', 'visible', 'pointer-events-auto');
      }
    });

    if (this.successCloseBtn) {
      this.successCloseBtn.addEventListener('click', () => {
        if (this.successModal) {
          this.successModal.classList.add('opacity-0', 'invisible', 'pointer-events-none');
          this.successModal.classList.remove('opacity-100', 'visible', 'pointer-events-auto');
          this.bookingForm.reset();
          this.timeSlotButtons.forEach(b => b.classList.remove('active'));
        }
      });
    }
  }

  bindParallax() {
    if (!this.heroBg) return;

    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      if (scrollY < window.innerHeight) {
        this.heroBg.style.transform = `translate3d(0, ${(scrollY * 0.25).toFixed(1)}px, 0) scale(${1 + scrollY * 0.0001})`;
      }
    }, { passive: true });
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.appointmentsPageManagerInstance = new AppointmentsPageManager(appointmentsConfig);
  if (typeof setupMobileMenu === 'function') setupMobileMenu();
  if (typeof setupHeaderScroll === 'function') setupHeaderScroll();
  if (typeof setupParallaxAndScrollEffects === 'function') setupParallaxAndScrollEffects();
  if (typeof FooterManager === 'function') window.footerManagerInstance = new FooterManager();
});
