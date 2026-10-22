# Verification record

Checked on 23 October 2026. This records completed checks and their limits; no Workshop upload was performed.

## Current controls and filters

- Replaced the artist text input with an alphabetical mouse-operated Artist dropdown. The retained initial viewing pool yields 251 distinct names. Checks cover sorting/deduplication, exact artist matching, new metadata, preserved selection, collection changes, disabled folder-only mode, Apply/Reset, and ignored legacy text queries.
- Removed Custom years and the From year / To year inputs. Period presets remain. Unsupported saved custom ranges reset to All periods; exact preset ranges survive restart.
- Replaced four pan arrows with a 52-pixel analog joystick. Direction and speed follow deflection, diagonals have normalized speed, and the central dead zone stops movement. Zoom starts at 15 percentage points/second and full deflection pans at 6 viewport percentage points/second, 20% faster than the preceding revision. The multiplier now doubles every 0.75 seconds after one second and reaches its 8× cap at 3.25 seconds. Production-handler tests passed the exponential zoom curve (about 115%, 131%, 163%, 228%, and 318% at 1, 1.75, 2.5, 3.25, and 4 seconds), pan at 30 FPS, the 60-update limit, and all existing release/center/lifecycle regressions.
- Production-handler tests cover partial deflection, every direction, diagonal keyboard holds, release outside the menu, refused pointer capture, native transient buttons=0, return to center, acceleration reset, blur/hidden/pause/resize/tab changes, artwork changes, and delayed release. Visual updates are capped at 60/second. Center and release leave zero framing animation callbacks.
- Layout checks passed at 2560, 1920, 1440, 660 and 360 pixel widths. The joystick stays compact with no old pan buttons or idle CSS animations. The full caption wraps within one third of a desktop viewport. The title copies the current source link; drag works from artist/date/empty space.
- A real Wallpaper Engine 2.8.42 preview was operated by mouse: Artist → Albert Bierstadt → Apply loaded the bundled Mountain Scene, and a diagonal stick drag changed both axes and recentered on release. The native preview did not crash. Native HTML selects remain hidden; local DOM listboxes avoid the previously reproduced Crashpad crash.

## Seascape loading

