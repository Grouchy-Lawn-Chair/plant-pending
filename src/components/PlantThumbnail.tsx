// PlantThumbnail component - shows plant image or colored fallback

import { useState, useEffect } from 'react';
import { Plant } from '../types/plant';
import { getPlantImageUrl, getPlantCategoryColor, isImageLoaded, isImageFailed, markImageLoaded, markImageFailed } from '../utils/imageUtils';

interface PlantThumbnailProps {
  plant: Plant;
  size: number;
  showAbbreviation?: boolean;
  className?: string;
}

export function PlantThumbnail({ plant, size, showAbbreviation = true, className = '' }: PlantThumbnailProps) {
  const imageUrl = getPlantImageUrl(plant);
  const categoryColor = getPlantCategoryColor(plant);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoadedState] = useState(false);

  // Check if we already know this image failed
  const alreadyFailed = imageUrl ? isImageFailed(imageUrl) : false;
  const alreadyLoaded = imageUrl ? isImageLoaded(imageUrl) : false;

  // If no image or already known to fail, show fallback immediately
  const showFallback = !imageUrl || alreadyFailed || imageError;
  const showImage = imageUrl && !showFallback && (alreadyLoaded || imageLoaded);

  useEffect(() => {
    if (imageUrl && !alreadyFailed && !alreadyLoaded) {
      // Preload the image
      const img = new Image();
      img.onload = () => {
        markImageLoaded(imageUrl);
        setImageLoadedState(true);
      };
      img.onerror = () => {
        markImageFailed(imageUrl);
        setImageError(true);
      };
      img.src = imageUrl;
    }
  }, [imageUrl, alreadyFailed, alreadyLoaded]);

  // Fallback: colored circle with abbreviation
  if (showFallback) {
    return (
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: categoryColor,
          fontSize: size * 0.3,
        }}
        title={plant.commonName || plant.botanicalName}
      >
        {showAbbreviation && plant.abbreviation}
      </div>
    );
  }

  // Image with circular clip
  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: categoryColor,
      }}
      title={plant.greenAcresImageUrl ? `${plant.commonName || plant.botanicalName} (Green Acres image)` : (plant.commonName || plant.botanicalName)}
    >
      {/* Loading placeholder */}
      {!showImage && (
        <div
          className="absolute inset-0 flex items-center justify-center text-white font-bold"
          style={{ fontSize: size * 0.3 }}
        >
          {showAbbreviation && plant.abbreviation}
        </div>
      )}

      {/* Actual image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={plant.commonName || plant.botanicalName}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: showImage ? 1 : 0 }}
          onError={() => {
            markImageFailed(imageUrl);
            setImageError(true);
          }}
        />
      )}

      {/* Optional abbreviation overlay */}
      {showAbbreviation && showImage && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.3)',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          <span
            className="text-white font-bold"
            style={{ fontSize: size * 0.25 }}
          >
            {plant.abbreviation}
          </span>
        </div>
      )}
    </div>
  );
}
