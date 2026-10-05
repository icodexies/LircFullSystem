import { useMemo, useState } from "react";
import { BOOKS, TABS } from "../data/bookCollection";

export function useBookCollection() {
  const [tab, setTab] = useState(TABS[0].id);
  const [genre, setGenre] = useState("All");
  const [selectedId, setSelectedId] = useState(BOOKS[TABS[0].id][0].id);

  const books = BOOKS[tab];

  const genres = useMemo(
    () => ["All", ...new Set(books.map((b) => b.genre))],
    [books]
  );

  const genreBooks = useMemo(
    () => (genre === "All" ? books : books.filter((b) => b.genre === genre)),
    [books, genre]
  );

  const activeIndex = Math.max(0, books.findIndex((b) => b.id === selectedId));
  const selected = books[activeIndex];

  // Switching tabs resets the genre filter and selects the first book of that tab
  const changeTab = (id) => {
    setTab(id);
    setGenre("All");
    setSelectedId(BOOKS[id][0].id);
  };

  // Carousel arrows, wraps around
  const step = (dir) => {
    const next = (activeIndex + dir + books.length) % books.length;
    setSelectedId(books[next].id);
  };

  return {
    tab,
    changeTab,
    books,
    genres,
    genre,
    setGenre,
    genreBooks,
    selected,
    activeIndex,
    select: setSelectedId,
    step,
  };
}