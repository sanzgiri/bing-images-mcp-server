import { NextResponse } from 'next/server';
import { mcpGetImage, mcpGetLatestImage } from '@/lib/mcpClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const BASE_URL = 'https://peapix.com';

const SUPPORTED_COUNTRIES = [
  'us',
  'gb',
  'de',
  'fr',
  'jp',
  'au',
  'ca',
  'cn',
  'in',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, '').trim();
}

function findInfoBlock(html: string) {
  const blocks = [
    ...html.matchAll(
      /<div[^>]+class=["'][^"']*position-relative[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
    ),
  ];
  for (const match of blocks) {
    const body = match[1];
    if (/<h3[^>]*>[\s\S]*?<\/h3>/i.test(body) || /<p[^>]*>/i.test(body)) {
      return body;
    }
  }
  const storyBlock =
    html.match(/<div[^>]+class=["'][^"']*story[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ??
    html.match(
      /<div[^>]+class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
  return storyBlock ? storyBlock[1] : null;
}

function extractStory(html: string) {
  const block = findInfoBlock(html);
  if (!block) {
    return null;
  }
  const paragraphMatches = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paragraphMatches.length === 0) {
    const text = stripTags(block);
    return text ? text : null;
  }
  const paragraphs = paragraphMatches
    .map((match) => stripTags(match[1]))
    .filter((text) => text.length > 0);
  return paragraphs.length ? paragraphs.join('\n\n') : null;
}

function extractFirstImageLink(html: string) {
  const match = html.match(/href="(\/bing\/\d+)"/i);
  return match?.[1] ?? null;
}

function extractAllImageLinks(html: string) {
  const regex = /href="(\/bing\/\d+)"/gi;
  const links = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    links.add(match[1]);
  }
  return Array.from(links);
}

function extractImageLinkByDate(html: string, date: string) {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  const targetDate = `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}`;
  const regex = /href="(\/bing\/\d+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const slice = html.slice(match.index, match.index + 300);
    if (slice.includes(targetDate)) {
      return match[1];
    }
  }
  return null;
}

function extractImageDetails(html: string, pageUrl: string) {
  const ogMatch = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = html.match(/property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const metaDesc = html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const infoBlock = findInfoBlock(html);
  const subtitleMatch = infoBlock ? infoBlock.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) : null;
  const storyMatch = extractStory(html);
  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const bodyDesc =
    html.match(
      /<(?:p|div)[^>]+class=["'][^"']*(?:description|desc)[^"']*["'][^>]*>(.*?)<\/(?:p|div)>/i
    ) ??
    (storyMatch ? [storyMatch, storyMatch] : null) ??
    (paragraphMatch ? [paragraphMatch[0], paragraphMatch[1]] : null);
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const description =
    ogDesc?.[1] ??
    metaDesc?.[1] ??
    (subtitleMatch ? stripTags(subtitleMatch[1]) : null) ??
    (bodyDesc ? stripTags(bodyDesc[1]) : null);
  const fullDescription =
    storyMatch && (!description || storyMatch.length > description.length + 40)
      ? storyMatch
      : null;
  return {
    title: titleMatch ? stripTags(titleMatch[1]) : 'Unknown Title',
    image_url: ogMatch?.[1] ?? null,
    description,
    full_description: fullDescription,
    page_url: pageUrl,
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

// ---------------------------------------------------------------------------
// Peapix's public JSON feed. This is far more reliable than HTML scraping
// (and survives bot-filtering on serverless platforms like Vercel).
//   GET /bing/feed?country=us[&date=YYYY-MM-DD]
// Returns an array of items (newest first) shaped like:
//   { title, copyright, fullUrl, thumbUrl, imageUrl, pageUrl, date }
// ---------------------------------------------------------------------------
interface FeedItem {
  title: string;
  copyright?: string;
  fullUrl?: string;
  thumbUrl?: string;
  imageUrl?: string;
  pageUrl: string;
  date: string;
}

async function fetchFeed(country: string): Promise<FeedItem[]> {
  const url = `${BASE_URL}/bing/feed?country=${encodeURIComponent(country)}`;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'application/json,*/*;q=0.9',
    },
  });
  if (!response.ok) {
    throw new Error(`Feed fetch failed: HTTP ${response.status}`);
  }
  const data = (await response.json()) as FeedItem[];
  return Array.isArray(data) ? data : [];
}

function feedItemToDetails(item: FeedItem) {
  const description = item.copyright?.trim() || null;
  return {
    title: item.title,
    image_url: item.fullUrl ?? item.imageUrl ?? item.thumbUrl ?? null,
    description,
    full_description: null as string | null,
    page_url: item.pageUrl,
  };
}

/** Try to enrich the basic feed item with the long story from the HTML page. */
async function enrichWithStory(
  details: ReturnType<typeof feedItemToDetails>
): Promise<ReturnType<typeof feedItemToDetails>> {
  if (!details.page_url) return details;
  try {
    const html = await fetchHtml(details.page_url);
    const story = extractStory(html);
    if (story) {
      return { ...details, full_description: story };
    }
  } catch (err) {
    console.warn('Story enrichment failed (non-fatal):', err);
  }
  return details;
}

async function fetchViaFeed(
  country: string,
  mode: 'latest' | 'random' | string
) {
  const items = await fetchFeed(country);
  if (!items.length) return null;

  let pick: FeedItem | undefined;
  if (mode === 'random') {
    pick = items[Math.floor(Math.random() * items.length)];
  } else if (mode === 'latest') {
    pick = items[0];
  } else {
    // mode is a date string YYYY-MM-DD
    pick = items.find((it) => it.date === mode) ?? undefined;
  }
  if (!pick) return null;

  const base = feedItemToDetails(pick);
  return enrichWithStory(base);
}

async function fetchDirect(country: string, date?: string) {
  if (date === 'random') {
    const listUrl = `${BASE_URL}/bing/${country}`;
    const listHtml = await fetchHtml(listUrl);
    const links = extractAllImageLinks(listHtml);
    if (!links.length) {
      return null;
    }
    const link = links[Math.floor(Math.random() * links.length)];
    const pageUrl = `${BASE_URL}${link}`;
    const pageHtml = await fetchHtml(pageUrl);
    return extractImageDetails(pageHtml, pageUrl);
  }
  if (date) {
    const [year, month] = date.split('-');
    const listUrl = `${BASE_URL}/bing/${country}/${year}/${month}`;
    const listHtml = await fetchHtml(listUrl);
    const link = extractImageLinkByDate(listHtml, date);
    if (!link) {
      return null;
    }
    const pageUrl = `${BASE_URL}${link}`;
    const pageHtml = await fetchHtml(pageUrl);
    return extractImageDetails(pageHtml, pageUrl);
  }

  const listUrl = `${BASE_URL}/bing/${country}`;
  const listHtml = await fetchHtml(listUrl);
  const link = extractFirstImageLink(listHtml);
  if (!link) {
    return null;
  }
  const pageUrl = `${BASE_URL}${link}`;
  const pageHtml = await fetchHtml(pageUrl);
  return extractImageDetails(pageHtml, pageUrl);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const randomCountry = (searchParams.get('randomCountry') ?? '').toLowerCase() === 'true';
  const countryParam = (searchParams.get('country') ?? 'us').toLowerCase();
  const date = searchParams.get('date') ?? undefined;
  const random = (searchParams.get('random') ?? '').toLowerCase() === 'true';
  const country =
    randomCountry || countryParam === 'random'
      ? SUPPORTED_COUNTRIES[Math.floor(Math.random() * SUPPORTED_COUNTRIES.length)]
      : countryParam;

  try {
    // 1) Primary: Peapix's JSON feed — reliable on Vercel and easy to parse.
    try {
      const mode = random ? 'random' : date ?? 'latest';
      const viaFeed = await fetchViaFeed(country, mode);
      if (viaFeed && viaFeed.image_url) {
        return NextResponse.json(viaFeed);
      }
    } catch (feedErr) {
      console.warn('Feed path failed, will try MCP/HTML next:', feedErr);
    }

    // 2) Optional: MCP server (if MCP_SERVER_URL is set and mode != random).
    if (process.env.MCP_SERVER_URL && !random) {
      const viaMcp = date
        ? await mcpGetImage(country, date)
        : await mcpGetLatestImage(country);
      if (viaMcp && viaMcp.image_url) {
        return NextResponse.json(viaMcp);
      }
    }

    // 3) Last resort: in-process HTML scraper.
    const details = await fetchDirect(country, random ? 'random' : date ?? undefined);
    if (!details) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch (error) {
    console.error('Error fetching image:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch image.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
