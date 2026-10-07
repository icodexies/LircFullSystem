import { useAuth } from "../../context/useAuth";
import { useState } from "react";
import { MEMBER_BOOKS, MEMBER_STATS } from "../../data/memberHome";

// Placeholder design, we'll replace this later.
const card =
  "rounded-3xl border-2 border-[#0B1330] bg-white p-6 shadow-[6px_6px_0_#0B1330]";

export default function MemberHome() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const books = MEMBER_BOOKS.filter((book) =>
    book.title.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-serif text-4xl font-bold">
        Welcome back, {profile?.first_name ?? "Scholar"}!
      </h1>
      <p className="mt-1 text-sm text-[#0B1330]/60">
        Ready to jump back into your favorite stories?
      </p>

      <input
        type="search"
        aria-label="Search sample books"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search books, journals, digital sources..."
        className="mt-6 w-full rounded-xl border border-[#E4DDF5] bg-white px-4 py-3 text-sm focus:border-[#0B1330] focus:outline-none focus:ring-2 focus:ring-[#0B1330]/15"
      />

      <section className="mt-8 grid gap-5 sm:grid-cols-3">
        {MEMBER_STATS.map((s) => (
          <div key={s.id} className={card}>
            <p className="font-serif text-4xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#0B1330]/60">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-bold">Continue Reading</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {books.map((book) => (
            <div key={book.id} className={card}>
              <div className="mb-4 h-32 rounded-xl bg-[#E8EEFF]" />
              <p className="text-sm font-bold">{book.title}</p>
            </div>
          ))}
        </div>
        {books.length === 0 && <p role="status" className="mt-4 text-sm">No sample books match your search.</p>}
      </section>
    </main>
  );
}
