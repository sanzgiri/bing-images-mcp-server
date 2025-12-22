import httpx
from bs4 import BeautifulSoup
import sys
import os

# Add current directory to path to import server
sys.path.append(os.getcwd())
from server import get_latest_bing_image, get_bing_image

def test_latest_us():
    print("Testing get_latest_bing_image('us')...")
    result = get_latest_bing_image('us')
    print(result)

def test_specific_date():
    print("\nTesting get_bing_image('us', '2023-01-01')...")
    # This is expected to be experimental/limited in the current implementation
    result = get_bing_image('us', '2023-01-01')
    print(result)

if __name__ == "__main__":
    test_latest_us()
    test_specific_date()
