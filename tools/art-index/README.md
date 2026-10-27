# Museum visual index updater

The `Update museum visual index` GitHub Actions workflow runs daily at 10:43 UTC and can also be started manually. It publishes public JSON data to the separate `art-index` branch. It does not change wallpaper source files on `main`.

The job enumerates Cleveland painting pages and Met painting searches by department, validates museum rights and image metadata with the gallery schema, and computes real image features with CLIP ViT-B/32 and DINOv2 ViT-S/14. Unchanged cached features are reused. New or changed images are processed in the build job, using two CPU threads. No neural network runs in Wallpaper Engine.

The bootstrap contains 3,430 public museum records and their previously computed image features, including all 391 starter artworks. Both encoders use FP32 inference; the initial INT8 CLIP variant was replaced after independent checks found CPU-dependent differences. It contains no private image, personal folder path, credential, model weight or executable. The two model downloads are pinned by revision and verified against SHA-256 hashes in `run.py`. A manual `verify_only` workflow run independently recomputes two real museum images on the runner and checks them against the bootstrap before publishing.

The initial complete Cleveland scan accepted 3,331 paintings out of 3,907 records. Met searches enumerated 14,423 candidates. Local access and the first GitHub job encountered HTTP 403, leaving incomplete metadata coverage. The first job successfully analyzed 45 additional works and published 3,430 indexed images. Subsequent scans pace Met requests at one per second with at most two pending workers, stop on 403/429, and resume from saved raw records. A cold complete scan can take several hours; daily runs reuse the cache. The job reports incomplete coverage when upstream collection or image analysis fails; a candidate is not described as indexed before its image has been processed. Existing valid records are retained during source failures. Build caches are saved even when a job fails.

Run from the repository root:

```sh
python -m pip install -r tools/art-index/requirements.txt
python tools/art-index/run.py --publish-dir index-publication
```

`--offline` verifies a warm cached build without museum or image network requests. Build caches live in `tools/art-index/cache/` and are excluded from Git.

The public branch holds a manifest and up to two immutable SHA-256-named JSON files. Unchanged contents keep the current manifest. The wallpaper verifies the manifest, hash, size, record IDs and allowed museum image hosts before replacing its working index, and caches one validated version. This branch distributes data only; no external JavaScript is executed. Private API keys are not required.

Public index endpoint: https://raw.githubusercontent.com/alexmolty/Art-Gallery-for-Wallpaper-Engine/art-index/manifest.json
