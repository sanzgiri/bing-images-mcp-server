'use client';

import { Info, X } from 'lucide-react';
import { useState } from 'react';

interface ImageInfoProps {
  image: {
    title: string;
    description?: string | null;
    page_url: string;
  };
}

export default function ImageInfo({ image }: ImageInfoProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm text-white/80 border border-white/20 rounded-full px-3 py-1.5 hover:text-white hover:border-white/40 transition"
      >
        Show details
      </button>
    );
  }

  return (
    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-6 text-white transform transition-all hover:bg-black/40">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl md:text-3xl font-semibold mb-2 drop-shadow-md">
          {image.title}
        </h2>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-white/60 hover:text-white transition"
          aria-label="Hide image details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {image.description && (
        <p className="text-white/70 text-sm mb-3">{image.description}</p>
      )}
      <div className="flex items-center gap-2 text-white/60 text-sm">
        <Info className="w-4 h-4" />
        <span>
          <a
            href={image.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-white"
          >
            View on Peapix
          </a>
        </span>
      </div>
    </div>
  );
}
