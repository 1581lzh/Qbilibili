"use client";

import { useState } from "react";

interface CommentImagesProps {
  images: string[];
  onImageClick: (index: number) => void;
}

export default function CommentImages({ images, onImageClick }: CommentImagesProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div
        className="group relative mt-2 inline-block cursor-pointer overflow-hidden rounded-lg"
        style={{ maxWidth: 280, aspectRatio: "4/3" }}
        onClick={() => onImageClick(0)}
      >
        <img
          src={images[0]}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-opacity duration-200 group-hover:bg-black/40">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
      </div>
    );
  }

  const MOBILE_MAX_VISIBLE = 3;
  const mobileOverflow = images.length > MOBILE_MAX_VISIBLE;
  const mobileOverflowCount = images.length - MOBILE_MAX_VISIBLE;

  return (
    <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-4">
      {images.map((src, i) => {
        const isLastMobileVisible = mobileOverflow && i === MOBILE_MAX_VISIBLE - 1;
        return (
          <div
            key={i}
            className={`group relative cursor-pointer overflow-hidden rounded-md ${i >= MOBILE_MAX_VISIBLE ? 'hidden sm:block' : ''}`}
            style={{ aspectRatio: "1/1" }}
            onClick={() => onImageClick(i)}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {hoveredIndex === i && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-white"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
            )}
            {isLastMobileVisible && (
              <div className="absolute bottom-0 right-0 flex items-center justify-center rounded-tl-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white sm:hidden">
                +{mobileOverflowCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
