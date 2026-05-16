'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const { classifyTopic, normalizeArticle } = require('./shared')

const URLS = [
  'https://www.gmanetwork.com/news/hashtag/water/',
  'https://www.gmanetwork.com/news/hashtag/flood/',
]

const axiosOpts = {
  timeout: 25000,
  headers: {
    'User-Agent': 'AquaWatchPH-Scraper/1.0 (educational)',
    Accept: 'text/html,application/xhtml+xml',
  },
}

function absUrl(href, base) {
  if (!href) return ''
  try {
    return new URL(href, base).href
  } catch {
    return ''
  }
}

async function scrapeUrl(listUrl) {
  try {
    const { data: html } = await axios.get(listUrl, axiosOpts)
    const $ = cheerio.load(html)
    const out = []
    const seen = new Set()
    const base = new URL(listUrl).origin

    const processBlock = ($el) => {
      const a = $el.find('.story-title a, h2 a, h3 a, a').first()
      const title = a.text().trim()
      const href = absUrl(a.attr('href'), base)
      if (!title || !href || seen.has(href)) return
      seen.add(href)
      const summary = $el.find('p').first().text().trim()
      const timeEl = $el.find('time[datetime]').first()
      let pub = null
      if (timeEl.length) {
        const d = new Date(timeEl.attr('datetime'))
        if (!isNaN(d.getTime())) pub = d
      }
      const img = $el.find('img').first().attr('src')
      const norm = normalizeArticle({
        url: href,
        title,
        summary,
        source: 'GMA',
        topic: classifyTopic(`${title} ${summary}`),
        publishedAt: pub || new Date(),
        imageUrl: img ? absUrl(img, base) : null,
      })
      if (norm) out.push(norm)
    }

    $('.story-block, article').each((_, el) => processBlock($(el)))
    $('article h2 a').each((_, el) => {
      processBlock($(el).closest('article, .story-block, li, div'))
    })
    return out
  } catch {
    return []
  }
}

module.exports.scrapeGMA = async function scrapeGMA() {
  const combined = []
  for (const u of URLS) {
    try {
      combined.push(...(await scrapeUrl(u)))
    } catch {
      /* skip */
    }
  }
  return combined
}
