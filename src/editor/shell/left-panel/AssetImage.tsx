import React from "react";
import Image, { type ImageProps } from "next/image";

export interface AssetImageProps extends Omit<ImageProps, "src" | "alt"> {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Standard image wrapper for assets enforcing lazy loading, async decoding, and alt text.
 * Uses Next.js Image with `unoptimized` to cleanly support data URLs, blob URLs, and custom asset thumbnails
 * without triggering Next.js lint warnings or requiring remote image domain configuration.
 */
export const AssetImage: React.FC<AssetImageProps> = ({
  src,
  alt,
  className = "",
  width,
  height,
  ...props
}) => {
  return (
    <Image
      src={src}
      alt={alt}
      width={typeof width === "number" ? width : 128}
      height={typeof height === "number" ? height : 128}
      unoptimized
      className={className}
      {...props}
    />
  );
};
