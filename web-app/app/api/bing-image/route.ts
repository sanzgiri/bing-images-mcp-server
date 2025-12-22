import { NextResponse } from 'next/server';
import { getBingImage } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const BASE_URL = 'https://peapix.com';

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

function extractFirstImageLink(html: string) {
  const match = html.match(/href="(\/bing\/\d+)"/i);
  return match?.[1] ?? null;
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
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return {
    title: titleMatch ? stripTags(titleMatch[1]) : 'Unknown Title',
    image_url: ogMatch?.[1] ?? null,
    page_url: pageUrl,
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.text();
}

async function fetchDirect(country: string, date?: string) {
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
  const country = searchParams.get('country') ?? 'us';
  const date = searchParams.get('date') ?? undefined;
  const useMcp = (process.env.USE_MCP ?? '').toLowerCase() === 'true';

  try {
    if (useMcp) {
      const data = await getBingImage(country, date ?? undefined);
      if (!data) {
        return NextResponse.json({ error: 'Failed to fetch image.' }, { status: 502 });
      }
      return NextResponse.json(JSON.parse(data));
    }

    const details = await fetchDirect(country, date ?? undefined);
    if (!details) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json({ error: 'Failed to fetch image.' }, { status: 502 });
  }
}
