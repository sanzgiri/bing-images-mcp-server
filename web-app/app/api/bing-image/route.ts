import { NextResponse } from 'next/server';

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

function extractStory(html: string) {
  const storyBlock =
    html.match(/<div[^>]+class=["'][^"']*story[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ??
    html.match(
      /<div[^>]+class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
  if (!storyBlock) {
    return null;
  }
  const paragraphMatches = [...storyBlock[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paragraphMatches.length === 0) {
    const text = stripTags(storyBlock[1]);
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
  const storyMatch = extractStory(html);
  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const bodyDesc =
    html.match(
      /<(?:p|div)[^>]+class=["'][^"']*(?:description|desc)[^"']*["'][^>]*>(.*?)<\/(?:p|div)>/i
    ) ??
    (storyMatch ? [storyMatch, storyMatch] : null) ??
    (paragraphMatch ? [paragraphMatch[0], paragraphMatch[1]] : null);
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const description = ogDesc?.[1] ?? metaDesc?.[1] ?? (bodyDesc ? stripTags(bodyDesc[1]) : null);
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
        'Mozilla/5.0 (compatible; BingExplorer/1.0; +https://github.com/sanzgiri/bing-images-mcp-server)',
      accept: 'text/html',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.text();
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
