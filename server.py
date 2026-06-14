"""FastMCP server that exposes Bing Image of the Day data from peapix.com."""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

import httpx
from bs4 import BeautifulSoup
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("bing-images")

BASE_URL = "https://peapix.com"
USER_AGENT = (
    "Mozilla/5.0 (compatible; BingImagesMCP/1.0; "
    "+https://github.com/sanzgiri/bing-images-mcp-server)"
)
DEFAULT_HEADERS = {"user-agent": USER_AGENT, "accept": "text/html"}


def _http_get(url: str) -> httpx.Response:
    """Perform a GET with shared client settings."""
    with httpx.Client(headers=DEFAULT_HEADERS, timeout=15.0) as client:
        response = client.get(url, follow_redirects=True)
        response.raise_for_status()
        return response


def _extract_text(node) -> str | None:
    if node is None:
        return None
    text = node.get_text(strip=True)
    return text or None


def get_image_details(url: str) -> dict[str, Any]:
    """Fetch image details from a specific peapix image page."""
    try:
        response = _http_get(url)
    except Exception as exc:  # pragma: no cover - network failure path
        return {"error": str(exc), "page_url": url}

    soup = BeautifulSoup(response.text, "html.parser")

    og_image = soup.find("meta", property="og:image")
    image_url = og_image["content"] if og_image and og_image.has_attr("content") else None

    og_desc = soup.find("meta", property="og:description")
    meta_desc = soup.find("meta", attrs={"name": "description"})
    description = None
    if og_desc and og_desc.has_attr("content"):
        description = og_desc["content"].strip() or None
    if not description and meta_desc and meta_desc.has_attr("content"):
        description = meta_desc["content"].strip() or None

    title = _extract_text(soup.find("h1")) or "Unknown Title"

    # Long-form story (used to ground quiz questions).
    paragraphs = [
        text
        for text in (_extract_text(p) for p in soup.find_all("p"))
        if text and len(text) > 40
    ]
    full_description = "\n\n".join(paragraphs[:4]) if paragraphs else None

    return {
        "title": title,
        "image_url": image_url,
        "description": description,
        "full_description": full_description,
        "page_url": url,
    }


def _find_image_link_for_date(soup: BeautifulSoup, target_date_str: str) -> str | None:
    """Find the /bing/<id> link whose surrounding text contains the date string."""
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if href.startswith("/bing/") and href[len("/bing/") :].isdigit():
            parent_text = anchor.parent.get_text(" ", strip=True) if anchor.parent else ""
            if target_date_str in parent_text:
                return href
    return None


def _find_first_image_link(soup: BeautifulSoup) -> str | None:
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if href.startswith("/bing/") and href[len("/bing/") :].isdigit():
            return href
    return None


@mcp.tool()
def get_bing_image(country: str, date: str) -> str:
    """Fetch the Bing image of the day for a country (2-letter code) and date (YYYY-MM-DD)."""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        return json.dumps({"error": "Date must be in YYYY-MM-DD format."})

    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
    except ValueError as exc:
        return json.dumps({"error": f"Invalid date: {exc}"})

    year, month, _ = date.split("-")
    list_url = f"{BASE_URL}/bing/{country}/{year}/{month}"
    target_date_str = date_obj.strftime("%B %d")

    try:
        response = _http_get(list_url)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return json.dumps(
                {"error": f"No data found for country '{country}' in {year}-{month}."}
            )
        return json.dumps({"error": f"HTTP error: {exc}"})
    except Exception as exc:  # pragma: no cover
        return json.dumps({"error": f"Error fetching data: {exc}"})

    soup = BeautifulSoup(response.text, "html.parser")
    href = _find_image_link_for_date(soup, target_date_str)
    if not href:
        return json.dumps({"error": f"Image for date {date} not found."})

    details = get_image_details(f"{BASE_URL}{href}")
    return json.dumps(details)


@mcp.tool()
def get_latest_bing_image(country: str) -> str:
    """Fetch the latest Bing image of the day for a country (2-letter code)."""
    list_url = f"{BASE_URL}/bing/{country}"
    try:
        response = _http_get(list_url)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

    soup = BeautifulSoup(response.text, "html.parser")
    href = _find_first_image_link(soup)
    if not href:
        return json.dumps({"error": "No images found."})

    details = get_image_details(f"{BASE_URL}{href}")
    return json.dumps(details)


if __name__ == "__main__":
    mcp.run()
