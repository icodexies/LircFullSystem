import { useEffect, useMemo, useState } from "react";
import { getBookImageUrl } from "../../services/catalog/bookValidation.js";
import { Spinner } from "../ui/Loading.jsx";
const defaultCover = `${import.meta.env.BASE_URL}images/catalog/book_cover.png`;

const OPEN_LIBRARY_COVERS = "https://covers.openlibrary.org/b";

// ISBNs the Open Library already had no cover for in this browser session.
// Remembering them avoids asking again every time the same book is opened.
const failedCoverIsbns = new Set();

function normalizeIsbn(isbn) {
  if (!isbn) return null;
  const clean = String(isbn)
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
  return clean.length === 10 || clean.length === 13 ? clean : null;
}

function isbnFromCoverUrl(url) {
  const prefix = `${OPEN_LIBRARY_COVERS}/isbn/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length).split("-")[0] || null;
}

export default function BookCover({ book, className = "", size = "M" }) {
  const sources = useMemo(() => {
    const list = [];
    const local = getBookImageUrl(book.book_image);
    if (local) list.push(local);
    const isbn = normalizeIsbn(book.isbn);
    // No ISBN at all (or an unusable one) means no Open Library request and
    // no console noise; an ISBN with no cover is remembered after one try.
    // (No "?default=false": that mode answers 404 for missing covers, which
    // browsers log as errors. Without it Open Library answers 200 with a 1x1
    // blank that we detect on load instead.)
    if (isbn && !failedCoverIsbns.has(isbn)) {
      list.push(`${OPEN_LIBRARY_COVERS}/isbn/${isbn}-${size}.jpg`);
    }
    list.push(defaultCover); // final fallback
    return list;
  }, [book.isbn, book.book_image, size]);

  const [failed, setFailed] = useState([]);
  // Which source finished loading. Until this matches the current src, the
  // image is still downloading (for example from the Open Library API), so
  // the spinner stays visible in its place.
  const [loadedSrc, setLoadedSrc] = useState(null);
  const src = sources.find((s) => !failed.includes(s));
  const loaded = src !== undefined && loadedSrc === src;

  // A cover that never answers (slow or blocked Open Library) must not hold
  // the spinner forever: after a short wait the next source takes over.
  useEffect(() => {
    if (!src || loaded) return;
    const timer = setTimeout(() => {
      setFailed((prev) => (prev.includes(src) ? prev : [...prev, src]));
    }, 8000);
    return () => clearTimeout(timer);
  }, [src, loaded]);

  function markFailed(failedSrc) {
    const isbn = isbnFromCoverUrl(failedSrc);
    if (isbn) failedCoverIsbns.add(isbn);
    setFailed((prev) =>
      prev.includes(failedSrc) ? prev : [...prev, failedSrc],
    );
  }

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#3B4A86]/10 bg-[#F0EDFA] ${className}`}
    >
      {src ? (
        <>
          {!loaded && (
            <div
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center text-[#3B4A86]"
            >
              <Spinner size={size === "L" ? "md" : "sm"} />
            </div>
          )}
          <img
            key={src}
            src={src}
            alt={`Cover of ${book.book_name}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={(event) => {
              // A 1x1 image means Open Library has no cover for this ISBN
              // (it answers 200 with a blank instead of 404). Treat it as a
              // miss so the next source takes over and this ISBN is skipped
              // for the rest of the session.
              if (event.currentTarget.naturalWidth <= 1) markFailed(src);
              else setLoadedSrc(src);
            }}
            onError={() => markFailed(src)}
            className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      ) : (
        <svg
          viewBox="0 0 48 56"
          className="h-12 w-10 text-[#3B4A86]/55"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M10 5h27v43H10a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z M10 5v43 M6 44h31 M16 15h15 M16 21h11 M16 35h7" />
        </svg>
      )}
    </div>
  );
}
