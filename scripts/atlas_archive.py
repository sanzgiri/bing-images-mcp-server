"""Collect English Bing/Peapix metadata, preserving original dates and aliases."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen
from urllib.parse import urlparse

MARKETS = ("us", "gb", "au", "ca", "in")
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "atlas-data"

def get(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "WorldLens-Archive/1.0 (+https://github.com/sanzgiri/bing-images-mcp-server)", "Accept": "text/html,application/json"})
    with urlopen(request, timeout=35) as response:
        return response.read()

def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(path)

class ArchiveParser(HTMLParser):
    def __init__(self, year: int):
        super().__init__()
        self.year = year
        self.records = {}
        self.links = []
        self.anchor = None
        self.pending = None
        self.text = []
        self.date_text = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            href = attrs.get("href", "")
            self.links.append(href)
            self.anchor = href if re.fullmatch(r"/bing/\d+", href) else None
            self.text = []
        elif tag == "img" and self.anchor:
            image = attrs.get("data-src", attrs.get("src", ""))
            if image.startswith("https://img.peapix.com/"):
                self.records.setdefault(self.anchor, {})["imageURL"] = re.sub(r"_(640|1920)\.jpg$", ".jpg", image)
        elif tag == "span" and "fs-sm" in attrs.get("class", "") and self.pending:
            self.date_text = []

    def handle_data(self, value):
        if self.anchor:
            self.text.append(value)
        if self.date_text is not None:
            self.date_text.append(value)

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor:
            title = "".join(self.text).strip()
            if title:
                self.records.setdefault(self.anchor, {})["title"] = title
                self.pending = self.anchor
            self.anchor = None
        elif tag == "span" and self.date_text is not None:
            text = "".join(self.date_text).strip()
            try:
                date = datetime.strptime(f"{self.year} {text}", "%Y %B %d").date().isoformat()
                self.records[self.pending]["date"] = date
            except ValueError:
                pass
            self.date_text = None

def read_page(path: str, cache: Path) -> dict:
    file = cache / (re.sub(r"[^a-zA-Z0-9]", "_", path) + ".json")
    if file.exists():
        return json.loads(file.read_text())
    year = int(path.split("/")[3].split("?")[0])
    market = path.split("/")[2]
    for attempt in range(3):
        try:
            time.sleep(.4)
            html = get("https://peapix.com" + path).decode("utf-8-sig")
            parser = ArchiveParser(year)
            parser.feed(html)
            records = []
            for href, item in parser.records.items():
                if all(item.get(key) for key in ("title", "date", "imageURL")):
                    records.append(dict(item, pageURL="https://peapix.com" + href, edition=market))
            if not records and "couldn&#39;t find any images" not in html and "couldn't find any images" not in html:
                raise ValueError("No dated records and no explicit empty-archive message")
            expected = sum(bool(item.get("title")) for item in parser.records.values())
            if len(records) != expected:
                raise ValueError(f"Date/image missing for {expected-len(records)} records")
            last = max([int(href.split("?page=")[1]) for href in parser.links if href.startswith(path.split("?")[0] + "?page=") and href.split("?page=")[1].isdigit()], default=1)
            result = dict(path=path, records=records, lastPage=last)
            write_json(file, result)
            return result
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def merge_sources(existing: list[dict], incoming: list[dict]) -> list[dict]:
    photos = {item["imageURL"]: dict(item) for item in existing}
    captions = {title.casefold().strip(): item for item in photos.values() for title in item.get("archiveTitles", [item["title"]])}
    for row in incoming:
        image = row["imageURL"]
        previous = captions.get(row["title"].casefold().strip())
        if previous and urlparse(previous["imageURL"]).hostname != urlparse(image).hostname and abs((datetime.fromisoformat(row["date"]) - datetime.fromisoformat(previous["date"])).days) <= 3:
            image = previous["imageURL"]
        item = photos.get(image)
        if item is None:
            item = dict(title=row["title"], imageURL=image, thumbnailURL=row.get("thumbnailURL") or image.rsplit(".", 1)[0] + "_640.jpg", pageURL=row["pageURL"], date=row["date"], copyright=row.get("copyright") or "Photographer credit is available on the original Peapix page.", archiveTitles=[], editions=[])
            photos[image] = item
        if row["date"] > item["date"]:
            item.update(title=row["title"], date=row["date"], pageURL=row["pageURL"])
        if row.get("copyright"):
            item["copyright"] = row["copyright"]
        if row["title"] not in item["archiveTitles"]:
            item["archiveTitles"].append(row["title"])
        if row["edition"] not in item["editions"]:
            item["editions"].append(row["edition"])
        captions[row["title"].casefold().strip()] = item
    return sorted(photos.values(), key=lambda item: (item["date"], item["imageURL"]), reverse=True)

def bootstrap(cache: Path, first_year: int = 2010) -> list[dict]:
    cache.mkdir(parents=True, exist_ok=True)
    paths = [f"/bing/{market}/{year}" for market in MARKETS for year in range(first_year, datetime.now(timezone.utc).year + 1)]
    rows = []
    more = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        for page in executor.map(lambda path: read_page(path, cache), paths):
            rows.extend(page["records"])
            more.extend(page["path"] + f"?page={n}" for n in range(2, page["lastPage"] + 1))
    print(f"Scanning {len(more)} additional archive pages", flush=True)
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(read_page, path, cache): path for path in more}
        for count, future in enumerate(as_completed(futures), 1):
            rows.extend(future.result()["records"])
            if count % 75 == 0:
                print(f"Archive pages {count}/{len(more)}", flush=True)
    result = merge_sources([], rows)
    print(f"Collected {len(rows)} edition entries; {len(result)} distinct image files", flush=True)
    return result

def latest(existing: list[dict]) -> list[dict]:
    rows = []
    # Fail the shared update if any edition is inaccessible; don't advertise a
    # complete feed check while silently losing an edition's additions.
    for market in MARKETS:
        try:
            feed = json.loads(get(f"https://peapix.com/bing/feed?country={market}"))
            if not isinstance(feed, list) or not feed:
                raise ValueError(f"Empty feed for {market}")
            rows.extend(dict(title=item["title"], imageURL=item["imageUrl"], pageURL=item["pageUrl"], date=item["date"], copyright=item.get("copyright"), edition=market) for item in feed)
        except Exception as error:
            print(f"Peapix {market} unavailable ({type(error).__name__}); checking Bing directly", flush=True)
            locale = {"us":"en-US", "gb":"en-GB", "au":"en-AU", "ca":"en-CA", "in":"en-IN"}[market]
            feed = json.loads(get(f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt={locale}"))["images"]
            if not feed:
                raise ValueError(f"Neither source returned images for {market}")
            for item in feed:
                title = re.split(r"\s*\(©", item["copyright"])[0].strip()
                date = datetime.strptime(item["startdate"], "%Y%m%d").date().isoformat()
                url = "https://www.bing.com" + item["urlbase"] + "_UHD.jpg"
                rows.append(dict(title=title, imageURL=url, thumbnailURL=url, pageURL=item["copyrightlink"], date=date, copyright=item["copyright"], edition=market))
        time.sleep(.5)
    return merge_sources(existing, rows)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--cache", type=Path, default=Path("/tmp/world-lens-dated-archive"))
    parser.add_argument("--backfill-year", type=int)
    args = parser.parse_args()
    path = DATA / "source-photos.json"
    existing = json.loads(path.read_text()) if path.exists() else []
    if args.bootstrap:
        rows = bootstrap(args.cache)
    elif args.backfill_year:
        additions = bootstrap(args.cache, args.backfill_year)
        rows = merge_sources(existing, [dict(item, edition=edition) for item in additions for edition in item["editions"]])
    else:
        rows = latest(existing)
    if existing and len(rows) < len(existing):
        raise ValueError("Refusing to shrink the stored source archive")
    write_json(path, rows)
    print(f"Saved {len(rows)} source photos", flush=True)
