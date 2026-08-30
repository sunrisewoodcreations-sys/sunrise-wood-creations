"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

export type CarouselSlide = {
  // null = a real photo hasn't been added for this slide yet. Shows the
  // same honest "Photo coming soon" treatment already used on the
  // product cards below — never a stock or invented image.
  src: string | null;
  alt: string;
};

const AUTOPLAY_MS = 4500;
const SWIPE_THRESHOLD_PX = 50;

export default function HeroCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  // Each real photo's own width/height ratio, captured once it loads —
  // lets the box size itself to match whichever slide is showing,
  // instead of forcing every photo into one fixed shape. Falls back to
  // 16:9 for the placeholder state and for the brief moment before a
  // photo has finished loading.
  const [ratios, setRatios] = useState<Record<number, number>>({});

  const goTo = useCallback((i: number) => {
    setIndex(((i % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  // Autoplay — cleanly paused whenever the user is actively interacting
  // (hover on desktop, touch on mobile), and resumes on its own once
  // they stop, rather than staying paused forever.
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > SWIPE_THRESHOLD_PX) goTo(index - 1);
    else if (delta < -SWIPE_THRESHOLD_PX) goTo(index + 1);
    touchStartX.current = null;
    setPaused(false);
  }

  if (slides.length === 0) return null;

  return (
    <div
      className="relative w-full max-w-3xl mx-auto mb-8 sm:mb-10 rounded-xl overflow-hidden shadow-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* The box's own shape now matches whichever photo is showing
          (via the ratios captured on load below) — so there's no
          leftover strip of background around any photo. It resizes
          as you move between photos of different shapes, the same
          way many real photo carousels already behave. */}
      <div className="relative bg-sawdust" style={{ aspectRatio: ratios[index] ?? 16 / 9 }}>
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="relative w-full h-full flex-shrink-0">
              {slide.src ? (
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-contain"
                  priority={i === 0}
                  onLoad={e => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setRatios(r => ({ ...r, [i]: img.naturalWidth / img.naturalHeight }));
                    }
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-walnut/30 gap-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <path d="M21 15l-4.5-4.5a2 2 0 0 0-2.8 0L5 19" />
                  </svg>
                  <span className="text-xs font-medium">Photo coming soon</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          {/* Desktop-only arrows — mobile relies on swipe instead, per spec */}
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Previous slide"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-walnut items-center justify-center shadow hover:bg-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Next slide"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-walnut items-center justify-center shadow hover:bg-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
