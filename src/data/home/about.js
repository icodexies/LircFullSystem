// Single section settings and named photo slots use objects.
// TODO: replace this sample copy with the real history of LIRC.
export const ABOUT = {
  title: "About Us",
  historyTitle: "Our History",
  paragraphs: [
    "The Learning and Information Resource Center (LIRC) is the library of City College of Calamba. It began with a simple goal: give every student a place to read, research and learn.",
    "Over the years the collection has grown from printed books and journals to include digital resources, so students can study on campus or from home. Our librarians help you find what you need, from a course reading to a source for your thesis.",
    "Whether you come to borrow a book, join a quiet study hour or ask for research help, we want LIRC to feel like your space on campus. Come in and see what we have on the shelf and on your screen.",
  ],
  closing: { lines: ["Not Just", "Any Library"], script: "LIRC" },
};

// Photos are scaled to fill their frame, so any size works. `position` sets which
// part stays visible when the photo is cropped, for example "center top",
// "center 30%" or "left center". Files in /public are used by URL.
export const ABOUT_IMAGES = {
  arch: {
    src: "/images/home/CCC-Building-1200.webp",
    srcSet: "/images/home/CCC-Building-480.webp 480w, /images/home/CCC-Building-800.webp 800w, /images/home/CCC-Building-1200.webp 1200w",
    sizes: "(max-width: 640px) 88vw, 544px",
    width: 1200,
    height: 657,
    alt: "The LIRC library building",
    label: "Library building",
    hint: "Square photo, shown in an arch",
    position: "center",
  },
  history: {
    src: "/images/home/LibraryShelves-1200.webp",
    srcSet: "/images/home/LibraryShelves-480.webp 480w, /images/home/LibraryShelves-800.webp 800w, /images/home/LibraryShelves-1200.webp 1200w",
    sizes: "(max-width: 640px) 88vw, 180px",
    width: 1200,
    height: 675,
    alt: "Students reading in the library",
    label: "Students reading",
    hint: "Landscape, about 6:5",
    position: "center",
  },
  history2: {
    src: "/images/home/LibraryShelves2-1200.webp",
    srcSet: "/images/home/LibraryShelves2-480.webp 480w, /images/home/LibraryShelves2-800.webp 800w, /images/home/LibraryShelves2-1200.webp 1200w",
    sizes: "(max-width: 640px) 88vw, 180px",
    width: 1200,
    height: 1601,
    alt: "Library staff and students together",
    label: "Staff and students",
    hint: "Almost square, about 13:12",
    position: "center",
  },
  group: {
    src: "/images/home/LibrarySpace-1200.webp",
    srcSet: "/images/home/LibrarySpace-480.webp 480w, /images/home/LibrarySpace-800.webp 800w, /images/home/LibrarySpace-1200.webp 1200w",
    sizes: "(max-width: 640px) 88vw, 48vw",
    width: 1200,
    height: 900,
    alt: "Library staff and students together",
    label: "Staff and students",
    hint: "Almost square, about 13:12",
    position: "center",
  },
};
