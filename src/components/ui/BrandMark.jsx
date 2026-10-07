export default function BrandMark({ className = "", imageClassName = "", alt = "LIRC logo" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${className}`}>
      <img
        src="/LIRC_LOGO.svg"
        width="1270"
        height="1270"
        alt={alt}
        className={`h-full w-full object-contain p-0.5 ${imageClassName}`}
      />
    </span>
  );
}
