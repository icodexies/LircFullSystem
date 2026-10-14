// Profile image assets. The fallback shows until a photo or preset is
// chosen; preset files live in public/images/profiles/.
export const FALLBACK_AVATAR = `${import.meta.env.BASE_URL}images/profiles/default.jpg`;

export const PROFILE_AVATAR_OPTIONS = [
  {
    id: "cap",
    label: "Blue cap",
    src: `${import.meta.env.BASE_URL}images/profiles/option-cap.jpg`,
  },
  {
    id: "bear",
    label: "Blue bear",
    src: `${import.meta.env.BASE_URL}images/profiles/option-bear.jpg`,
  },
  {
    id: "capybara",
    label: "Capybara",
    src: `${import.meta.env.BASE_URL}images/profiles/option-capybara.jpg`,
  },
  {
    id: "dog",
    label: "Glasses dog",
    src: `${import.meta.env.BASE_URL}images/profiles/option-dog.jpg`,
  },
  {
    id: "cat",
    label: "Smiling cat",
    src: `${import.meta.env.BASE_URL}images/profiles/option-cat.jpg`,
  },
  {
    id: "creature",
    label: "Green eyes",
    src: `${import.meta.env.BASE_URL}images/profiles/option-creature.jpg`,
  },
  {
    id: "girl",
    label: "Sunglasses girl",
    src: `${import.meta.env.BASE_URL}images/profiles/option-girl.jpg`,
  },
  {
    id: "alpaca",
    label: "Comic alpaca",
    src: `${import.meta.env.BASE_URL}images/profiles/option-alpaca.jpg`,
  },
  {
    id: "santa-cat",
    label: "Santa cat",
    src: `${import.meta.env.BASE_URL}images/profiles/option-santa-cat.jpg`,
  },
];
