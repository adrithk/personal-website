# Adrith’s personal website

A dark, minimal portfolio with beige text, deep burgundy and plum accents, and adrithk branding.

A local, static portfolio: one homepage, an all-projects index, three project case studies, and a résumé viewer. No install, build step, account, backend, or API keys are required.

## Preview locally

From this folder, run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173 in your browser. Stop the server with Ctrl+C. If port 4173 is busy, choose another port. All site links also work when opening `index.html` directly, although a local server is preferred for video playback.

## Deploy with Vercel

Import the `adrithk/personal-website` GitHub repository as a new Vercel project. Use the repository root as the Root Directory. The included `vercel.json` selects the **Other** framework preset, skips the build step, and serves the static files from the root (`.`). There are no dependencies to install or environment variables to configure.

If setting these options manually, choose **Other**, enable the Build Command override and leave it empty, and set the Output Directory to `.`. See [Vercel’s static-site build settings](https://vercel.com/docs/builds/configure-a-build#skip-build-step).

The GitHub repository is separate from hosting. Pushing this source does not deploy the site; import it into Vercel when ready. After connecting the repository, later pushes may trigger Vercel deployments according to your project settings.

## Make changes

- **Biography, social links, experience, and interests:** edit `index.html`. The introduction is in `.hero`; the project summaries are in `#work`; experience and coffee are in `#about`.
- **Project collection:** `projects/index.html` lists all available projects and links to their detailed write-ups. Add new project rows here as the collection grows; the homepage’s three featured projects are curated separately. The collection uses `../` to reach shared assets and root pages.
- **Case studies:** edit the `index.html` inside each folder in `projects/`. Each is a complete standalone page. Homepage summaries are intentionally short and edited separately.
- **Colors and typography:** edit the named variables at the top of `styles.css`. `--paper`, `--ink`, `--muted`, `--accent`, and `--line` control the palette. `--display`, `--sans`, `--mono`, and `--width` control fonts and page width. `--font-size-base` sets the shared text scale (18px); individual text styles use rem units so the whole site can be resized together without enlarging images or spacing. Upright Fraunces headings and DM Sans body text are bundled in `assets/fonts/`, along with their open-source licenses. Fonts do not make third-party requests.
- **Shared navigation/footer:** these are plain HTML in all six pages. Update all six when changing common links. Project pages use `../../` to reach the site root so links work on a future static host or under a repository subpath.
- **Résumé page:** `resume.html` temporarily says “An updated résumé will be uploaded here soon.” It does not display the document or link to its PDF. All header résumé links still open this page; the back link returns to the referring site page when available, with a homepage fallback. `assets/resume.js` handles returning to the previous page.
- **Restore the résumé later:** replace `assets/Adrith_Kurlagunda_Resume.pdf` and regenerate its preview with `pdftoppm -f 1 -singlefile -scale-to 2200 -png assets/Adrith_Kurlagunda_Resume.pdf assets/resume-preview`. Then replace `.resume-placeholder` in `resume.html` with the preview image and PDF links, using the retained `.resume-document`, `.resume-viewer`, `.resume-pdf-link`, and `.resume-viewer-note` styles. The existing PDF and preview remain in `assets/` for now; the original supplied `Adrith_Kurlagunda_Resume_2030.pdf` was not changed.
- **Personal Interests, coffee copy, and photos:** edit `.personal` in `index.html`. The three supplied photographs appear as an aligned strip of square crops across the half-width column, with native full-size image links and a short caption. A small burgundy rule separates the sports note. Keep Coffee as a compact aside on desktop, with one short paragraph; it should not become a standalone feature section. Assets live in `assets/coffee/`; the original HEIC files were not changed. The web copies are oriented JPEGs with no EXIF metadata. To add a photo, follow the existing anchor/image structure, with descriptive alt text and the correct image dimensions. Local design proposals in `previews/` are ignored by Git.

## Content sources

- Name and professional links: supplied résumé and application profile.
- Engineering focus, UCLA description, coffee, spikeball, and soccer: Adrith’s instructions for this site.
- Robot case study and local photographs/video: the current `autonomous-mapping-robot` README and demonstration assets. Physical mapping is teleoperated; demonstrated autonomous navigation uses operator-selected goals. Physical autonomous exploration is not claimed.
- Relist: the current `Resale Automator` README. The supported workflow ends at CSV export for manual Depop import.
- Solar system: résumé project description and patent US12528717B1. The schematic is an original explanatory diagram, not a construction drawing or certification.

Scroll reveals live in `assets/reveal.js` and are shared across the homepage, project collection, and case studies. The homepage introduction fills the first screen, with projects below the fold and a centered scroll cue. An IntersectionObserver replays the entrance whenever a text group returns to view, resetting it only after it is fully off-screen. Project rows use a larger upward entrance with a short blur-to-sharp transition. The name and scroll cue remain immediately visible. Content remains readable without JavaScript, with reduced motion enabled, and when printing.

The portfolio contains no analytics, contact-form service, or remote fonts. Links to GitHub, LinkedIn, X, the Relist demo, and Google Patents leave the local site only when followed. The site has not been deployed.

Font sources: [Fraunces](https://fontsource.org/fonts/fraunces/about) and [DM Sans](https://fontsource.org/fonts/dm-sans/about), distributed under the SIL Open Font License.

## Personal sections — discuss before implementing

Adrith has now authorized the coffee expansion and supplied three photos. Its tone is personal: taking time, relaxing, thinking, making coffee, and exploring neighborhoods through café hopping. Do not turn it into an engineering analogy.

Sports and About Me expansions remain ideas to discuss before implementing. Keep personal content secondary to engineering.

## Color direction and references

- [Pentagram — Dataland](https://www.pentagram.com/work/dataland): spare dark fields, negative space, typography, and selective color. Applied here through preserving the black canvas and limiting colored surfaces.
- [Pentagram — National Building Museum](https://www.pentagram.com/work/national-building-museum): a refined red-led identity. Applied here as small burgundy rules and diagram strokes.
- [Material Design — Dark theme](https://m2.material.io/design/color/dark-theme.html): sparse accents, with lighter tonal variants for legibility on dark surfaces.
- [W3C — Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): verify at least 4.5:1 for normal text. Dark burgundy and deep plum are decorative; text uses lighter rose and violet tones.

Adjust `--burgundy`, `--burgundy-edge`, `--plum`, and `--purple-edge` for decorative color. Adjust `--accent-warm` and `--accent` for readable accent text. Social links use inline GitHub, LinkedIn, X, and email icons instead of external-link arrows.
