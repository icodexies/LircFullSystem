// Placeholder data. Swap with your API response later, keep the same shape.
// `cover` is optional: set an image URL to use a real cover, otherwise a
// gradient cover is generated from `colors`.

const book = (id, title, author, genre, colors, rating, description, info) => ({
  id,
  title,
  author,
  genre,
  colors,
  rating,
  description,
  info,
  cover: null,
});

export const TABS = [
  { id: "physical", label: "Physical books" },
  { id: "ebook", label: "E-books" },
];

export const BOOKS = {
  physical: [
    book("p1", "Pride and Prejudice", "Jane Austen", "Romance", ["#9d3d5c", "#33152b"], 4.8,
      "Elizabeth Bennet navigates family pressure, first impressions, and a proud suitor who may not be what he seems.",
      "3 of 4 copies available, shelf A2"),
    book("p2", "Frankenstein", "Mary Shelley", "Gothic", ["#2f6f6a", "#0f1f2e"], 4.4,
      "A young scientist brings life to a creature he cannot bring himself to care for, and both pay the price.",
      "2 of 3 copies available, shelf B1"),
    book("p3", "The Time Machine", "H. G. Wells", "Sci-Fi", ["#3a5bd9", "#1b0f4a"], 4.3,
      "An inventor travels to the year 802,701 and finds a future far stranger than he planned for.",
      "1 of 2 copies available, shelf C3"),
    book("p4", "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", "Mystery", ["#b8873a", "#3b2410"], 4.7,
      "Twelve short cases where Holmes and Watson solve puzzles with observation and sharp deduction.",
      "4 of 5 copies available, shelf D2"),
    book("p5", "Alice's Adventures in Wonderland", "Lewis Carroll", "Fantasy", ["#d65a8f", "#4b2a7a"], 4.5,
      "Alice follows a white rabbit down a hole and lands in a world where logic keeps changing the rules.",
      "2 of 2 copies available, shelf E1"),
    book("p6", "Dracula", "Bram Stoker", "Gothic", ["#a4262c", "#1a0a0d"], 4.4,
      "Told through letters and diary entries, a group of friends tries to stop a count who has come to England.",
      "0 of 2 copies available, shelf B2"),
    book("p7", "Treasure Island", "Robert Louis Stevenson", "Adventure", ["#e08a2e", "#12455a"], 4.5,
      "Young Jim Hawkins finds a treasure map and sails out with pirates he cannot fully trust.",
      "3 of 3 copies available, shelf F1"),
  ],
  ebook: [
    book("e1", "Jane Eyre", "Charlotte Brontë", "Romance", ["#6b4a8f", "#1b1233"], 4.7,
      "An orphaned governess takes a post at Thornfield Hall and uncovers a secret that tests her principles.",
      "EPUB and PDF, read online"),
    book("e2", "The War of the Worlds", "H. G. Wells", "Sci-Fi", ["#c7512d", "#1c1630"], 4.3,
      "Martian cylinders land in southern England, and humanity discovers it is not at the top of the food chain.",
      "EPUB and PDF, read online"),
    book("e3", "The Hound of the Baskervilles", "Arthur Conan Doyle", "Mystery", ["#4d7c5a", "#0e1d1a"], 4.6,
      "Holmes investigates a family curse and a spectral hound loose on the moors of Devon.",
      "EPUB and PDF, read online"),
    book("e4", "The Wonderful Wizard of Oz", "L. Frank Baum", "Fantasy", ["#2ea77f", "#6a2b86"], 4.4,
      "A tornado carries Dorothy to Oz, where she must reach the Emerald City to find her way home.",
      "EPUB and PDF, read online"),
    book("e5", "The Picture of Dorian Gray", "Oscar Wilde", "Gothic", ["#8a6d1f", "#1f1424"], 4.5,
      "A beautiful young man stays unchanged while a hidden portrait records every choice he makes.",
      "EPUB and PDF, read online"),
    book("e6", "Twenty Thousand Leagues Under the Seas", "Jules Verne", "Adventure", ["#1f7fa8", "#08203a"], 4.4,
      "Professor Aronnax joins Captain Nemo aboard the Nautilus for a journey across the world's oceans.",
      "EPUB and PDF, read online"),
    book("e7", "Persuasion", "Jane Austen", "Romance", ["#c07a5a", "#3a1e2b"], 4.5,
      "Anne Elliot gets a second chance with the man she was persuaded to refuse eight years ago.",
      "EPUB and PDF, read online"),
  ],
};