# Adrith’s personal website

A dark, minimal portfolio with beige text, deep burgundy and plum accents, and adrithk branding.

A local, static portfolio: one homepage, an all-projects index, three project case studies, two in-progress project pages, and a résumé viewer. No install, build step, account, backend, or API keys are required.

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

- **Biography, social links, and interests:** edit `index.html`. The homepage runs from the introduction in `.hero` to broader interests in `#about`, personal interests in `#personal`, then project summaries in `#work`. The opening arrow leads to broader interests.
- **Project collection:** `projects/index.html` lists all available projects and links to their detailed write-ups. Add new project rows here as the collection grows; the homepage’s three featured projects are curated separately. The collection uses `../` to reach shared assets and root pages.
- **Case studies:** edit the `index.html` inside each folder in `projects/`. Each is a complete standalone page. Homepage summaries are intentionally short and edited separately.
- **Stylesheet layout:** `styles.css` is one shared file, ordered as fonts and tokens, base elements, shared layout, the homepage, the projects index, project pages, the résumé page, motion, then the responsive overrides (widest breakpoint first) and print. Edit a component's base rule in its section and its narrow-screen values in the matching breakpoint block at the end.
- **Cache-busting:** pages load `styles.css` and the scripts with a `?v=` number. Raise it in every page that uses the file whenever you change it, so returning visitors get the new version.
- **Images:** large photos are kept at most 1600px wide. Small placements use their own copies (`robot-thumb.jpg` for the project thumbnails, `coffee/latte-0N-thumb.jpg` for the coffee strip).
- **Colors and typography:** edit the named variables at the top of `styles.css`. `--paper`, `--ink`, `--muted`, `--accent`, and `--line` control the palette. `--display`, `--sans`, `--mono`, and `--width` control fonts and page width. `--font-size-base` sets the shared text scale (18px); individual text styles use rem units so the whole site can be resized together without enlarging images or spacing. Upright Fraunces headings and DM Sans body text are bundled in `assets/fonts/`, along with their open-source licenses. Fonts do not make third-party requests.
- **Shared navigation/footer:** these are plain HTML in all eight pages. The header has a single Projects link at the right edge. Update all eight when changing common links. Project pages use `../../` to reach the site root so links work on a future static host or under a repository subpath.
- **Résumé page:** `resume.html` temporarily says “An updated résumé will be uploaded here soon.” It does not display the document or link to its PDF. The page is available by its direct URL; the back link returns to the referring site page when available, with a homepage fallback. `assets/resume.js` handles returning to the previous page.
- **Restore the résumé later:** replace `assets/Adrith_Kurlagunda_Resume.pdf` and regenerate its preview with `pdftoppm -f 1 -singlefile -scale-to 2200 -png assets/Adrith_Kurlagunda_Resume.pdf assets/resume-preview`. Then replace `.resume-placeholder` in `resume.html` with the preview image and PDF links, using the retained `.resume-document`, `.resume-viewer`, `.resume-pdf-link`, and `.resume-viewer-note` styles. The existing PDF and preview remain in `assets/` for now; the original supplied `Adrith_Kurlagunda_Resume_2030.pdf` was not changed.
- **Personal Interests:** edit `.personal` in `index.html`. It is one full-width section: the left column of `.interest-feature` has the coffee paragraph followed by one evenly spaced line per shorter interest (politics and economics, sports), and the right column is a strip of three square photo crops that link to the full-size images. The strip shows the 600×800 `latte-0N-thumb.jpg` copies; the links open the full-size `latte-0N.jpg`. Add another interest by adding a `<p>` to the left column. Photo assets live in `assets/coffee/`; the web copies are oriented JPEGs with no EXIF metadata. Local design proposals in `previews/` are ignored by Git.

## Content sources

