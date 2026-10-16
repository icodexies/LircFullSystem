// Collection tabs and the e-book samples. The physical tab now reads the
// real catalog through lirc_home_collection (see useBookCollection); e-books
// stay samples until an e-book collection exists in the database.
//
// Keep the same book fields when replacing samples with database rows:
// cover is optional; colors provide the placeholder gradient.

export const BOOK_TABS = [
  {
    id: "physical",
    label: "Physical books"
  },
  {
    id: "ebook",
    label: "E-books"
  }
];

export const BOOKS = [
  {
    id: "e1",
    format: "ebook",
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    genre: "Romance",
    colors: [
      "#6b4a8f",
      "#1b1233"
    ],
    rating: 4.7,
    description: "An orphaned governess takes a post at Thornfield Hall and uncovers a secret that tests her principles.",
    info: "EPUB and PDF, read online",
    cover: null
  },
  {
    id: "e2",
    format: "ebook",
    title: "The War of the Worlds",
    author: "H. G. Wells",
    genre: "Sci-Fi",
    colors: [
      "#c7512d",
      "#1c1630"
    ],
    rating: 4.3,
    description: "Martian cylinders land in southern England, and humanity discovers it is not at the top of the food chain.",
    info: "EPUB and PDF, read online",
    cover: null
  },
  {
    id: "e3",
    format: "ebook",
    title: "The Hound of the Baskervilles",
    author: "Arthur Conan Doyle",
    genre: "Mystery",
    colors: [
      "#4d7c5a",
      "#0e1d1a"
    ],
    rating: 4.6,
    description: "Holmes investigates a family curse and a spectral hound loose on the moors of Devon.",
    info: "EPUB and PDF, read online",
    cover: null
  },
  {
    id: "e4",
    format: "ebook",
    title: "The Wonderful Wizard of Oz",
    author: "L. Frank Baum",
    genre: "Fantasy",
    colors: [
      "#2ea77f",
      "#6a2b86"
    ],
    rating: 4.4,
    description: "A tornado carries Dorothy to Oz, where she must reach the Emerald City to find her way home.",
    info: "EPUB and PDF, read online",
    cover: null
  },
  {
    id: "e5",
    format: "ebook",
    title: "The Picture of Dorian Gray",
    author: "Oscar Wilde",
    genre: "Gothic",
    colors: [
      "#8a6d1f",
      "#1f1424"
    ],
    rating: 4.5,
    description: "A beautiful young man stays unchanged while a hidden portrait records every choice he makes.",
    info: "EPUB and PDF, read online",
    cover: null
  },
  {
    id: "e6",
    format: "ebook",
    title: "Twenty Thousand Leagues Under the Seas",
    author: "Jules Verne",
    genre: "Adventure",
    colors: [
      "#1f7fa8",
      "#08203a"
    ],
    rating: 4.4,
    description: "Professor Aronnax joins Captain Nemo aboard the Nautilus for a journey across the world's oceans.",
    info: "EPUB and PDF, read online",
    cover: null
  },
  {
    id: "e7",
    format: "ebook",
    title: "Persuasion",
    author: "Jane Austen",
    genre: "Romance",
    colors: [
      "#c07a5a",
      "#3a1e2b"
    ],
    rating: 4.5,
    description: "Anne Elliot gets a second chance with the man she was persuaded to refuse eight years ago.",
    info: "EPUB and PDF, read online",
    cover: null
  }
];
