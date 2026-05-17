'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const { BROWSER_HEADERS, classifyTopic, normalizeArticle } = require('./shared')

/** RSS feeds that work from GitHub Actions / most networks */
const FEEDS = [
  {
    source: 'GMA',
    url: 'https://data.gmanews.tv/gno/rss/news/feed.xml',
  },
  {
    source: 'Rappler',
    url: 'https://www.rappler.com/nation/feed/',
  },
  {
    source: 'Google News',
    url: 'https://news.google.com/rss/search?q=water+OR+flood+OR+dam+Philippines&hl=en-PH&gl=PH&ceid=PH:en',
  },
  {
    source: 'Manila Bulletin',
    url: 'https://mb.com.ph/rss/news/nation',
  },
]

function parseRssItem(item, source) {
  const title = item.title?.trim() || ''
  let link = (item.link || item.guid || '').trim()
  if (link.includes('news.google.com')) {
    link = item.link || link
  }
  const summary = (item.description || item.contentSnippet || '')
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .slice(0, 2000)
  let publishedAt = new Date()
  if (item.pubDate) {
    const d = new Date(item.pubDate)
    if (!isNaN(d.getTime())) publishedAt = d
  }

  return normalizeArticle({
    url: link,
    title,
    summary,
    source,
    topic: classifyTopic(`${title} ${summary}`),
    publishedAt,
    imageUrl: null,
  })
}

async function scrapeRssFeed({ source, url }) {
  try {
    const { data } = await axios.get(url, {
      timeout: 30000,
      headers: BROWSER_HEADERS,
      responseType: 'text',
    })
    const $ = cheerio.load(data, { xmlMode: true })
    const out = []

    $('item').each((_, el) => {
      const item = {
        title: $(el).find('title').first().text(),
        link: $(el).find('link').first().text(),
        description: $(el).find('description').first().text(),
        pubDate: $(el).find('pubDate').first().text(),
        guid: $(el).find('guid').first().text(),
      }
      const norm = parseRssItem(item, source)
      if (norm) out.push(norm)
    })

    console.log(`RSS ${source}: ${out.length} relevant articles`)
    return out
  } catch (err) {
    console.error(`RSS ${source} failed:`, err.message || err)
    return []
  }
}

async function scrapeAllRssFeeds() {
  const parts = await Promise.all(FEEDS.map(scrapeRssFeed))
  return parts.flat()
}

module.exports = { scrapeAllRssFeeds, FEEDS }
