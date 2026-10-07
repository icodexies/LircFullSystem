// A collection is an array of objects with a stable id.
export const HERO_SLIDES = [
  {
    id: "collections",
    tag: "Collections",
    title: "Books & Collections",
    description:
      "Explore thousands of titles across every course and subject. Search the catalog, check availability, and reserve what you need before you even walk in.",
    background: "/BG-Image/BG1-1200.webp",
    backgroundSrcSet: "/BG-Image/BG1-480.webp 480w, /BG-Image/BG1-800.webp 800w, /BG-Image/BG1-1200.webp 1200w",
    backgroundWidth: 1200,
    backgroundHeight: 900,
    thumbnail: "/Thumbnails/thumbnail1-480.webp",
    thumbnailSrcSet: "/Thumbnails/thumbnail1-320.webp 320w, /Thumbnails/thumbnail1-480.webp 480w",
    thumbnailSizes: "(max-width: 639px) 112px, 240px",
    thumbnailWidth: 480,
    thumbnailHeight: 586,
    cta: "Browse Catalog",
    to: "/#collection",
    secondary: {
      label: "New Arrivals",
      to: "/#collection",
    },
    stat: {
      value: "25,000+",
      label: "Titles available",
    },
  },

  {
    id: "study",
    tag: "Study Spaces",
    title: "Quiet Study Spaces",
    description:
      "Comfortable reading halls and group study areas designed for focus. Find a spot that fits the way you learn, whether solo or with classmates.",
    background: "/BG-Image/BG2.webp",
    backgroundSrcSet: null,
    backgroundWidth: null,
    backgroundHeight: null,
    thumbnail: "/Thumbnails/thumbnail2-480.webp",
    thumbnailSrcSet: "/Thumbnails/thumbnail2-320.webp 320w, /Thumbnails/thumbnail2-480.webp 480w",
    thumbnailSizes: "(max-width: 639px) 112px, 240px",
    thumbnailWidth: 480,
    thumbnailHeight: 640,
    cta: "Visit the Library",
    to: "/#about",
    secondary: {
      label: "Library Hours",
      to: "/#about",
    },
    stat: {
      value: "150 seats",
      label: "Reading areas",
    },
  },

  {
    id: "digital",
    tag: "E-Resources",
    title: "Digital Library",
    description:
      "Access e-books, journals, and online databases from anywhere on campus or at home. Your research doesn't stop when the doors close.",
    background: "/BG-Image/BG3.webp",
    backgroundSrcSet: null,
    backgroundWidth: null,
    backgroundHeight: null,
    thumbnail: "/Thumbnails/thumbnail3-480.webp",
    thumbnailSrcSet: "/Thumbnails/thumbnail3-320.webp 320w, /Thumbnails/thumbnail3-480.webp 480w",
    thumbnailSizes: "(max-width: 639px) 112px, 240px",
    thumbnailWidth: 480,
    thumbnailHeight: 312,
    cta: "Access E-Books",
    to: "/#digital-sources",
    secondary: {
      label: "Databases",
      to: "/#digital-sources",
    },
    stat: {
      value: "120+",
      label: "Online databases",
    },
  },

  {
    id: "research",
    tag: "Research",
    title: "Theses & Research",
    description:
      "Browse student theses and research outputs from City College of Calamba. A great starting point for your own study and references.",
    background: "/BG-Image/BG4.webp",
    backgroundSrcSet: null,
    backgroundWidth: null,
    backgroundHeight: null,
    thumbnail: "/Thumbnails/thumbnail4-480.webp",
    thumbnailSrcSet: "/Thumbnails/thumbnail4-320.webp 320w, /Thumbnails/thumbnail4-480.webp 480w",
    thumbnailSizes: "(max-width: 639px) 112px, 240px",
    thumbnailWidth: 480,
    thumbnailHeight: 720,
    cta: "Explore Research",
    to: "/#collection",
    secondary: {
      label: "Submit a Thesis",
      to: null,
    },
    stat: {
      value: "1,200+",
      label: "Student theses",
    },
  },
];
