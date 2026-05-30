export function OptimizedImage({
  src,
  alt,
  sizes = 'auto',
  loading = 'lazy',
  width,
  height,
  className
}) {
  return (
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      loading={loading}
      width={width}
      height={height}
      className={className}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}
