# Classical Gallery · Daily Art

High-resolution classical paintings for a 2560 × 1440 desktop. This is a ready-to-use Wallpaper Engine web wallpaper. No server, programming, or API key is required.

## Start

The local package includes the optional `START-GALLERY.cmd` launcher. Double-click it to start Wallpaper Engine from its default Steam installation and apply the gallery to the main display. The clean Workshop package omits this launcher.

You can also copy this entire folder to `wallpaper_engine\projects\myprojects\classical-gallery`, then select **Classical Gallery · Daily Art** in Wallpaper Engine. Keep `project.json` with the other files; it contains the wallpaper properties.

For a browser preview, open `index.html` in Chrome or Edge.

## Controls

The only control panel starts in the lower-right corner, above the taskbar. Its navigation row has the **Settings** gear on the left, reserved feedback space in the middle, and **Previous / Next** on the right. Click the artwork title to copy its source URL. The gear opens two tabs: **Framing** and **Collection**. Clicking the gear again or outside the panel closes settings and stops an active hold.

**Framing** contains zoom controls, image fit, and a compact analog joystick for positioning the painting. **Collection** contains the museum/folder selection, an alphabetical **Artist** dropdown, period presets, orientation, genre and movement filters. Select several genres or movements to include any of them; the different filter groups combine. Press **Apply** to commit the selection together. **Reset** clears collection filters without changing your zoom or panel position. Choose **All artists** or select one artist from the catalogue names; new names appear as museum metadata updates. Artist selection uses a mouse-operated alphabetical list instead of a text box, so it also works when Wallpaper Engine does not forward desktop keyboard input. Old saved text searches and unsupported custom year ranges are cleared.

Movement filtering uses explicit museum style metadata, which is most complete in Chicago. Works without a known movement do not match a selected movement. Genres use available museum subjects and explicit title terms; this is an imperfect catalogue classification, not image recognition. **Landscape** is a subject genre; **Horizontal** is a separate image-orientation setting. Museum artist/date/genre/movement/orientation filters do not apply to personal pictures. Choose folder paths once in Wallpaper Engine.

The panel fits the full artwork caption, up to one third of the desktop width. Longer titles, artist names, and dates wrap rather than being shortened with an ellipsis. Loading and copy feedback use reserved inline space and do not change the panel width. Very narrow windows use a larger share of the viewport to keep the controls accessible.

Drag the artist name, date, or an empty part of the panel to move it anywhere on the desktop. Its position is saved between sessions. The panel stays within the display and keeps a 96-pixel margin above the bottom edge so the Windows taskbar does not cover it.

Hold **Zoom out** or **Zoom in** for smooth scaling from 50% with no upper zoom limit. The first second runs at 15 percentage points per second, then accelerates exponentially: speed doubles every 0.75 seconds, up to eight times the base speed at 3.25 seconds. Releasing and pressing again starts slowly. A quick tap changes the scale by about one percentage point. The visible **Reset** button beneath the percentage resets zoom to 100% in the selected fit mode and centers the picture.

Drag and hold the small joystick in the desired direction to pan the view at any angle. A slight deflection moves slowly; full deflection starts at 6% of the viewport per second and uses the same exponential acceleration: speed doubles every 0.75 seconds after the first second, capped at eight times the initial speed. The small neutral area around its center stops movement. Diagonal movement uses the same overall speed as horizontal or vertical movement. Release the mouse to stop and return the joystick to center. Movement is unrestricted in every direction, independently of zoom. Reset returns the picture to the center. Drag the artist name, date, or empty panel space to move the controls.

Zoom and position are saved for each artwork, locally in the browser, for up to 60 works. No server is involved. When keyboard input is available, hold **Space** or **Enter** to use a focused zoom button, or use arrow keys on the focused joystick to pan, and press Escape to close them. **Shift** makes keyboard pan moves larger. Otherwise, Left and Right navigate the artwork history. Keyboard delivery depends on the wallpaper host; all adjustments also have mouse controls.

Click the artwork title to copy the original museum source URL, where you can read about the painting. For a personal picture, clicking its title copies the local file URL. This works in both Wallpaper Engine and normal browser previews, with brief feedback inside the panel and no popup. Paste the copied URL into your browser to open it.

