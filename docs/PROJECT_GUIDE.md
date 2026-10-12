# How this project fits together

The project uses React and Vite for the interface and Supabase for authentication and server-side registration. The public library collections are sample data. The OPAC reads your catalog with server-side pagination and restricted editing. See [the OPAC guide](OPAC.md) for its database migration, and [the member layout guide](MEMBER_LAYOUT.md) for page folders and role permissions. Bounded catalog reads were verified against the configured Supabase project; hosted write policies and production capacity were not verified.

See [the folder guide](FOLDER_STRUCTURE.md) for the full feature structure and examples of where to edit.

## A simple responsibility for each folder

| Folder               | Responsibility                                                    |
| -------------------- | ----------------------------------------------------------------- |
| `src/data`           | Sample content and settings, without React or network calls.      |
| `src/services`       | Calls to Supabase and browser session storage.                    |
| `src/hooks`          | Reusable behavior such as choosing a carousel item.               |
| `src/context`        | State needed across screens: the logged-in user and login dialog. |
| `src/components`     | Interface pieces grouped by feature, plus shared UI.              |
| `src/pages`          | Route screens that combine those pieces.                          |
| `supabase/functions` | Trusted backend code that can use server secrets.                 |

Contexts and hooks run in the visitor's browser; they are not the backend. A route guard controls which screen React shows. Supabase permissions must separately control which data a user can read or change.

## One rule for data

Use an **array of objects for a collection**. Give each object a stable `id`, and use the same fields for every item of the same kind. Books use one `BOOKS` array and a `format` field (`physical` or `ebook`), instead of separate nested lists. Digital sources, hero slides, and member page definitions follow the same collection pattern.

```js
const books = [
  { id: "p1", title: "Pride and Prejudice", format: "physical" },
  { id: "e1", title: "Jane Eyre", format: "ebook" },
];

const physicalBooks = books.filter((book) => book.format === "physical");
```

Use an **object for one thing or named settings**, such as the About-page text or its named image positions. A list and one item's settings have different jobs; forcing both into arrays would make the code harder to read. Use `null` for a link that has not been configured, instead of `"#"`, which looks like a working destination.

Pure data, services and hooks use `.js`; files that render JSX use `.jsx`. Collection constants use uppercase names. Components and hooks use named props and returned fields rather than long positional arguments.

## When to add a service

Authentication calls live in `src/services/auth/authService.js`, and real catalog calls live in `src/services/catalog/bookService.js`. Do not add empty services for static collections. A hook calls a service, holds loading/error state, and supplies results to the page. Keep Supabase calls out of card components.

Do not download an entire future catalog and filter it in the browser. Ask Supabase for one page, select the needed fields, and filter on the server. Add indexes for the searches and filters you actually use. Only add a request-cache library if multiple real screens need to share or refresh the same fetched data.

## Animation and performance

- Route screens and lower homepage sections remain loaded on demand. Section anchors exist before their content loads, so navigation can reach them.
- Hero timer state lives inside `Hero`, so changing slides does not rerender all homepage sections.
- Hero autoplay pauses when the tab is hidden, the hero is offscreen, the visitor interacts with it, or reduced motion is enabled.
- CSS and JavaScript respect reduced-motion settings. Reveal observers disconnect when removed; one-time reveals stop observing after entry.
- Responsive images, image dimensions, lazy loading and the existing small production chunks remain in place.
- Small sample arrays do not need a `useMemo` around every filter. Add optimizations after measuring an actual slow case.

Twenty thousand registered users is different from twenty thousand people making requests at the same time. Frontend cleanup cannot establish backend capacity. Before launch, test realistic concurrent catalog searches, login and borrowing workflows against a staging database; measure response times, errors and Supabase resource usage.

## Supabase setup still required

1. Create and populate the `usersData` table expected by the current auth flow. Registration finds the record by `library_id`, then compares `first_name`, `surname` and `middle_initial`. The school email is collected on the registration form and used for the Supabase Auth account and email delivery; no existing `email` column or email comparison is required in `usersData`.
2. The existing function also expects `id`, `middle_initial` and `user_id`; profile access expects `role`. Use an immutable primary key, unique `library_id`, and unique non-null `user_id`. `user_id` should reference Supabase Auth. An unclaimed record has a null `user_id`. Review the function's field use before writing your migration.
3. Enable Row Level Security. A member may read only their own profile, where `auth.uid() = user_id`. Members must not edit `role`, registration status or account ownership. Choose how staff roles are assigned on the server. Frontend guards are not security rules.
4. If registration must use the school's library records, disable ordinary public Auth signup in the Supabase dashboard so users cannot bypass this flow.
5. Keep only a publishable/anon key in the frontend. Server/service-role keys and email credentials belong only in Edge Function secrets. `VITE_` values are public in a browser build.
6. Registration is a public endpoint. Configure durable rate limiting and bot protection before launch; CORS restricts browser origins but does not stop direct requests. This requires deployed infrastructure and is not implemented by this source review.
7. Use an email service suited to the school's volume. The current Gmail SMTP workflow is a prototype; configure delivery/retry handling and test failure recovery before production. Do not load-test real users or send bulk test mail.
8. Replace the generated-password email workflow with a reviewed account invitation/password-setup flow before production. Confirm allowed redirect URLs and recovery behavior, then test with dedicated staging accounts.

The frontend denies member access if a profile is missing or cannot be loaded and offers retry/logout controls. A linked profile also needs one of the supported roles to enter the member area. Each page checks its allowed roles, using the same definitions as the sidebar. Roles come from the profile, rather than a browser-supplied fallback.

## Features still waiting for real data

Borrowing, reservations, online book files, thesis submission, password recovery and newsletter subscriptions are unfinished. Their controls must not claim that a request was saved. Configure digital-resource links and the access-request form in `src/data/home/digitalSources.js`, and real contact links in `src/data/shared/contactLinks.js`. OPAC catalog reads and book editing are implemented; additional page operations need their own backend permissions when added.

## Deployment and verification

Run `npm run lint` and `npm run build` before releasing. Vite requires Node.js 20.19+ or 22.12+ for the installed major version. The current `es2022` build targets modern browsers and does not add runtime polyfills.

Deploy the production `dist` directory to a static host/CDN. Configure the host to return `index.html` for app routes such as `/register` and `/home`, so refreshing a route works. `vite preview` is for local build checking, not the production server.

Test homepage section links from a fresh load, carousel arrows/tabs, mobile layouts, reduced motion, modal keyboard navigation, missing Supabase configuration, profile failures, signup errors and logout. Database policies and the Edge Function must also be tested after the actual schema exists.

## Primary references

- [React effects and cleanup](https://react.dev/reference/react/useEffect)
- [React: when an effect is unnecessary](https://react.dev/learn/you-might-not-need-an-effect)
- [MDN Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase query optimization](https://supabase.com/docs/guides/database/query-optimization)
- [Supabase performance](https://supabase.com/docs/guides/platform/performance)
- [React Router SPA hosting](https://reactrouter.com/how-to/spa)
- [Vite production builds](https://vite.dev/guide/build)

The shared academic-period selection now filters attendance by semester and annual student enrollment by the selected semester’s academic year. Catalog and inventory queries remain unscoped. See [attendance and annual validation](ATTENDANCE.md) for workflow and database requirements.
