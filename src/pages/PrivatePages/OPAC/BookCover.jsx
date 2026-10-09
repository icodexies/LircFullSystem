import { useMemo, useState } from "react";
import { getBookImageUrl } from "../../../services/bookValidation.js";
const defaultCover = `${import.meta.env.BASE_URL}book_cover.png`;

const OPEN_LIBRARY_COVERS = "https://covers.openlibrary.org/b";

function normalizeIsbn(isbn) {
  if (!isbn) return null;
  const clean = String(isbn)
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
  return clean.length === 10 || clean.length === 13 ? clean : null;
}

export default function BookCover({ book, className = "", size = "M" }) {
  const sources = useMemo(() => {
    const list = [];
    const local = getBookImageUrl(book.book_image);
    if (local) list.push(local);
    const isbn = normalizeIsbn(book.isbn);
    if (isbn) {
      list.push(
        `${OPEN_LIBRARY_COVERS}/isbn/${isbn}-${size}.jpg?default=false`,
      );
    }
    list.push(defaultCover); // final fallback
    return list;
  }, [book.isbn, book.book_image, size]);

  const [failed, setFailed] = useState([]);
  const src = sources.find((s) => !failed.includes(s));

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#3B4A86]/10 bg-[#F0EDFA] ${className}`}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={`Cover of ${book.book_name}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed((prev) => [...prev, src])}
          className="h-full w-full object-contain"
        />
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