Use **Previous** and **Next** to revisit the viewing history. Revisiting history keeps the automatic rotation schedule. Moving beyond the newest artwork selects a new painting and restarts the interval.

## Wallpaper properties

Collection filters and framing are available directly in the gear. Wallpaper Engine's properties also contain the collection, rotation interval, image quality, fit, horizontal-orientation filter, caption visibility, vertical position, and artwork folders. Choices made in the desktop panel survive the host's initial default settings on restart; a later explicit change to a host property is respected. Color adjustments use Wallpaper Engine's native controls.

If the property list still shows old options after an update, close and reopen the Wallpaper Engine window. The refreshed layout was verified in Wallpaper Engine 2.8.42.

By default, a new painting appears every 24 hours. The current artwork and next change time survive restarts. If the interval expires while the computer sleeps or the wallpaper is closed, the painting changes when the wallpaper resumes.

The default **Show entire painting** mode preserves the complete composition. A softly blurred background extends the painting's colors into the unused space. **Fit width** (formerly Fill screen) scales the complete image to the screen width, preserving its proportions without cropping inside the image element. A tall image can extend beyond the viewport; its full top and bottom remain accessible by panning. **Vertical position** aligns the image: 0 is top, 50 is center, and 100 is bottom.

Use the single **Collection** menu to choose what appears:

| Collection | Included pictures |
|---|---|
| All collections + my folders | All three museums and all configured folders; the default. |
| All museum collections | The Met, the Art Institute of Chicago, and the Cleveland Museum of Art. |
| The Metropolitan Museum of Art | The Met's starter paintings and discovered works. |
| Art Institute of Chicago | Chicago paintings with credited Wikimedia alternatives or bundled images. |
| Cleveland Museum of Art | Cleveland's starter paintings and discovered works. |
| All my folders | Pictures from all three configured folders. |
| My folder 1 | Pictures from Artwork folder 1. |
| My folder 2 | Pictures from Artwork folder 2. |
| My folder 3 | Pictures from Artwork folder 3. |

Choose up to three directories with **Artwork folder 1**, **Artwork folder 2**, and **Artwork folder 3**. Supported files are JPG, JPEG, PNG, WebP, and BMP. Local pictures may have any resolution or orientation; choose images that look good on your display. Museum filters do not apply to them. The Artist list is disabled for folder-only collections. Folder access is available in Wallpaper Engine; the wallpaper reads these files without uploading them. The four folder-only collection choices skip museum discovery.

## Images and automatic discovery

The package retains **632 distinct artwork metadata records**, including an expanded 624-record Chicago/Cleveland snapshot that overlaps the original selection. After excluding the blocked Chicago image source, the initial browsing pool contains **391 paintings**: 366 Cleveland, 8 Met and 17 Chicago works with credited Wikimedia or bundled images. The other 241 metadata records remain in the source inventory but are excluded from playback and the Artist list. Nine credited JPEGs, including the starting painting, are bundled in `assets` for offline use. Other images load only when selected. The metadata inventory and source links are in [SOURCES.md](SOURCES.md).

The Met and Cleveland APIs participate in live discovery. Their new matching works can enter the viewing pool automatically. Chicago uses 17 curated works with credited Wikimedia or bundled images; live Chicago metadata discovery is disabled because its new records point to the blocked image host. The catalogue refreshes on startup, after filter changes, daily, and when browsing needs another result page. New matching public-domain or CC0 paintings can appear without a code update. Date selection stays within classical works through 1900. Query results and metadata storage are bounded, and obsolete requests are cancelled when you change filters. The API may return works with missing or unsuitable images; the gallery validates images before displaying them. Discovery needs internet access and working museum APIs. Existing artwork remains visible when an update or image download fails. An unavailable image is temporarily skipped, and the gallery tries another matching painting automatically. A selection tries at most six image downloads, with an approximately 30-second soft deadline between attempts. Temporary host blocks and rate limits are remembered in a bounded 160-entry local registry; exposed Retry-After values are respected up to ten minutes, avoiding repeated requests to the same blocked image host.

