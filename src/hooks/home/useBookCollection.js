import { useEffect, useState } from "react";
import { BOOKS, BOOK_TABS } from "../../data/home/bookCollection.js";
import { getHomeCollection } from "../../services/home/homeCollectionService.js";
import { useCarousel } from "../shared/useCarousel.js";

const SHOWN = 12;
const OPEN_LIBRARY_COVERS = "https://covers.openlibrary.org/b";

// Gradient pairs for books the catalog has no image for (same look as the
// old samples). Assigned in order so neighbours differ.
const PLACEHOLDER_COLORS = [
  ["#3a5bd9", "#1b0f4a"],
  ["#2f6f6a", "#0f1f2e"],
  ["#9d3d5c", "#33152b"],
  ["#b8873a", "#3b2410"],
  ["#6b4a8f", "#1b1233"],
  ["#2ea77f", "#6a2b86"],
];

function normalizeIsbn(isbn) {
  if (!isbn) return null;
  const clean = String(isbn).replace(/[^0-9Xx]/g, "").toUpperCase();
  return clean.length === 10 || clean.length === 13 ? clean : null;
}

// Ask the Open Library covers API whether this ISBN has a cover. The answer
// is the image itself (43 bytes = the 1x1 blank it returns for a miss), and
// the browser keeps it cached for the real <img> that follows. Each probe is
// bounded so one slow answer never holds the section back.
async function probeCover(row, signal) {
  if (row.cover) return true;
  const isbn = normalizeIsbn(row.isbn);
  if (!isbn) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2000);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  try {
    const response = await fetch(
      `${OPEN_LIBRARY_COVERS}/isbn/${isbn}-L.jpg`,
      { signal: controller.signal },
    );
    const blob = await response.blob();
    return blob.size > 1000;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

// Probe in small batches so a slow API never floods the page; after the
// budget runs out the remaining candidates simply fall back to the gradient
// placeholder covers.
async function orderByCover(rows, signal) {
  const withCover = [];
  const without = [];
  const deadline = Date.now() + 4000;
  for (let index = 0; index < rows.length; index += 4) {
    const batch = rows.slice(index, index + 4);
    if (Date.now() > deadline) {
      without.push(...batch);
      continue;
    }
    const results = await Promise.all(
      batch.map((row) => probeCover(row, signal)),
    );
    batch.forEach((row, offset) => {
      (results[offset] ? withCover : without).push(row);
    });
  }
  return [...withCover, ...without].slice(0, SHOWN);
}

function describe(row) {
  const published = [
    row.publish_year ? `Published ${row.publish_year}` : null,
    row.publisher ? `by ${row.publisher}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const edition = row.edition ? `${row.edition} edition.` : "";
  const text = [published ? `${published}.` : "", edition]
    .filter(Boolean)
    .join(" ");
  return (
    text ||
    "A title from the library's collection — borrow it at the circulation desk."
  );
}

function availability(row) {
  if (!Number(row.copies))
    return "No copies on record yet — ask the librarian about this title.";
  const copies = `${row.available} of ${row.copies} ${
    Number(row.copies) === 1 ? "copy" : "copies"
  } available`;
  return row.call_number ? `${copies} · ${row.call_number}` : copies;
}

// One database row in the shape the home panels already use.
function mapRow(row, index) {
  return {
    id: `db-${row.id}`,
    title: row.title,
    author: row.author || "Author not recorded",
    genre: row.section || "General Circulation Section",
    colors: PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length],
    rating: null,
    cover: row.cover || null,
    isbn: row.isbn || null,
    description: describe(row),
    info: availability(row),
  };
}

export function useBookCollection() {
  const [tab, setTab] = useState(BOOK_TABS[0].id);
  const [genre, setGenre] = useState("All");
  const [catalog, setCatalog] = useState({
    loading: true,
    error: "",
    books: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getHomeCollection(controller.signal)
      .then((rows) => orderByCover(rows, controller.signal))
      .then((rows) => {
        if (active)
          setCatalog({
            loading: false,
            error: "",
            books: rows.map(mapRow),
          });
      })
      .catch((problem) => {
        if (!active) return;
        if (
          problem?.name === "AbortError" ||
          /abort/i.test(String(problem?.message ?? ""))
        )
          return;
        setCatalog({
          loading: false,
          error: problem?.message || "The book collection could not be loaded.",
          books: [],
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Physical books come from the catalog; e-books are still the sample set
  // until an e-book collection exists in the database.
  const books =
    tab === "physical"
      ? catalog.books
      : BOOKS.filter((book) => book.format === "ebook");
  const carousel = useCarousel(books);

  const genres = ["All", ...new Set(books.map((book) => book.genre))];
  const genreBooks =
    genre === "All" ? books : books.filter((book) => book.genre === genre);

  function changeTab(id) {
    if (!BOOK_TABS.some((entry) => entry.id === id)) return;
    setTab(id);
    setGenre("All");
    carousel.setActive(0);
  }

  return {
    tab,
    changeTab,
    books,
    genres,
    genre,
    setGenre,
    genreBooks,
    selected: carousel.selected,
    activeIndex: carousel.activeIndex,
    select: carousel.select,
    step: carousel.step,
    loading: tab === "physical" && catalog.loading,
    error: tab === "physical" ? catalog.error : "",
    browseLabel: tab === "physical" ? "Browse by section" : "Browse by genre",
  };
}
