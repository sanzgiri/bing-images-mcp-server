# World Lens shared archive

`catalog.json` is the app's shared source of historical images and approximate locations. A full copy is bundled with the iPhone app. `manifest.json` publishes counts and the catalog timestamp. `source-photos.json` preserves English source captions, original publication dates, and country-edition membership for future matching and updates.

Scope: English Bing editions US, UK, Australia, Canada, and India, from the available 2010–present Peapix yearly archives. Repeated image URLs across editions are deduplicated. English captions can disagree about one image; the current primary caption takes priority and disagreements are retained as `sourceLocationConflict` rather than silently mixing countries.

## Location precision

Every coordinate is taken from a named GeoNames place or an explicitly named country's Natural Earth label position. No LLM invents coordinates. Each result records its GeoNames ID, source URL, and precision:

- `place`: a matched named place, approximate rather than a verified camera position.
- `region`: a named geographic area such as a park, mountain range, state, or island.
- `country`: only the source country is established. The app labels these explicitly and uses orange pins. These are country collections, not local photo positions.
- Missing `place`: no defensible match. The photo stays in the searchable collection without an Earth pin. Examples include astronomy, microscopy, generic subjects, and ambiguous captions.

Matching uses country and administrative context, ambiguity margins, and feature types. Results are automated and should not be described as manually verified. Multiple photographs share a place, so image totals and distinct pin totals differ.

## Updates

The GitHub workflow checks new images daily at 10:23 UTC. It has a manual Run workflow option, including current-year backfill to recover missed recent-feed dates. Peapix feed failures fall back to Bing's recent feed. A failed update retains the last published catalog; it does not replace it with an empty result.

The app's Sync full archive action downloads the published catalog with conditional requests, checks schema, counts, uniqueness, and coordinate ranges, then merges it into saved data. It preserves local Apple-geocoded places and source photographer credits. New shared matches can correct or withdraw previous shared matches. The phone also checks recent English feeds and can locate a small number of fresh arrivals locally. It never attempts to geocode the entire history on each phone.

## Rebuild

```sh
python3 scripts/atlas_archive.py --bootstrap
python3 scripts/atlas_geocode.py --reindex --rematch
```

The first matching pass downloads GeoNames `allCountries.zip`, `countryInfo.txt`, and `admin1CodesASCII.txt`. The extraction index is temporary, not part of the app or repository. No image pixels are downloaded by this pipeline.

Sources: https://peapix.com/bing and https://www.bing.com/HPImageArchive.aspx. Photographer copyrights remain with their owners; source pages provide the original credits.

GeoNames coordinates and names: https://www.geonames.org/, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Natural Earth country outlines/label positions: public domain, https://www.naturalearthdata.com/about/terms-of-use/.