- Name and professional links: supplied résumé and application profile.
- Engineering focus, UCLA description, coffee, spikeball, and soccer: Adrith’s instructions for this site.
- Robot case study and local photographs/video: the current `autonomous-mapping-robot` README and demonstration assets. Physical mapping is teleoperated; demonstrated autonomous navigation uses operator-selected goals. Physical autonomous exploration is not claimed.
- Relist: the current `Resale Automator` README. The supported workflow ends at CSV export for manual Depop import. It is listed on the all-projects page but not in the homepage selection.
- Solar system: résumé project description and patent US12528717B1. The schematic is an original explanatory diagram, not a construction drawing or certification.
- PythonGPT: the PyDrithGPT project summary Adrith supplied on November 27, 2026, plus the local `pydrithgpt` training log for row counts. It is the first project on the homepage and the all-projects page. Every score is pass@1 under one protocol (chat prompt, greedy, 512-token limit, EvalPlus in Docker): final GRPO model 54.3 HumanEval+ / 53.4 MBPP+ against Qwen2.5-Coder-0.5B-Instruct's 54.9 / 43.9. GRPO gains over S3 are described as close to noise, and the model's code-only answers are stated as a limit.
- Ping pong bot (TBD): the project's system-design discussions and SO-101 schematic. Two fixed 60/120 fps cameras, slow low-spin feeds, predictive interception, and a later learned controller are proposals. No hardware implementation or successful return is claimed. It appears only on the all-projects page, with a dedicated detail page; the homepage selection stays curated separately.

Scroll reveals live in `assets/reveal.js` and are shared across the homepage, project collection, and case studies. The homepage introduction fills the first screen, with broader interests below the fold and a centered scroll cue. On the homepage the section titles (Broader interests, Personal interests, Selected work) are set as headings in the display face. An IntersectionObserver replays the entrance whenever a text group returns to view, resetting it only after it is fully off-screen. The broader-interests paragraphs use the same gentle entrance. Project rows use a larger upward entrance with a short blur-to-sharp transition. The name and scroll cue remain immediately visible. Content remains readable without JavaScript, with reduced motion enabled, and when printing.

On the homepage, `assets/scroll-text.js` replaces the timed entrance of the project rows: each row's title, description and tags fill in word by word as the row scrolls up the window, and reverse when scrolling back. `START`, `END`, `SPREAD` and `FLOOR` at the top of the script tune where it begins, where it completes, how soft the edge is, and how faint unrevealed words are.

## Robot arm

The homepage hero art is a robot arm on a table (`assets/robot-arm.js`, drawn on `.arm-canvas` inside `.hero-art`). On a loop it picks up two cubes and a ball one at a time and drops them into a bin; the bin then empties and the round starts again. Two-link inverse kinematics place the wrist, with the fingertips kept pointing straight down. `BASE`, `L1`/`L2`/`L3` (link lengths), `SPOTS`, `BIN` and `PER` (seconds per object) at the top of the arm set the layout and pace. With reduced motion it is drawn still; without JavaScript the figure is empty, since it is decorative.

## Homepage terrain

Behind the homepage introduction sits a dotted loss landscape in the site's violet-to-pink palette, shading toward the wordmark's dusty rose near the bottom. On load the dots spawn in as a wave spreading across the range. Dots shift away from the cursor, and a click on an empty part of the introduction drops a ball from the cursor that rolls slowly down the gradient, leaves a fading trail, and sends a ripple through the dots when it settles. Dots behind the copy and the diagram are dimmed so the text stays clear. While scrolling, the backdrop drifts up a little and fades out within the first part of the screen, so the next section arrives on the plain page. The scroll cue reads “Scroll for more”. Once the terrain has loaded, a small hint (“click anywhere to descend the gradient”, or “tap” on touch screens) appears at the bottom left of the introduction, or under the social links on phones, and fades out together with the backdrop when scrolling down.

- **Script:** `assets/terrain.js` draws on one 2D canvas (`.terrain-canvas` in `index.html`), row by row from back to front so nearer ridges hide what is behind them. `ground()` shapes the mountains, `CAM` sets the viewpoint, `SP` the dot spacing (wider on phones), `STOPS` and `ROSE` the colours, `DRIFT` how far the backdrop moves while it fades, and `TRAIL_LIFE` how long a ball's trail lasts. Overall brightness is the `let a = fog * (…)` line in the frame loop.
- **Performance:** the still scene is drawn once into an offscreen cache and redrawn about once a second for the slow colour drift (`CACHE_EVERY`). Only the patch around the cursor is redrawn live; the whole scene is redrawn every frame only during the spawn-in and while a ripple runs. Dots that nearer ridges always hide are found when the grid is built and never drawn, and the loop sleeps whenever nothing moves. If you change how far the cursor can move a dot (`PUSH`, `LIFT_PX`, `SETTLE`, `MAX_SIZE`), keep those constants accurate, since the hidden-dot test relies on them.
- **Styles:** the “Homepage terrain” block in `styles.css` fixes the canvas behind the page.
- **Fallbacks:** without JavaScript the homepage is the ordinary page. With reduced motion the terrain is drawn still, with no spawn-in or balls. It is hidden when printing.
- **Design studies:** the versions that led here are in the ignored `previews/` folder (`opening-options/`, `ml-backgrounds/`, `subtle-backgrounds/`, `descent/`, `terrain/` and `terrain-home/`).