Chicago IIIF / Art Institute image-host downloads are disabled after repeated HTTP 403 challenges. Chicago paintings remain available when they have a credited Wikimedia alternative or a bundled image. This source filter also applies to cached metadata, fresh API results and restored history, so a saved blocked URL cannot return to the viewing queue. The retained Chicago metadata snapshot and copied museum source-page links remain available. Seven exact Chicago seascapes have credited public-domain Wikimedia alternatives; they still load on demand. Seascape filtering also recognizes coast, beach, ocean and shore terms in museum subjects and titles. The initial source-filtered pool currently gives **13 Seascape matches**; this count describes loaded records, not every seascape in the museums. See [SOURCES.md](SOURCES.md) for source checks and their limits.

For museum paintings, the 2K setting uses sources at least 2560 pixels on the long edge. Paintings wider or taller than a **3.5:1** aspect ratio are excluded, including unusually long scrolls. These size and proportion limits do not apply to pictures from your folders. Bundled Met JPEGs retain their original dimensions, 2983–4000 pixels wide. Choosing a resolution above the original does not add detail.

The Met and Wikimedia download path caches up to eight images and 160 MiB in IndexedDB. Its remote JPEG/PNG files are checked before decoding: at most 32 MiB, 48 million pixels, and 12000 pixels on the long edge. It resizes images toward the selected display quality when the host supports the required image APIs; otherwise it uses the checked original within those limits.

The separate museum metadata cache retains up to 2000 records and 12 recent queries, with at most 400 result IDs per query and two concurrent museum requests. The panel's available count describes the currently loaded matching metadata, not every work held by the museums. Browsing and daily updates expand the pool. API pagination limits and incomplete museum tags can limit what a filter finds; the Met search endpoint exposes at most the first 10000 results of a query.

Cleveland's image CDN permits image display but does not provide CORS access for fetching image bytes. Cleveland therefore uses direct JPEG display: API dimensions and reported file size are checked first, then natural dimensions are checked after decoding and before display. This path has no byte/header preflight, image resizing, or IndexedDB image cache; it uses the host's normal image cache. Pictures from your own folders also use the host decoder and do not receive the remote download/header checks.

The smooth framing loop runs only while a zoom button is held or the joystick is moving the view, with visual updates capped at 60 per second. There is no continuous animation loop while idle. Museum source metadata is capped at 160 records; outdated folder events are discarded and staged additions are bounded independently of your actual folder contents. Image decoding, scaling, and background blur still use resources. Measured performance and test limits are in [VERIFICATION.md](VERIFICATION.md). Artwork credits and source links are in [SOURCES.md](SOURCES.md); bundled image rights and publishing notes are in [IMAGE-RIGHTS.md](IMAGE-RIGHTS.md) and [PUBLISHING.md](PUBLISHING.md).

This is an independent project and is not an official museum product.

Museum selections can include classical artistic nudity. When publishing to Workshop, choose an age rating that fits the actual content and keep the preview suitable for all ages. [Wallpaper Engine publishing guidance](https://docs.wallpaperengine.io/en/scene/first/publishing.html).

Official documentation: [Wallpaper Engine web wallpapers](https://docs.wallpaperengine.io/en/web/first/gettingstarted.html), [command-line controls](https://help.wallpaperengine.io/en/functionality/cli.html), [The Met API](https://metmuseum.github.io/), [Art Institute API](https://api.artic.edu/docs/), [Cleveland API](https://openaccess-api.clevelandart.org/), [Wikimedia imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo).

The caption displays the artwork title and date, country or museum-reported cultural origin, then the artist. Country names come from museum metadata, not artist nationality or the scene shown. Missing data displays **Country not specified**; ambiguous attribution displays **Origin uncertain**. Personal files have no museum origin metadata.

Native Wallpaper Engine folder callbacks may URL-encode drive letters and filenames. These paths are decoded once before creating local image URLs, including spaces, Cyrillic text and literal percent signs. A collection change made while Wallpaper Engine is paused or its document is hidden is applied when playback becomes available again.

Turning off **Show artwork title and artist** collapses the closed panel to its three buttons: settings, previous and next. Hidden captions and loading messages reserve no space. Opening the gear expands the settings normally; closing it restores the compact toolbar.
