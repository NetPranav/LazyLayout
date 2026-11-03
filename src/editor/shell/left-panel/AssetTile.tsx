import React from "react";
import { Image as ImageIcon, Box, Type } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { AssetImage } from "./AssetImage";
import type { AssetItem } from "./types";

export interface AssetTileProps {
  asset: AssetItem;
  onClick?: (asset: AssetItem) => void;
  className?: string;
}

/**
 * Isolated AssetTile component for grid item rendering in the assets section.
 */
export const AssetTile: React.FC<AssetTileProps> = ({
  asset,
  onClick,
  className = "",
}) => {
  const renderThumb = () => {
    if (asset.thumbUrl) {
      return (
        <AssetImage
          src={asset.thumbUrl}
          alt={asset.name}
          className="ll:w-full ll:h-full ll:object-contain ll:rounded-sm"
        />
      );
    }
    if (asset.kind === "font") {
      return <Icon icon={Type} size={20} />;
    }
    if (asset.kind === "svg" || asset.kind === "image") {
      return <Icon icon={ImageIcon} size={20} />;
    }
    return <Icon icon={Box} size={20} />;
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-lazylayout-asset", asset.id);
      }}
      onClick={() => onClick?.(asset)}
      className={`ll-asset ll:group ll:flex ll:flex-col ll:gap-1.5 ll:min-w-0 ll:cursor-pointer ${className}`}
    >
      <div className="ll-th ll:aspect-square ll:grid ll:place-items-center ll:bg-surface-bar ll:border ll:border-border ll:group-hover:border-muted ll:rounded-sm ll:text-secondary ll:group-hover:text-primary ll:transition-colors ll:duration-swap ll:motion-reduce:transition-none">
        {renderThumb()}
      </div>
      <span className="ll:text-micro ll:text-muted ll:group-hover:text-primary ll:truncate">
        {asset.name}
      </span>
    </div>
  );
};