Live Chicago IIIF requests returned HTTP 403 Cloudflare challenge responses that an embedded image client cannot display. Direct ArtIC painting downloads are now disabled: image-ID-only records and explicit ArtIC image URLs are excluded after alternate-image overlays, including cached/fresh metadata and restored history. Stale source-cache URLs cannot replace valid alternatives. A final download guard also rejects that host. Chicago live metadata discovery is disabled because it would only add unusable image-ID records; Met and Cleveland discovery continue. No challenge bypass is attempted. [Chicago API issue](https://github.com/art-institute-of-chicago/api-data/issues/9).

Seven exact public-domain Chicago seascape images have credited Wikimedia alternatives. Museum source links remain intact, and refreshed metadata cannot overwrite the alternate URL. All seven metadata/licence records were checked. Four of those exact JPEG endpoints returned 200 with valid image headers during the audit; the remaining three were not transport-verified after Wikimedia returned 429. Existing Cézanne and two Cleveland JPEGs also loaded. The real gallery loaded two Cleveland seascapes in a separate live smoke check. External service availability remains outside the wallpaper's control.

Browser fixtures passed automatic recovery after 403, shared upload/thumb Wikimedia cooldown after 429, Retry-After, 404 quarantine across metadata refresh and repeated navigation, bounded 160-entry failure storage, and oversized-response rejection before Blob creation. The metadata snapshot has 632 records, while the retained viewing pool has 391 works (366 Cleveland, 8 Met, 17 Chicago with alternatives); 241 direct-IIIF records are excluded. The broader seascape terms match 13 retained works. Genres use explicit subject/title heuristics and can be incomplete.

## Memory and idle behavior

The preceding headless Chrome stress run performed 20 distinct artwork transitions through actual JPEG/Blob loading. It left one active Blob URL after the fade; all outgoing URLs were revoked and inactive image/background references cleared. Event listeners stayed at 111, and there was one document throughout. The final idle heap change was 18.23 KiB after explicit GC; retained history and metadata account for earlier growth. Heap counters exclude native image/GPU allocations.

The normal cache held eight images (5.70 MiB). A 192 MiB pressure fixture was evicted below the 160 MiB limit on the next write. The pressure blobs were never decoded. During five seconds of settled idle there were zero requestAnimationFrame callbacks and zero running CSS animations. Source metadata is capped at 160 entries; history, recent artwork, decoded image retention and catalogue queries are bounded. Folder handling tests from the preceding revision covered repeated folder replacement, obsolete removals and a valid 12500-file catalogue.

## Native performance sample

Windows counters sampled an isolated Wallpaper Engine 2.8.42 preview process family for 76.19 seconds on an NVIDIA GeForce RTX 5070 with 20 logical CPUs. The requested window was 2560 × 1440; the observed client area was about 2560 × 1421. It showed Albert Bierstadt's bundled 3811 × 2628 Mountain Scene with blur enabled and the Framing tab open. A test-only driver sent ten-second holds through the production zoom and joystick handlers. Other desktop wallpaper processes and the settings UI were excluded. This historical measurement precedes removal of the custom-year form and direct ArtIC source, and the subsequent exponential acceleration change. Native CPU/GPU counters were not resampled for that acceleration change; the current browser test verifies the 60-update limit and zero idle framing callbacks.

| Phase | Average CPU | Peak CPU sample | GPU 3D samples | Private process memory | Maximum dedicated GPU memory |
|---|---:|---:|---:|---:|---:|
| Idle | 0.05% | 0.25% | 0% | 392.82–393.03 MiB | 165.96 MiB |
| Hold zoom | 0.84% | 1.04% | up to 2% | 333.56–347.83 MiB | 153.94 MiB |
| Hold joystick diagonally | 0.74% | 0.84% | up to 2% | 298.21–306.22 MiB | 123.96 MiB |
| Idle after controls | 0.07% | 0.31% | 0% | 314.65–320.32 MiB | 141.65 MiB |

CPU is normalized across all 20 logical processors. GPU readings are coarse per-process Windows counters summed for the preview family; 0% does not mean zero GPU work. Private bytes measure committed private memory, not all physical RAM. Shared GPU memory peaked at 42.38 MiB during initial idle and stayed below 4.56 MiB during/after controls. This short sample and the browser stress check found no accumulating image references or idle animation work; they do not establish multi-hour behavior or a universal process/GPU memory bound.

## Other retained checks and packaging

Previous checks cover daily-rotation deadlines and restart restoration (simulated, not a 24-hour soak); nine bundled JPEG hashes and rights records; local folder add/remove callbacks and encoded filenames; image-size/aspect guards; offline bundled-image fallback; per-artwork framing and panel position persistence; catalogue pagination, cancellation and the 2000-record / 12-query / 400-result / two-request bounds. Museum images over 3.5:1 in either orientation are excluded; personal pictures are exempt. No remote scripts, API keys or image prefetch are required.

The clean Workshop package includes source, documentation and nine credited JPEGs. It excludes launchers, test drivers, browser caches and personal folder paths. Current source hashes:

```json
{
  "gallery.js": "aece37e701a8eca849e06dbe803965b68240f55455f3dcc1aab0e2c9b691a5a2",
  "core.js": "5df777e25e7c3108df822caa661d110cf8c2d936a337c623ad365c2160bbd5bc",
  "index.html": "5962f84e81137a064d5ba220dd2394815e03e7b38d00f68b47f3457477a82497",
  "styles.css": "509c8ae72b2c214d2df332f4100f7fe85c2ba3094f82eaf040f64144b088fadb",
  "museum-catalog.js": "dfa0b98536636119da893412aaaa1513e7d71d82bf7b5d2d6bcecdb40767378d",
  "catalog.js": "e0fd3cb743a6fa0b983e8a8903939236f6d0df12b60f3b913abfd9cf052f0844",
  "local-art.js": "ae975a1bc46f9c9904a660e15fcf61fdee30f68ca471182d05ae6f95e5506007"
}
```

## Country caption update

Added a subdued country/origin line between title and artist. Uses explicit museum country, otherwise a recognized country/historical origin from museum culture. Unspecified cities are not guessed or geocoded; artist nationality is not substituted. No new network requests, timers, event listeners or animation loops are introduced.

Browser checks passed the initial France caption, the title/country/artist order, an actual change to bundled Bierstadt with United States, missing/ambiguous origin handling, and layout without horizontal overflow or taskbar overlap at 2560, 660 and 360 pixels. No runtime errors were recorded.

## Local folder loading fix

Reproduced in a real Wallpaper Engine 2.8.42 preview with nine user-authorized local JPG/PNG images. The host delivered a fetchall callback before its property update, using URL-escaped drive colons and spaces; the previous parser rejected all nine paths. The parser now decodes recognizable native encoded paths exactly once, retaining literal percent sequences in ordinary paths. The same native preview then enumerated all nine files, displayed an actual local JPEG, and changed to a local PNG with a mouse click on Next. User image files were neither modified nor bundled.

Browser checks passed all nine real local paths, callback/property order, exact-once percent decoding, encoded removal, invalid/control paths, folder changes while paused and hidden, resume/visibility recovery, separate folder slots, and Next/Previous navigation. There were no HTTP requests or runtime errors. The existing staging/large-folder/UNC tests and joystick stop/idle/60-Hz regressions passed again. Deferred navigation keeps only one latest intent and adds no polling, timers or idle animation work. No new native CPU/GPU measurement was made for this event-handling fix.

## Compact toolbar without artwork information

A browser visual check measured the caption-hidden closed panel at 90 × 34 pixels, including on a 360-pixel-wide viewport. Long hidden titles and loading text did not change its dimensions. The Framing and Collection settings expanded normally; closing settings restored the compact size. Re-enabling artwork information restored the caption layout. This change only changes CSS layout and adds no runtime loops, timers or listeners.

## Unlimited framing and fit by width

Removed the 300% zoom cap and fixed pan-coordinate limits in both image-fit modes. A controlled-clock browser hold reached about 10637%, remained enabled, and restored its zoom and displacement after reload. Positive and negative 120vw/vh offsets were reached above 300% in Full painting. Reset is visibly labelled beneath the percentage; it restores 100%, zero X/Y offset and centered vertical alignment, and cancels pending quality refresh. Joystick base speed is now 6 viewport percentage points/second, with the same exponential ramp. Release/lifecycle cleanup, 60-update limits and zero idle framing callbacks passed.

Fit width renders the whole image element at viewport width with its natural aspect ratio and auto height, replacing the old internal object-fit:cover crop. A real portrait rendered at 2560 × 3194 pixels on a 2560 × 1440 viewport; both full top and bottom edges were reachable by panning. A wide image on a portrait viewport remained completely visible at viewport width. Vertical alignment 0/100 and Reset passed. Auto quality calculation now follows screen width. Layout tests passed from 2560 to 360 pixels without overflow. Native CPU/GPU counters were not resampled for this revision; image byte/dimension/cache guards remain in place.

The final runtime also passed the 20-image Blob stress check: 111 listeners remained constant, one active Blob URL remained after outgoing-image cleanup, the cache retained eight images and evicted byte pressure below 160 MiB, and settled idle produced zero animation callbacks or CSS animations. This browser check excludes native decoded-image/GPU memory.
