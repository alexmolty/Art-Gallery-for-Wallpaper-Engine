# Publishing notes

This is an independent wallpaper interface using museum Open Access / public-domain artwork. The painting sources and per-file hashes are in [IMAGE-RIGHTS.md](IMAGE-RIGHTS.md); the wider starter catalogue is listed in [SOURCES.md](SOURCES.md). Installation and controls are in [README.md](README.md).

The package retains 632 distinct artwork metadata records, including an expanded public museum snapshot documented in SOURCES.md. With the blocked Chicago image source excluded, the initial viewing pool has 391 paintings: 366 Cleveland, 8 Met and 17 Chicago works using credited Wikimedia or bundled images. The other 241 records remain in the metadata inventory but are excluded from playback and the Artist list. Nine JPEGs are bundled; all other images are requested on demand. The Met and Cleveland APIs automatically refresh bounded metadata and filtered query results. Chicago uses its retained metadata snapshot and 17 curated works with credited Wikimedia or bundled images; live Chicago metadata discovery is disabled because new results point to the blocked image host. These catalogues can overlap. No new image files are bundled by discovery, and public-domain/CC0 checks still apply per artwork.

## Rights and Steam

Steam SSA 6.A grants Valve and affiliates broad rights when you upload content. Section 6.B adds Workshop rules and allows app-specific terms. Section 6.D requires the uploader to have sufficient rights, submit lawfully, and satisfy its creator/contributor warranty. These are uploader obligations, not an automatic license supplied by Steam for third-party pictures. [Current Steam Subscriber Agreement, section 6](https://store.steampowered.com/subscriber_agreement/#6).

Describe the work accurately as a wallpaper interface/assembly featuring third-party public-domain and Open Access paintings. Do not claim to have painted them or imply that museums endorse the wallpaper. The source record supports reuse of the nine bundled JPEGs; it does not promise all-country rights clearance, acceptance by moderators, or the outcome of a complaint. No new blanket MIT or other license is assigned to the artwork by this package. [Image rights and limits](IMAGE-RIGHTS.md).

**Do not include pictures from your personal folder in the Workshop files unless you have the rights needed for redistribution and the Steam upload grant.** Selecting a folder for private display does not establish those rights. User folder paths and personal pictures are not part of the artwork source inventory. [Steam SSA 6.D](https://store.steampowered.com/subscriber_agreement/#6).

Public-domain museum selections can include classical artistic nudity, including works added by discovery. Choose a Workshop age rating that fits the wallpaper's content and keep the preview suitable for all ages, as required by the [official publishing guidance](https://docs.wallpaperengine.io/en/scene/first/publishing.html). Copyright status alone does not describe content maturity.

## Clean upload folder

Use a separate clean Workshop folder containing the web files, `project.json`, the nine credited JPEGs in `assets`, and the documentation. Keep the optional `START-GALLERY.cmd` launcher, development/test scripts, test images, browser profiles, private pictures, and runtime dependencies outside the Workshop upload. The web wallpaper itself needs no bundled executable, installer, local server, API key, or external JavaScript runtime.

Before uploading, inspect the files selected by Wallpaper Engine and its generated preview, and read the terms presented by Steam for that upload. This document does not publish anything or confirm that a Workshop submission has been approved.

## Network and local data

The HTML, CSS, and JavaScript are shipped locally. The reviewed source loads no remote JavaScript or font CDN, contains no API keys, and includes no analytics, advertising, account sign-in, or image-upload endpoint.

The current catalogue and integration use these remote services:

| Host | Purpose and request data |
|---|---|
| `collectionapi.metmuseum.org` | Met search and object metadata: public search parameters and artwork IDs. |
| `images.metmuseum.org` | Met original image downloads. |
| `commons.wikimedia.org` | Wikimedia imageinfo API: public file titles and requested image size; also used in copied source URLs. |
| `thumb.wikimedia.org`, `upload.wikimedia.org` | Wikimedia thumbnail/original image downloads. |
| `www.artic.edu` | Used in copied museum source-page URLs; not used for painting downloads. Chicago paintings use credited Wikimedia or bundled images. |
| `www.metmuseum.org` | Used in copied museum source URLs. |
| `openaccess-api.clevelandart.org` | Cleveland search metadata: public collection/type/date filters, limits, and offsets. |
| `openaccess-cdn.clevelandart.org` | Cleveland print JPEGs displayed directly as images. |
| `clevelandart.org`, `www.clevelandart.org` | Used in copied Cleveland artwork source URLs and linked rights documentation. |

The single **Collection** property has nine choices: **All collections + my folders**, **All museum collections**, **The Metropolitan Museum of Art**, **Art Institute of Chicago**, **Cleveland Museum of Art**, **All my folders**, and **My folder 1**, **2**, or **3**. Up to three paths can be configured with **Artwork folder 1–3**. The default combines all museums and all configured folders. Folder-only choices skip museum discovery. Met and Cleveland choices request their selected museum metadata; Chicago uses the retained snapshot without live discovery.

As with other web requests, the receiving service can see connection information such as IP address and browser request headers. Requests also reveal the public artwork identifiers, file titles, searches, and sizes they contain. The Met states that its API collects IP addresses and usage information. [Met API terms](https://www.metmuseum.org/policies/terms-and-conditions).

Selected local pictures are read through Wallpaper Engine's directory callbacks and `file:` URLs; the wallpaper code does not upload their contents or send their filenames to a museum. Settings, viewing history, public source metadata, and per-artwork zoom/pan framing for up to 60 works are saved in browser local storage. History may contain local file URLs. Met/Wikimedia image downloads use a bounded local IndexedDB cache; Cleveland's direct images use the host's normal image cache. These browser records belong to the user's local installation and are not files to include in a Workshop package.

The single control panel has the settings gear on the left and artwork navigation on the right. Clicking the artwork title copies its source URL. Drag the artist name, date, or empty panel space to move the panel. The gear reveals Framing and Collection tabs. Framing contains zoom, image fit and a compact analog joystick that pans in any direction. Small deflections move more slowly; the central dead zone stops movement and diagonal speed is normalized. Collection has museum/folder selection, an alphabetical Artist dropdown, period presets, genres, movements and orientation. Custom year entry is removed; unsupported saved ranges reset to All periods. Artist names come from the available museum metadata and update with the catalogue. The Artist control is a mouse-operated alphabetical dropdown; the text search has been removed and legacy saved queries are ignored. The Artist control is disabled for folder-only collections. Personal pictures ignore museum filters. Filters use museum metadata and explicit subject/title terms; incomplete classification can omit relevant works. Closing settings or switching tabs stops any active hold. Escape closes settings where the host forwards keyboard input. Zoom starts at 15 percentage points per second and full joystick deflection pans at 6% of the viewport per second, accelerating exponentially after one second: speed doubles every 0.75 seconds, capped at eight times the initial speed after 3.25 seconds. Visual updates are capped at 60 per second, and no framing loop runs while idle. The full caption wraps within one third of the desktop width; loading feedback has reserved space. See [README.md](README.md) for usage.

In Wallpaper Engine 2.8.42, the native **Color scheme** and **Flip** properties were verified hidden by display conditions after closing and reopening its window; **Show color options** remained available. An already-open window can retain the previous property list. This is a version-specific check.

Clicking the artwork title copies the current museum source URL or local file URL to the clipboard in both Wallpaper Engine and normal browser previews. Opening the copied URL in a browser is a separate user action.

## Availability and verification limits

Nine JPEGs are bundled for offline use. An offline test with HTTPS requests blocked checked local display and navigation. New uncached artwork can fail to load if an API, image host, network connection, or CORS policy prevents access; the code handles failed requests and can use available bundled or cached images. The selector now tries other matching paintings after a failure, up to six actual image attempts with an approximately 30-second soft deadline checked between attempts. Failed artwork and blocked hosts are temporarily excluded; the persisted failure registry is capped at 160 entries. Exposed Retry-After values are honored up to ten minutes, and Wikimedia upload/thumbnail hosts share a cooldown. The selection retains the current painting if no eligible image can be loaded. This is not a guarantee that every remote image will load in every Wallpaper Engine/browser version.

On 23 October 2026, Chrome checks reproduced HTTP 403 Cloudflare challenges and CORS failures for Chicago IIIF images. Chicago IIIF / Art Institute image-host downloads are disabled after repeated HTTP 403 challenges. Chicago paintings remain available when they have a credited Wikimedia alternative or a bundled image. This source filter also applies to cached metadata, fresh API results and restored history, so a saved blocked URL cannot return to the viewing queue. The retained Chicago metadata snapshot and copied museum source-page links remain available. Seven Chicago seascapes were matched to exact Wikimedia files with verified museum identifiers and public-domain metadata; only alternate URLs and credits were added. Four originals returned HTTP 200 with image headers. Further transport checks stopped when Commons returned HTTP 429 with Retry-After: 600; the other three URLs therefore have metadata verification, rather than a successful JPEG transport check. Two Cleveland seascapes loaded through the complete gallery at a 3400-pixel long edge. [Per-work sources and limits](SOURCES.md).

The Seascape subject matcher recognizes additional coast, beach, ocean and shore terms; the initial source-filtered browsing pool currently contains 13 matches with only this genre selected. This is a catalogue-label count, not a complete museum inventory or a claim that all remote images loaded successfully. All existing byte, dimension and aspect-ratio guards remain in place. No additional JPEGs were bundled.

The Met/Wikimedia fetch path checks remote JPEG/PNG images before browser decoding: a 32 MiB per-file limit, no more than 48 million pixels, and no edge longer than 12000 pixels. Where supported, image bitmap/canvas APIs resize them toward the requested display quality; the fallback uses an original that already passed those limits. Streaming-capable hosts stop downloads that exceed the byte limit. Older hosts without a readable response stream can only check byte size after receiving the response. Its IndexedDB cache is capped at eight images and 160 MiB.

Cleveland's image CDN was verified to allow direct image display while omitting the CORS header needed for fetch/Blob access. This path validates the API's reported JPEG dimensions and file size before loading, then checks actual natural dimensions after decoding and before display. It does **not** perform byte/header preflight, resize Cleveland images, or store their image bytes in IndexedDB. The host's normal image cache controls any reuse. The API metadata remains subject to its own accuracy and availability limits. Cleveland identifies the selected images as CC0; see its [Open Access policy](https://www.clevelandart.org/open-access) and [API documentation](https://openaccess-api.clevelandart.org/).

User-selected local images go through the host decoder and are outside the remote download/header checks. The image guards described above do not establish a bound on total Wallpaper Engine process memory, GPU allocations, or host decoder behavior.

Museum API availability and content can change. The Met explicitly reserves API access changes and does not guarantee availability. [Met API terms](https://www.metmuseum.org/policies/terms-and-conditions). The smooth framing loop runs only during a held zoom action or joystick movement, caps visual updates at 60 per second, and stops on release; there is no continuous animation loop while idle or with the joystick in its neutral zone. Image decoding, scaling, and background blur use resources; the measured native preview results and their limits are recorded in VERIFICATION.md.




Framing has no application-imposed upper zoom or pan-coordinate limit. The visible Reset action restores 100% zoom and a centered image. Fit width scales the entire image by its width rather than internally cropping its bitmap; tall content outside the screen remains accessible by panning. Existing download, image-dimension and cache bounds remain separate from display transforms.
