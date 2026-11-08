"""Match archive captions against GeoNames locally; never synthesize coordinates.

GeoNames data is CC BY 4.0. Keep source IDs, match names, and precision with
every result. Ambiguous matches fall back only to an explicitly named country;
photos without a defensible Earth location remain unpinned.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import io
import json
import math
from pathlib import Path
import re
import unicodedata
from urllib.request import urlretrieve
import zipfile

from atlas_archive import ROOT, DATA, write_json

SPACE = re.compile(r"[^a-z0-9]+")
GENERIC = set("a an the of in at on over near by from to and or with is it sea ocean river lake island islands beach forest mountain mountains park national garden gardens city village town hill valley cliff rock rocks station tower castle church temple palace sunset sunrise spring summer autumn winter fall snow water ice sand tree trees grass red blue green white black northern southern eastern western north south east west old new royal sun moon earth mars jupiter saturn venus neptune galaxy stars space bird birds bear bears lion lions tiger tigers fox wolf deer camel elephant elephants crane cranes boat boats butterfly butterflies flower flowers panda pandas penguin penguins shark sharks seal seals coral fungus mushroom mushrooms fish dolphin dolphins aurora rainbow storm cloud clouds monday sunday christmas halloween easter independence day year years".split())
COUNTRY_ALIASES = {
    "US": ["United States", "USA", "US", "U.S.A.", "U.S."],
    "GB": ["United Kingdom", "UK", "U.K.", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"],
    "KR": ["South Korea", "Republic of Korea"], "KP": ["North Korea"],
    "CZ": ["Czechia", "Czech Republic"], "TR": ["Türkiye", "Turkey"],
    "MM": ["Burma", "Myanmar"], "SZ": ["Swaziland", "Eswatini"],
    "VN": ["Vietnam", "Viet Nam"], "CV": ["Cape Verde", "Cabo Verde"],
    "TL": ["East Timor", "Timor Leste"], "VI": ["US Virgin Islands", "U.S. Virgin Islands", "United States Virgin Islands"],
    "CI": ["Ivory Coast", "Côte d’Ivoire"], "RU": ["Russia", "Russian Federation"],
    "IR": ["Iran"], "TZ": ["Tanzania"], "LA": ["Laos"], "BO": ["Bolivia"],
    "VE": ["Venezuela"], "SY": ["Syria"], "TW": ["Taiwan"],
    "PS": ["Palestine", "Palestinian Territories"], "CD": ["Democratic Republic of the Congo", "DR Congo"],
    "CG": ["Republic of the Congo"], "VA": ["Vatican City"], "BN": ["Brunei"],
}

def normalize(text: str) -> str:
    text = re.sub(r"['’]s\b", "s", text)
    if not text.isascii():
        text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"\bst\b", "saint", SPACE.sub(" ", text.lower()).strip())

def phrases(text: str):
    words = normalize(text).split()
    for length in range(1, min(9, len(words)) + 1):
        for index in range(len(words) - length + 1):
            phrase = " ".join(words[index:index + length])
            if len(phrase) >= 2 and phrase not in GENERIC:
                yield phrase

def load_context(country_file: Path, admin_file: Path):
    countries = {}
    aliases = defaultdict(set)
    for line in country_file.read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) < 17:
            continue
        code = fields[0]
        countries[code] = dict(name=fields[4], geonameID=fields[16])
        for name in [fields[4]] + COUNTRY_ALIASES.get(code, []):
            aliases[normalize(name)].add(code)
    for country in json.loads((ROOT / "atlas-app/WorldLens/Resources/Countries.json").read_text()):
        if country["id"] in countries:
            countries[country["id"]].update(latitude=country["latitude"], longitude=country["longitude"])
            aliases[normalize(country["name"])].add(country["id"])
    admins = defaultdict(set)
    for line in admin_file.read_text().splitlines():
        fields = line.split("\t")
        if len(fields) >= 3:
            for name in fields[1:3]:
                if len(name) >= 3 and normalize(name) not in GENERIC:
                    admins[normalize(name)].add(tuple(fields[0].split(".", 1)))
    canadian = {"BC":"02", "AB":"01", "SK":"11", "MB":"03", "ON":"08", "QC":"10", "NB":"04", "NS":"07", "PEI":"09", "NL":"05", "YT":"12", "NT":"13", "NU":"14"}
    for abbreviation, admin in canadian.items():
        admins[normalize(abbreviation)].add(("CA", admin))
        if len(abbreviation) == 2:
            admins[normalize(".".join(abbreviation) + ".")].add(("CA", admin))
    return countries, aliases, admins

def build_index(source: list[dict], archive: Path, index_path: Path) -> dict:
    wanted = {phrase for photo in source for title in photo.get("archiveTitles", [photo["title"]]) for phrase in phrases(title)}
    print(f"Matching {len(wanted):,} caption phrases against the GeoNames database", flush=True)
    index = defaultdict(list)
    with zipfile.ZipFile(archive) as zipped:
        filename = "allCountries.txt" if "allCountries.txt" in zipped.namelist() else zipped.namelist()[0]
        with zipped.open(filename) as raw:
            for count, line in enumerate(io.TextIOWrapper(raw, encoding="utf-8"), 1):
                fields = line.rstrip("\n").split("\t")
                if len(fields) < 19 or fields[6] not in "AHLPRSTV":
                    continue
                if fields[6] == "A" and fields[7] not in {"ADM1", "ADM2", "ADMD"}:
                    continue
                matched = set()
                for name in [fields[1], fields[2]] + fields[3].split(","):
                    key = normalize(name)
                    if key in wanted:
                        matched.add(key)
                if matched:
                    record = dict(id=fields[0], name=fields[1], latitude=float(fields[4]), longitude=float(fields[5]), featureClass=fields[6], featureCode=fields[7], countryCode=fields[8], admin1=fields[10], population=int(fields[14] or 0))
                    for key in matched:
                        index[key].append(record)
                if count % 2_000_000 == 0:
                    print(f"GeoNames records examined: {count:,}; matched names: {len(index):,}", flush=True)
    # Extremely common place names remain ambiguous; don't truncate them to a
    # single convenient result or pretend the most populous place is certain.
    write_json(index_path, dict(index))
    print(f"Saved {len(index):,} matched place names", flush=True)
    return dict(index)

def distance(a, b):
    lat = math.radians((a["latitude"] + b["latitude"]) / 2)
    return math.hypot((a["latitude"] - b["latitude"]) * 111.2, (a["longitude"] - b["longitude"]) * 111.2 * math.cos(lat))

def resolve_title(title: str, index: dict, countries: dict, country_aliases: dict, admins: dict):
    text = normalize(title)
    keys = set(phrases(title))
    admin_hits = {key: admins[key] for key in keys if key in admins}
    country_hits = {key: country_aliases[key] for key in keys if key in country_aliases}
    # "New Mexico" is a US state, not an explicit reference to Mexico.
    for key in list(country_hits):
        if any(key != region and f" {key} " in f" {region} " for region in list(admin_hits) + list(country_hits)):
            del country_hits[key]
    explicit = set().union(*country_hits.values()) if country_hits else set()
    admin_context = {value for key, values in admin_hits.items() for value in values if not explicit or value[0] in explicit or key in country_hits}
    contextual = explicit | {code for code, _ in admin_context}
    candidates = {}
    for key in keys:
        if key in country_hits:
            continue
        significant = [word for word in key.split() if word not in {"a", "an", "the", "of", "in", "at", "on", "and", "for"}]
        if not significant or all(word in GENERIC for word in significant):
            continue
        for record in index.get(key, []):
            code = record["countryCode"]
            if contextual and code not in contextual:
                continue
            same_country_admins = {admin for country, admin in admin_context if country == code}
            if same_country_admins and record["admin1"] and record["admin1"] not in same_country_admins:
                continue
            if key in admin_hits and any(country == code for country, _ in admin_hits[key]) and record["featureClass"] != "A" and record["population"] < 100_000:
                continue
            if key in admin_hits and any(country == code for country, _ in admin_hits[key]) and record["featureClass"] != "A" and normalize(record["name"]) != key:
                continue
            tokens = len(key.split())
            if not contextual and tokens == 1 and record["population"] < 100_000:
                # A lone word can name many villages, animals, colors, etc.
                continue
            score = tokens * 24 + min(8, len(key) / 5)
            score += 35 if code in explicit else 0
            score += 22 if (code, record["admin1"]) in admin_context else 0
            score += min(12, math.log10(record["population"] + 1) * 2)
            score += 6 if normalize(record["name"]) == key else 0
            if record["featureClass"] == "A":
                score -= 14
            else:
                score += 6
            if record["featureCode"] == "PPLC":
                score += 15
            if (any(word in key.split() for word in ("mount", "mountain", "peak")) and record["featureCode"] in {"MT", "MTS", "VLC", "PK", "HLL"}) or ("lake" in key.split() and record["featureCode"] in {"LK", "LKS"}) or ("park" in key.split() and record["featureCode"] == "PRK"):
                score += 15
            if key in admin_hits and record["featureClass"] == "P" and record["population"] < 100_000:
                score -= 25
            # Favor names in the location clause rather than the photo subject.
            location_text = normalize(",".join(title.split(",")[1:])) if "," in title else ""
            if location_text and f" {key} " in f" {location_text} ":
                score += 10
            old = candidates.get(record["id"])
            if old is None or score > old[0]:
                candidates[record["id"]] = (score, key, record)
    ranked = sorted(candidates.values(), key=lambda value: (-value[0], value[2]["id"]))
    local = [candidate for candidate in ranked if candidate[2]["featureClass"] != "A"]
    if local:
        ranked = local
    if ranked:
        score, key, record = ranked[0]
        other = next((candidate for candidate in ranked[1:] if distance(record, candidate[2]) > 40), None)
        certain = score >= (30 if record["featureClass"] == "A" else 45) and (other is None or score - other[0] >= 12)
        if certain:
            region = record["featureClass"] == "A" or record["featureCode"] in {"MTS", "RGN", "PRK", "OCN", "SEA", "DSRT", "BAY", "STRT", "ISL", "ISLS", "PEN", "PLAT", "VAL", "GLCR"}
            return dict(name=record["name"], latitude=record["latitude"], longitude=record["longitude"], countryCode=record["countryCode"] or None, method="Approximate named area · GeoNames" if region else "Approximate named place · GeoNames", precision="region" if region else "place", geonameID=record["id"], sourceURL="https://www.geonames.org/" + record["id"], matchedName=key, confidence="caption-and-country" if contextual else "distinct-caption-name")
    # Country-only placement is explicitly labeled, never presented as the
    # photographer's location or a successfully identified local landmark.
    if len(explicit) == 1:
        code = next(iter(explicit))
        if any(country != code for country, _ in admin_context):
            return None
        country = countries[code]
        if "latitude" in country:
            return dict(name=country["name"], latitude=country["latitude"], longitude=country["longitude"], countryCode=code, method="Country-level only · source caption does not resolve a local place", precision="country", geonameID=country["geonameID"], sourceURL="https://www.geonames.org/" + country["geonameID"], confidence="explicit-country")
    return None

def build(source: list[dict], index: dict, countries: dict, aliases: dict, admins: dict, existing: dict | None = None):
    old = {photo["imageURL"]: photo for photo in (existing or {}).get("photos", [])}
    output = []
    for item in source:
        photo = dict(item)
        prior = old.get(item["imageURL"], {})
        if prior.get("place"):
            photo["place"] = prior["place"]
        else:
            titles = [item["title"]] + [title for title in item.get("archiveTitles", []) if title != item["title"]]
            matches = [place for title in titles if (place := resolve_title(title, index, countries, aliases, admins))]
            # Prefer a local/area result from another English edition over an
            # explicitly broad country-only result.
            primary = resolve_title(item["title"], index, countries, aliases, admins)
            if primary:
                compatible = [match for match in matches if match["countryCode"] == primary["countryCode"]]
                compatible.sort(key=lambda place: {"place": 0, "region": 1, "country": 2}[place["precision"]])
                photo["place"] = primary if primary["precision"] != "country" else compatible[0]
            else:
                codes = {match["countryCode"] for match in matches}
                matches.sort(key=lambda place: {"place": 0, "region": 1, "country": 2}[place["precision"]])
                photo["place"] = matches[0] if matches and len(codes) == 1 else None
            if len({match["countryCode"] for match in matches}) > 1:
                photo["sourceLocationConflict"] = True
        output.append(photo)
    mapped = [photo for photo in output if photo.get("place")]
    counts = {precision: sum(photo["place"]["precision"] == precision for photo in mapped) for precision in ("place", "region", "country")}
    catalog = dict(schemaVersion=1, generatedAt=datetime.now(timezone.utc).isoformat(), photoCount=len(output), mappedPhotoCount=len(mapped), locationCount=len({(round(photo["place"]["latitude"], 4), round(photo["place"]["longitude"], 4)) for photo in mapped}), precisionCounts=counts, unlocatedPhotoCount=len(output) - len(mapped), attribution="Images: Bing/Peapix, photographer credits on original source pages. Place data: GeoNames, CC BY 4.0. Country outlines: Natural Earth, public domain.", photos=output)
    return catalog

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--geonames", type=Path, default=Path("/tmp/world-lens-geonames.zip"))
    parser.add_argument("--countries", type=Path, default=Path("/tmp/world-lens-countryInfo.txt"))
    parser.add_argument("--admins", type=Path, default=Path("/tmp/world-lens-admin1.txt"))
    parser.add_argument("--index", type=Path, default=Path("/tmp/world-lens-gazetteer-index.json"))
    parser.add_argument("--reindex", action="store_true")
    parser.add_argument("--rematch", action="store_true")
    parser.add_argument("--index-audit", type=Path)
    args = parser.parse_args()
    for path, name in [(args.geonames, "allCountries.zip"), (args.countries, "countryInfo.txt"), (args.admins, "admin1CodesASCII.txt")]:
        if not path.exists():
            print("Downloading " + name, flush=True)
            urlretrieve("https://download.geonames.org/export/dump/" + name, path)
    if args.index_audit:
        audit = json.loads(args.index_audit.read_text())
        source = [dict(title=item["titles"][0], archiveTitles=item["titles"]) for item in audit]
    else:
        source = json.loads((DATA / "source-photos.json").read_text())
    countries, aliases, admins = load_context(args.countries, args.admins)
    index = build_index(source, args.geonames, args.index) if args.reindex or not args.index.exists() else json.loads(args.index.read_text())
    if args.index_audit:
        return
    target = DATA / "catalog.json"
    existing = json.loads(target.read_text()) if target.exists() and not args.rematch else None
    result = build(source, index, countries, aliases, admins, existing)
    if existing and result["photoCount"] < existing["photoCount"]:
        raise ValueError("Refusing to publish a truncated catalog")
    write_json(target, result)
    write_json(DATA / "manifest.json", {key: value for key, value in result.items() if key != "photos"})
    print(json.dumps({key: value for key, value in result.items() if key != "photos"}, indent=2), flush=True)

if __name__ == "__main__":
    main()
