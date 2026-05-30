/**
 * Image optimization utilities for Core Web Vitals
 */

export const imageSizes = {
  logo: '40px',
  icon: '16px',
  thumbnail: '120px',
  card: '280px',
  hero: '1200px',
  fullWidth: '100vw',
};

/**
 * Generate responsive image srcset for different device sizes
 */
export function generateSrcSet(basePath, sizes = [480, 768, 1024, 1280]) {
  return sizes
    .map(size => `${basePath}?w=${size} ${size}w`)
    .join(', ');
}

/**
 * Get optimized image dimensions to prevent layout shift
 */
export function getImageDimensions(width, height, maxWidth = 1200) {
  if (!width || !height) return { width: undefined, height: undefined };

  const aspectRatio = height / width;
  const constrainedWidth = Math.min(width, maxWidth);
  const constrainedHeight = constrainedWidth * aspectRatio;

  return {
    width: constrainedWidth,
    height: constrainedHeight,
  };
}
