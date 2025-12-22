import httpx
from bs4 import BeautifulSoup

url = "https://peapix.com/bing/us/2023/01"
response = httpx.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

print(f"Inspecting {url}")

# Find all image links
# They usually look like /bing/ID
links = soup.find_all('a', href=True)
for i, a in enumerate(links):
    href = a['href']
    if href.startswith('/bing/') and href[6:].isdigit():
        print(f"Link {i}: {href}")
        print(f"  Text: {a.get_text(strip=True)}")
        print(f"  Title: {a.get('title')}")
        print(f"  Parent Text: {a.parent.get_text(strip=True)}")
        # Check previous sibling or parent's previous sibling for date
        # Sometimes date is in a separate element
        print("-" * 20)
