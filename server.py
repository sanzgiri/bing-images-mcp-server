import httpx
from bs4 import BeautifulSoup
from mcp.server.fastmcp import FastMCP
import re

# Initialize FastMCP server
mcp = FastMCP("bing-images")

BASE_URL = "https://peapix.com"

def get_image_details(url: str) -> dict:
    """
    Fetches image details from a specific image page on peapix.com.
    """
    try:
        with httpx.Client() as client:
            response = client.get(url, follow_redirects=True)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find the image URL - usually in an og:image meta tag or a specific img tag
            # Peapix seems to have high res images.
            # Looking at the structure from previous steps, we need to find the download link or the main image.
            
            # Strategy: Look for the main image container
            # Based on typical structure, there might be a 'download' button or similar.
            # Let's try to find the largest image or the one that looks like the wallpaper.
            
            # Often og:image is a good fallback
            og_image = soup.find("meta", property="og:image")
            image_url = og_image["content"] if og_image else None
            
            # Title
            title_tag = soup.find("h1")
            title = title_tag.get_text(strip=True) if title_tag else "Unknown Title"
            
            # Description/Copyright - often in a paragraph or div below
            # This might require more specific parsing if we want exact details, 
            # but for now let's return what we can find.
            
            return {
                "title": title,
                "image_url": image_url,
                "page_url": url
            }
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
def get_bing_image(country: str, date: str) -> str:
    """
    Fetches the Bing image of the day for a specific country and date.
    
    Args:
        country: The 2-letter country code (e.g., 'us', 'gb', 'de', 'fr', 'jp', 'au', 'ca', 'cn', 'in').
        date: The date in YYYY-MM-DD format.
    
    Returns:
        A string containing the image details (Title, Image URL, Page URL) or an error message.
    """
    # Validate date format
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        return "Error: Date must be in YYYY-MM-DD format."
    
    year, month, day = date.split("-")
    
    # Construct the monthly list URL to find the specific day
    # Peapix structure: https://peapix.com/bing/[country]/[year]/[month]
    list_url = f"{BASE_URL}/bing/{country}/{year}/{month}"
    
    # Parse date to get Month Name and Day (e.g., "January 01")
    from datetime import datetime
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    target_date_str = date_obj.strftime("%B %d") # e.g., "January 01"
    
    try:
        with httpx.Client() as client:
            response = client.get(list_url, follow_redirects=True)
            if response.status_code == 404:
                return f"Error: No data found for country '{country}' in {year}-{month}."
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find the link that corresponds to the date
            # The parent text usually contains the date like "DescriptionJanuary 01"
            for a in soup.find_all('a', href=True):
                href = a['href']
                if href.startswith('/bing/') and href[6:].isdigit():
                    parent_text = a.parent.get_text(strip=True)
                    if target_date_str in parent_text:
                        image_page_url = f"{BASE_URL}{href}"
                        details = get_image_details(image_page_url)
                        return json.dumps(details)
            
            return json.dumps({"error": f"Image for date {date} not found on the page."})

    except Exception as e:
        return json.dumps({"error": f"Error fetching data: {str(e)}"})

    except Exception as e:
        return f"Error fetching data: {str(e)}"

import json

@mcp.tool()
def get_latest_bing_image(country: str) -> str:
    """
    Fetches the latest Bing image of the day for a specific country.
    """
    url = f"{BASE_URL}/bing/{country}"
    try:
        with httpx.Client() as client:
            response = client.get(url, follow_redirects=True)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # The first image in the gallery is usually the latest.
            # Look for the first link that matches /bing/\d+
            for a in soup.find_all('a', href=True):
                href = a['href']
                if href.startswith('/bing/') and href[6:].isdigit():
                    image_page_url = f"{BASE_URL}{href}"
                    details = get_image_details(image_page_url)
                    return json.dumps(details)
            
            return json.dumps({"error": "No images found."})
            
    except Exception as e:
        return json.dumps({"error": str(e)})

if __name__ == "__main__":
    mcp.run()
