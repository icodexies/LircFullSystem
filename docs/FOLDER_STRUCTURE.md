# Finding files in LIRC_SYSTEM

Keep the existing page folders. The folders supporting those pages now use the same feature names, so you can follow a feature from its screen to its components, hooks and services.

## Folder map

```text
src/
  App.jsx                         App routes and lazy-loaded pages
  main.jsx                        Starts React
  index.css, App.css              App styles
  pages/
    PublicPages/                  Home and registration route screens
    PrivatePages/                 Existing signed-in page folders
    Unauthorized.jsx              Access-denied screen
  components/
    home/                         Hero, About, collections and digital sources
    catalog/                      OPAC details, editing, covers and dialogs
    auth/                         LoginModal
    layout/
      public/                     NavBar, NavLinks and Footer
      member/                     Sidebar, header, footer and sidebar icons
    ui/                           Shared BrandMark, Reveal, DeferredRender, PageHeading
  layouts/
    public/                       PublicLayout
    member/                       MemberLayout
  hooks/
    home/                         Hero and public collection behavior
    catalog/                      OPAC request state and pagination
    auth/                         useAuth and useLogin
    shared/                       Carousel selection and reduced motion
  services/
    auth/                         Authentication requests and session storage
    catalog/                      Book requests, query/field validation and uploads
  context/
    auth/                         Auth provider, store and session hint
    login/                        Login-dialog provider and store
  data/
    home/                         Public section content and sample collections
    shared/                       Contact settings used by multiple screens
  lib/
    supabase/                     Shared Supabase client setup
  routes/                         Guards, role rules and member-page definitions
  assets/
    originals/
      home/                       Original artwork, hero backgrounds and thumbnails
      layout/                     Original layout artwork

public/
  images/
    home/                         Home photos and resource logos
      hero/                       Optimized hero backgrounds
      thumbnails/                 Optimized thumbnails
    auth/                         Login illustrations and logos
    catalog/                      Default book cover
  ...                             Site icons, SVG assets and robots.txt

tests/
  catalog/                        Search, edit validation and image tests
  routes/                         Role and page-access tests

supabase/
  functions/                      Existing trusted backend functions
  migrations/                     Existing database setup scripts
```

## Where should I edit?

| What you want to change                   | Start here                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| Home section order                        | `src/pages/PublicPages/HomePage/Home.jsx`                      |
| Hero appearance                           | `src/components/home/Hero.jsx` and `HeroSection.jsx`           |
| Hero content                              | `src/data/home/heroSlides.js`                                  |
| Hero autoplay                             | `src/hooks/home/useHero.js`                                    |
| Sample public books                       | `src/data/home/bookCollection.js`                              |
| OPAC search/filter controls               | `src/pages/PrivatePages/OPAC/OPAC.jsx`                         |
| OPAC loading, cancellation and pagination | `src/hooks/catalog/useCatalog.js`                              |
| Catalog database requests                 | `src/services/catalog/bookService.js`                          |
| Catalog search rules                      | `src/services/catalog/catalogQuery.js`                         |
| Book-edit form                            | `src/components/catalog/EditBook.jsx`                          |
| Cover preparation and upload              | `src/services/catalog/coverImage.js` and `bookCoverService.js` |
| Login dialog appearance                   | `src/components/auth/LoginModal.jsx`                           |
| Login and registration requests           | `src/services/auth/authService.js`                             |
| Logged-in user/profile state              | `src/context/auth/AuthContext.jsx`                             |
| Using auth state from a component         | `src/hooks/auth/useAuth.js`                                    |
| Sidebar/header/footer                     | `src/components/layout/member/`                                |
| Signed-in page frame                      | `src/layouts/member/MemberLayout.jsx`                          |
| Which roles see which pages               | `src/routes/memberPages.js` and `roles.js`                     |
| Supabase connection configuration         | `src/lib/supabase/client.js`                                   |
| Shared contact links                      | `src/data/shared/contactLinks.js`                              |

## Simple placement rules

- A **page** combines UI into a route screen. Smaller pieces go in the feature's component folder.
- A **component** renders the interface. Put it in `home`, `catalog`, `auth` or `layout`; use `ui` for pieces reused by different features.
- A **hook** manages React behavior and state. Use the matching feature folder, or `shared` when several features use it.
- A **service** handles requests or data preparation/validation. Authentication files go in `auth`; actual library books and OPAC files go in `catalog`. The Home sample book collection is separate from the live catalog.
- **Context** holds state used across screens. Its provider and store stay together; the small hooks for reading that state live in `hooks/auth`.
- **Data** holds plain content/configuration without network calls or React state.
- **Layouts** hold page frames. Headers, footers and navigation components live under `components/layout` with the matching public/member group.
- Served images belong in `public/images/<feature>/`. Original artwork stays in `src/assets/originals/`; the site uses the optimized public files.

Use explicit relative imports, including `.js` or `.jsx`. You can see exactly which file a component depends on without aliases or extra forwarding files. Keep React files as `.jsx` and plain JavaScript as `.js`.

This organization preserves routes, roles, queries, animations and design. It does not change the database or require another SQL migration. Lazy imports still load lower Home sections and signed-in pages only when needed.

## Period and attendance features

`src/components/attendance/`, `hooks/attendance/` and `services/attendance/` contain the scanner, library validation and reports. Shared semester state lives in `src/context/periods/`, with its hook and services under `hooks/periods/` and `services/periods/`. The header selector is `src/components/periods/SemesterSelector.jsx`. Route screens are `pages/PrivatePages/Attendance/`, `Enrollments/` and `AcademicPeriods/`. Supplied one-time conversion/seed scripts live under `supabase/manual/`; the additional reporting migration lives under `supabase/migrations/`.
