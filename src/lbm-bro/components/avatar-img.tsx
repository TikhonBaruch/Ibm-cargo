"use client";

import { useState } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

/** Avatar with gradient fallback when the SVG asset fails to load. */
export function AvatarImg({ src, alt = "", className = "" }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={["avatar-fallback", className].filter(Boolean).join(" ")}
        role="img"
        aria-label={alt || "User"}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
