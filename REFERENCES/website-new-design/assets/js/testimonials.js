/**
 * Wedagedara - Testimonials Module
 * Dual-Stream Kinetic Marquee River (Strict Schema: Name, Title, Quote, Rating).
 */

// ========================================================
// TESTIMONIALS CONFIGURATION (Strict 4-Element Schema)
// ========================================================
const testimonialsConfig = [
  {
    id: 1,
    name: "Dr. Rohana Wijesinghe",
    title: "Senior Ayurvedic Physician & Researcher",
    quote: "Wedagedara's dedication to authentic classical decoctions is unprecedented. The Kumkumadi Taila and Maha Aushadha elixir adhere strictly to traditional Ola Leaf formulas with pure, unadulterated botanical potency.",
    rating: 5
  },
  {
    id: 2,
    name: "Elena Rostova",
    title: "Founder & CEO, Geneva Wellness Sanctuary",
    quote: "Incorporating Wedagedara's Kasthuri Kaha serum into our holistic rejuvenation programs transformed our clients' skin vitality within weeks. The purity and cellular radiance it imparts is truly extraordinary.",
    rating: 5
  },
  {
    id: 3,
    name: "Marcus Sterling",
    title: "Managing Director, Global Health Ventures",
    quote: "The Ashwagandha Calming Drops have become an essential part of my daily executive routine. My sleep quality and mental resilience under high pressure have improved remarkably.",
    rating: 5
  },
  {
    id: 4,
    name: "Priya Senanayake",
    title: "Holistic Yoga & Mindfulness Master",
    quote: "A true gift from Ceylon's sacred soil. Every aroma, texture, and therapeutic oil carries the authentic healing spirit of genuine Ayurveda. I recommend Wedagedara to all my global retreat students.",
    rating: 5
  },
  {
    id: 5,
    name: "Dr. Arthur Vance",
    title: "Chief Medical Officer, Integrative Botanicals",
    quote: "What sets Wedagedara apart is the zero-compromise approach to chemical additives. 100% natural, slow-decocted, and ethically harvested from certified forest sanctuaries in Sri Lanka.",
    rating: 5
  },
  {
    id: 6,
    name: "Aurelia Dubois",
    title: "Luxury Spa Director, Côte d'Azur",
    quote: "Our guests immediately notice the difference between commercial products and Wedagedara's sacred Tailas. The natural glow, deep hydration, and calming botanical aroma are simply peerless.",
    rating: 5
  },
  {
    id: 7,
    name: "Kavinda Bandara",
    title: "Bio-Architect & Organic Living Advocate",
    quote: "The Gotu Kola Restorative Balm and Black Seed Hair Oil have restored my hair strength and under-eye vitality completely. It is rare to find such honest, high-potency Ayurvedic remedies.",
    rating: 5
  },
  {
    id: 8,
    name: "Sophia Chen",
    title: "Executive Director, Mindful Longevity Institute",
    quote: "Wedagedara beautifully marries ancient ancestral wisdom with modern refined luxury. Their elixirs have become our standard recommendation for natural cellular balance and vitality.",
    rating: 5
  }
];

// ========================================================
// TESTIMONIALS MANAGER CLASS (Dual-Stream Infinite Marquee)
// ========================================================
class TestimonialsManager {
  constructor(testimonials) {
    this.testimonials = testimonials;
    this.stream1 = document.getElementById('testimonials-stream-1');
    this.stream2 = document.getElementById('testimonials-stream-2');
    this.init();
  }

  init() {
    this.renderStreams();
    this.bindCardInteractions();
  }

  renderCardHTML(item) {
    const starsHTML = Array.from({ length: item.rating || 5 })
      .map(() => '<i class="fa-solid fa-star"></i>')
      .join('');

    return `
      <div class="testimonial-card group select-none">
        <div>
          <!-- 5-Star Rating -->
          <div class="testimonial-stars" aria-label="Rating: ${item.rating} out of 5 stars">
            ${starsHTML}
          </div>

          <!-- Testimonial Quote -->
          <p class="testimonial-quote">
            "${item.quote}"
          </p>
        </div>

        <!-- Customer Name & Title -->
        <div class="testimonial-author-wrap">
          <span class="testimonial-name">
            ${item.name}
          </span>
          <span class="testimonial-title">
            ${item.title}
          </span>
        </div>
      </div>
    `;
  }

  renderStreams() {
    if (!this.stream1 || !this.stream2) return;

    // Split into 2 streams
    const group1 = this.testimonials.slice(0, 4);
    const group2 = this.testimonials.slice(4, 8);

    // Duplicate each group 3 times to ensure infinite seamless loop
    const stream1Cards = [...group1, ...group1, ...group1]
      .map(item => this.renderCardHTML(item))
      .join('');

    const stream2Cards = [...group2, ...group2, ...group2]
      .map(item => this.renderCardHTML(item))
      .join('');

    this.stream1.innerHTML = stream1Cards;
    this.stream2.innerHTML = stream2Cards;
  }

  bindCardInteractions() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) return;

    const cards = document.querySelectorAll('.testimonial-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const percentX = (x - centerX) / centerX;
        const percentY = (y - centerY) / centerY;

        const rotateX = percentY * -6;
        const rotateY = percentX * 6;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale(1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)';
      });
    });
  }
}
