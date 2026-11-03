import React from "react";

export interface AssetImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Standard image wrapper for assets enforcing lazy loading, async decoding, and alt text.
 */
export const AssetImage: React.FC<AssetImageProps> = ({
  src,
  alt,
  className = "",
  ...props
}) => {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      {...props}
    />
  );
};
