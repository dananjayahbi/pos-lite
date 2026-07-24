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
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
          <CheckCircle size={24} className="text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-green-800 mb-1">Thank You!</h3>
        <p className="text-sm text-green-700 max-w-sm mx-auto">
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
          className="block text-sm font-medium text-[var(--site-primary,#0a0a0a)] mb-1.5"
        >
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--site-accent,#b4946e)] focus:ring-2 focus:ring-[var(--site-accent,#b4946e)]/20 outline-none transition-all duration-200"
          placeholder="Your name"
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--site-primary,#0a0a0a)] mb-1.5"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--site-accent,#b4946e)] focus:ring-2 focus:ring-[var(--site-accent,#b4946e)]/20 outline-none transition-all duration-200"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-[var(--site-primary,#0a0a0a)] mb-1.5"
        >
          Subject
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--site-accent,#b4946e)] focus:ring-2 focus:ring-[var(--site-accent,#b4946e)]/20 outline-none transition-all duration-200"
          placeholder="What is this about?"
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-[var(--site-primary,#0a0a0a)] mb-1.5"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--site-accent,#b4946e)] focus:ring-2 focus:ring-[var(--site-accent,#b4946e)]/20 outline-none transition-all duration-200 resize-none"
          placeholder="How can we help you?"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--site-primary,#0a0a0a)] py-3.5 text-sm font-medium uppercase tracking-wider text-white transition-all duration-200 hover:bg-[var(--site-accent,#b4946e)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
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
