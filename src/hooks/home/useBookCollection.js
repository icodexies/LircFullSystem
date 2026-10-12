import { useState } from "react";
import { BOOKS, BOOK_TABS } from "../../data/home/bookCollection.js";
import { useCarousel } from "../shared/useCarousel.js";

export function useBookCollection() {
  const [tab, setTab] = useState(BOOK_TABS[0].id);
  const [genre, setGenre] = useState("All");
  const books = BOOKS.filter((book) => book.format === tab);
  const carousel = useCarousel(books);

  // This small sample does not need memoization. Future catalog pages should
  // ask the database for a page of filtered books rather than download all rows.
  const genres = ["All", ...new Set(books.map((book) => book.genre))];
  const genreBooks = genre === "All"
    ? books
    : books.filter((book) => book.genre === genre);

  function changeTab(id) {
    if (!BOOK_TABS.some((tab) => tab.id === id)) return;
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
  };
}
