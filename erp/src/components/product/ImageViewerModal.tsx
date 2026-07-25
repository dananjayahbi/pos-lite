'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageViewerModalProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function ImageViewerModal({
  open,
  onClose,
  images,
  currentIndex,
  onIndexChange,
}: ImageViewerModalProps) {
  const goNext = useCallback(() => {
    onIndexChange((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, onIndexChange]);

  const goPrev = useCallback(() => {
    onIndexChange((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, onIndexChange]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, goNext, goPrev]);

  if (!open || images.length === 0) return null;

  const src = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Close */}
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-pearl/10 p-2 text-pearl hover:bg-pearl/20 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          type="button"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-pearl/10 p-2 text-pearl hover:bg-pearl/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-h-[85vh] max-w-[85vw] overflow-hidden rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src ?? ''}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          width={900}
          height={900}
          className="block max-h-[85vh] max-w-[85vw] w-auto h-auto object-contain"
          priority
          unoptimized
        />

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-espresso/60 px-3 py-1 text-xs font-body text-pearl">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          type="button"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-pearl/10 p-2 text-pearl hover:bg-pearl/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`h-1.5 rounded-full transition-all ${
                i === currentIndex ? 'w-4 bg-pearl' : 'w-1.5 bg-pearl/40'
              }`}
              onClick={(e) => { e.stopPropagation(); onIndexChange(i); }}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
