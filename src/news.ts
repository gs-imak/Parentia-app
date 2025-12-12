import { XMLParser } from 'fast-xml-parser';
import he from 'he';

const LEMONDE_URL = 'https://www.lemonde.fr/rss/une.xml';
const FRANCEINFO_URL = 'https://www.francetvinfo.fr/titres.rss';

const NEWS_FETCH_TIMEOUT_MS = 8_000;
const NEWS_CACHE_TTL_MS = 5 * 60 * 1_000;

export interface NewsItem {
  title: string;
  link: string;
  source: 'Le Monde' | 'France Info';
  publishedAt: string; // ISO string
  summary: string | null;
}

interface RssItemRaw {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

let cachedNews: { items: NewsItem[]; fetchedAt: number } | null = null;

async function fetchRss(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some RSS providers reject requests without a UA.
        'User-Agent': 'Mozilla/5.0 ParentiaBot/1.0',
        Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7',
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur RSS (${url}): ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseRss(xml: string, source: 'Le Monde' | 'France Info'): NewsItem[] {
  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    const data = parser.parse(xml);

    const channel = data?.rss?.channel;
    if (!channel) return [];

    const rawItems: RssItemRaw[] = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

    return rawItems
      .map((item) => {
        const rawTitle = item.title?.toString().trim();
        const link = item.link?.toString().trim();
        const pubDate = item.pubDate?.toString().trim();
        if (!rawTitle || !link || !pubDate) return null;

        const title = he.decode(rawTitle);
        const rawDescription = item.description?.toString().trim();
        const description = rawDescription ? he.decode(rawDescription) : null;

        const date = new Date(pubDate);
        if (Number.isNaN(date.getTime())) return null;
        const publishedAt = date.toISOString();

        return {
          title,
          link,
          source,
          publishedAt,
          summary: description,
        } satisfies NewsItem;
      })
      .filter((item): item is NewsItem => item !== null);
  } catch (err) {
    console.error('[News] Failed to parse RSS', source, err);
    return [];
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function summarizeWithAI(text: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Résume en une phrase courte en français, compréhensible pour des parents pressés.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') return null;
  return content.trim();
}

async function safeFetchAndParse(url: string, source: 'Le Monde' | 'France Info'): Promise<NewsItem[]> {
  try {
    const xml = await fetchRss(url);
    return parseRss(xml, source);
  } catch (err) {
    console.error('[News] RSS fetch failed', source, url, err);
    return [];
  }
}

// Keywords for major news filtering
const MAJOR_NEWS_KEYWORDS = [
  'international',
  'guerre',
  'économie',
  'politique',
  'monde',
  'france',
  'conflit',
  'crise',
  'election',
  'président',
  'gouvernement',
];

function isMajorNews(item: NewsItem): boolean {
  const textToCheck = `${item.title} ${item.summary ?? ''}`.toLowerCase();
  return MAJOR_NEWS_KEYWORDS.some(keyword => textToCheck.includes(keyword));
}

// Simple title similarity check (Levenshtein-like but simpler)
function areTitlesSimilar(title1: string, title2: string): boolean {
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const t1 = normalize(title1);
  const t2 = normalize(title2);
  
  // If titles are very short, require exact match
  if (t1.length < 20 || t2.length < 20) {
    return t1 === t2;
  }
  
  // Check if one title contains most of the other (80% overlap)
  const words1 = new Set(t1.split(/\s+/));
  const words2 = new Set(t2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const minSize = Math.min(words1.size, words2.size);
  
  if (minSize === 0) return false;
  
  const similarity = intersection.size / minSize;
  return similarity >= 0.75; // 75% word overlap = considered duplicate
}

function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const unique: NewsItem[] = [];
  
  for (const item of items) {
    const isDuplicate = unique.some(existing => areTitlesSimilar(existing.title, item.title));
    if (!isDuplicate) {
      unique.push(item);
    }
  }
  
  return unique;
}

export async function getTopNews(): Promise<NewsItem[]> {
  // Serve cached news if still fresh (prevents flakiness and repeated RSS hits)
  const now = Date.now();
  if (cachedNews && now - cachedNews.fetchedAt <= NEWS_CACHE_TTL_MS) {
    return cachedNews.items;
  }

  const [lemondeItems, franceInfoItems] = await Promise.all([
    safeFetchAndParse(LEMONDE_URL, 'Le Monde'),
    safeFetchAndParse(FRANCEINFO_URL, 'France Info'),
  ]);

  const merged = [...lemondeItems, ...franceInfoItems];
  if (merged.length === 0) {
    // If RSS is temporarily blocked/down, fall back to last cached value.
    if (cachedNews) return cachedNews.items;
    return [];
  }
  
  // Remove duplicates before filtering
  const deduplicated = deduplicateNews(merged);
  
  // Filter for major news first
  const majorNews = deduplicated.filter(isMajorNews);
  
  // If we have enough major news, use those; otherwise fall back to all news
  const newsToUse = majorNews.length >= 3 ? majorNews : deduplicated;
  
  const sorted = newsToUse.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const topThree = sorted.slice(0, 3);

  const withSummaries = await Promise.all(
    topThree.map(async (item) => {
      if (!OPENAI_API_KEY) return item;
      try {
        const summary = await summarizeWithAI(`${item.title}\n${item.summary ?? ''}`.trim());
        return { ...item, summary: summary ?? item.summary } as NewsItem;
      } catch (err) {
        console.error('[News] AI summary failed', err);
        return item;
      }
    })
  );

  cachedNews = { items: withSummaries, fetchedAt: now };
  return withSummaries;
}
