'use client';

import React, { useState } from 'react';

/**
 * Simple contact form. Submissions are handled client-side
 * (no backend endpoint configured — shows a success message).
 */
export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Wire up to an API endpoint when available.
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-green-800 font-medium">Thank you!</p>
        <p className="text-green-700 text-sm mt-1">
          Your message has been received. We&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-colors"
          placeholder="Your name"
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-colors"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-colors resize-none"
          placeholder="How can we help?"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded bg-black py-3 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
      >
        Send Message
      </button>
    </form>
  );
}
