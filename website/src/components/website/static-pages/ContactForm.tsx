'use client';

import React, { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';

/**
 * Modern contact form component.
 * Submissions are handled client-side with a success state.
 */
export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Simulate submission with a brief delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    // TODO: Wire up to an API endpoint when available.
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#97c93e]/30 bg-[#082017]/70 p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#97c93e]/15 mb-4">
          <CheckCircle size={24} className="text-[#97c93e]" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Thank You!</h3>
        <p className="text-sm text-[#cbd5e1] max-w-sm mx-auto">
          Your message has been received. We&apos;ll get back to you as soon as possible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-white mb-1.5"
        >
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="w-full rounded-lg border border-white/12 bg-[#051610] px-4 py-3 text-sm text-white placeholder:text-[#64748b] focus:border-[#97c93e] focus:ring-2 focus:ring-[#97c93e]/20 outline-none transition-all duration-200"
          placeholder="Your name"
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-white mb-1.5"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full rounded-lg border border-white/12 bg-[#051610] px-4 py-3 text-sm text-white placeholder:text-[#64748b] focus:border-[#97c93e] focus:ring-2 focus:ring-[#97c93e]/20 outline-none transition-all duration-200"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-white mb-1.5"
        >
          Subject
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          className="w-full rounded-lg border border-white/12 bg-[#051610] px-4 py-3 text-sm text-white placeholder:text-[#64748b] focus:border-[#97c93e] focus:ring-2 focus:ring-[#97c93e]/20 outline-none transition-all duration-200"
          placeholder="What is this about?"
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-white mb-1.5"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="w-full rounded-lg border border-white/12 bg-[#051610] px-4 py-3 text-sm text-white placeholder:text-[#64748b] focus:border-[#97c93e] focus:ring-2 focus:ring-[#97c93e]/20 outline-none transition-all duration-200 resize-none"
          placeholder="How can we help you?"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[#97c93e] py-3.5 text-sm font-semibold uppercase tracking-wider text-[#051610] transition-all duration-200 hover:bg-[#b2db58] hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(151,201,62,0.3)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-[#051610]/30 border-t-[#051610] rounded-full" />
            Sending...
          </>
        ) : (
          <>
            <Send size={16} />
            Send Message
          </>
        )}
      </button>
    </form>
  );
}
