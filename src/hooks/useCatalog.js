import { useEffect, useState } from "react";
import { getBooks, getCatalogLookups } from "../services/bookService";
import { INITIAL_CATALOG_QUERY } from "../services/catalogQuery.js";

export function useCatalog() {
  const [query, setQuery] = useState(INITIAL_CATALOG_QUERY);
  const [searchInput, setSearchInput] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: "", books: [], hasNext: false, error: "" });
  const [lookups, setLookups] = useState({ formats: [], shelves: [], loading: true, error: "" });
  const key = JSON.stringify({ ...query, revision });

  useEffect(() => {
    if (searchInput === query.search) return;
    const timer = setTimeout(() => {
      setQuery((current) => ({ ...current, search: searchInput, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, query.search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getBooks(query, controller.signal)
      .then((data) => {
        if (!active) return;
        if (data.books.length === 0 && query.page > 1) {
          setQuery((current) => ({ ...current, page: 1 }));
          return;
        }
        setResult({ key, ...data, error: "" });
      })
      .catch((error) => {
        if (active)
          setResult({
            key,
            books: [],
            hasNext: false,
            error: error.message || "Couldn't load the catalog.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, key]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getCatalogLookups(controller.signal)
      .then((data) => {
        if (active) setLookups({ ...data, loading: false, error: "" });
      })
      .catch(() => {
        if (active)
          setLookups({
            formats: [],
            shelves: [],
            loading: false,
            error: "Couldn't load format and section filters. Refresh to retry.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);

  function changeQuery(changes) {
    setQuery((current) => {
      if (Object.entries(changes).every(([field, value]) => current[field] === value))
        return current;
      return { ...current, ...changes };
    });
  }

  function changeFilter(field, value) {
    changeQuery({ [field]: value, page: 1 });
  }

  function clearFilters() {
    setSearchInput("");
    changeQuery(INITIAL_CATALOG_QUERY);
  }

  const loading = result.key !== key;
  return {
    query,
    searchInput,
    setSearchInput,
    changeFilter,
    clearFilters,
    lookups,
    applyFilters: (filters) => changeQuery({ ...filters, page: 1 }),
    refresh: () => setRevision((value) => value + 1),
    setPage: (page) => changeQuery({ page }),
    loading,
    searching: searchInput !== query.search,
    books: loading ? [] : result.books,
    hasNext: !loading && result.hasNext,
    error: loading ? "" : result.error,
  };
}
