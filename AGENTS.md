# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the Next.js App Router source (`layout.js`, `page.js`) and global styles in `globals.css`.
- `public/` holds static assets served at the site root (images, icons, static HTML fallbacks).
- `out/` is a generated static export; avoid editing it by hand.
- `next.config.js` and `firebase.json` capture runtime/build configuration.
- Root-level `index.html`, `script.js`, and `style.css` appear to be legacy/static assets—confirm before changing if the Next.js app is the active source.

## Build, Test, and Development Commands
Use npm from the repo root:

```bash
npm install
npm run dev    # Start local dev server at http://localhost:3000
npm run build  # Production build
npm run start  # Run the production server after build
npm run lint   # Run Next.js ESLint checks
```

## Coding Style & Naming Conventions
- JavaScript/JSX uses 2-space indentation, semicolons, and double quotes.
- React components use `PascalCase` (e.g., `HomePage`); variables/functions use `camelCase`.
- CSS uses `kebab-case` class names and CSS custom properties (see `app/globals.css`).
- Keep App Router file names conventional (`page.js`, `layout.js`) and colocate component-specific styles in `app/` unless they’re truly global.

## Testing Guidelines
- No automated test framework or coverage targets are configured.
- Use `npm run lint` for baseline checks. If adding tests, document the chosen framework and place them near related code (e.g., `app/__tests__/`).

## Commit & Pull Request Guidelines
- Git history shows very short commit messages (e.g., `s`), so there is no consistent convention.
- Prefer clear, imperative messages (e.g., `Add booking calendar embed`) and include scope when helpful.
- For PRs, include a concise summary, testing steps, and screenshots for UI changes.

## Configuration & Deployment Notes
- Static export output lands in `out/` and should be regenerated via build tooling.
- Review `firebase.json` before deploying to ensure hosting settings match the intended output.
