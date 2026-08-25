"use client";

import { useState } from "react";
import { isOrderPlaceholder, ORDER_PLACEHOLDER, resolveOrderImage } from "@/lbm-bro/lib/docs";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
};

export function OrderCover({ src, alt = "", className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const url = failed ? ORDER_PLACEHOLDER : resolveOrderImage(src);
  const placeholder = isOrderPlaceholder(url) || failed;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={[className, placeholder ? "order-cover-placeholder" : ""].filter(Boolean).join(" ")}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