## Lidar cursor and autonomous vehicles

Once the homepage introduction has scrolled halfway out of the window, the ordinary cursor starts sweeping the page with a faint lidar. Its rays stop at the first line of text, image or icon they meet and leave fading violet dots there, so the page layout is traced out around the pointer. Hovering a link locks faint corner brackets onto it. A click anywhere below the introduction deploys a tiny rose autonomous vehicle (headlights and a lidar puck on the roof) that drives around the page on its own, steering around content blocks with its own short-range lidar, leaving faint tyre tracks and keeping a little distance from the cursor. Up to six vehicles roam at once; the oldest fades out when another is added. While the lidar is on, a small white hint (“click anywhere to deploy / an autonomous vehicle”, on two lines so it fits beside the page column) sits tucked into the bottom-right corner of the window. It fades out whenever text, an image or a divider line scrolls underneath it, so on narrow windows it mostly appears in the gaps between sections; it dims slightly once a vehicle has been deployed, and the vehicles steer around it. Back on the introduction, the lidar and hint switch off and the terrain's click-to-drop-a-ball works as before.

- **Script:** `assets/lidar-bot.js` draws on one fixed canvas above the page that never takes clicks, and adds the `.lidar-hint` line. `RANGE`, `SPIN`, `DOT_LIFE`, `MAX_ROVERS`, `TRACK_LIFE` and `ACTIVATE_AT` at the top tune it; `TEXT` and `BOX` list what the lidar can see. Dot brightness is the `ctx.globalAlpha = f * f * …` line in the point-cloud loop.
- **Styles:** the “Lidar cursor” block in `styles.css` places the canvas and the hint.
- **Fallbacks:** touch screens, reduced motion and printing keep the ordinary page, with no lidar, vehicles or hint.

The portfolio contains no analytics, contact-form service, or remote fonts. Links to GitHub, LinkedIn, X, the Relist demo, and Google Patents leave the local site only when followed. The site has not been deployed.

Font sources: [Fraunces](https://fontsource.org/fonts/fraunces/about) and [DM Sans](https://fontsource.org/fonts/dm-sans/about), distributed under the SIL Open Font License.

## Personal sections — discuss before implementing

Adrith has now authorized the coffee expansion and supplied three photos. Its tone is personal: taking time, relaxing, thinking, making coffee, and exploring neighborhoods through café hopping. Do not turn it into an engineering analogy.

The earlier “Before UCLA” experience list has been removed from the homepage at Adrith’s request. Keep personal content secondary to engineering.

## Color direction and references

- [Pentagram — Dataland](https://www.pentagram.com/work/dataland): spare dark fields, negative space, typography, and selective color. Applied here through preserving the black canvas and limiting colored surfaces.
- [Pentagram — National Building Museum](https://www.pentagram.com/work/national-building-museum): a refined red-led identity. Applied here as small burgundy rules and diagram strokes.
- [Material Design — Dark theme](https://m2.material.io/design/color/dark-theme.html): sparse accents, with lighter tonal variants for legibility on dark surfaces.
- [W3C — Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): verify at least 4.5:1 for normal text. Dark burgundy and deep plum are decorative; text uses lighter rose and violet tones.

Adjust `--burgundy`, `--burgundy-edge`, `--plum`, and `--purple-edge` for decorative color. Adjust `--accent-warm` and `--accent` for readable accent text. Social links use inline GitHub, LinkedIn, X, and email icons instead of external-link arrows.
