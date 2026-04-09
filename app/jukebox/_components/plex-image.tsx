"use client";

import React, { useState } from 'react';
import { Music2 } from 'lucide-react';

interface PlexImageProps {
  thumb: string | null | undefined;
  alt: string;
  className?: string;
  size?: number;
}

export default function PlexImage({ thumb, alt, className = '', size = 600 }: PlexImageProps) {
  const [error, setError] = useState(false);

  if (!thumb || error) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-secondary ${className}`}>
        <Music2 className="w-1/3 h-1/3 text-muted-foreground/30" />
      </div>
    );
  }

  const src = `/api/plex/image?thumb=${encodeURIComponent(thumb)}&w=${size}&h=${size}`;

  return (
    <img
      src={src}
      alt={alt ?? 'Cover art'}
      className={`w-full h-full object-cover ${className}`}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
