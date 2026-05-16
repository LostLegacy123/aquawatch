'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const { classifyTopic, normalizeArticle } = require('./shared')

const URLS = [
  'https://news.abs-cbn.com/tag/water',
  'https://news.abs-cbn.com/tag/flood',
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
      let a = $el.find('h2 a, h3 a').first()
      if (!a.length) a = $el.find('a').first()
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
        source: 'ABS-CBN',
        topic: classifyTopic(`${title} ${summary}`),
        publishedAt: pub || new Date(),
        imageUrl: img ? absUrl(img, base) : null,
      })
      if (norm) out.push(norm)
    }

    $('.news-item, article, .card').each((_, el) => processBlock($(el)))
    if (out.length === 0) {
      $('h2 a, h3 a').each((_, el) => processBlock($(el).parent().parent()))
    }
    return out
  } catch {
    return []
  }
}

module.exports.scrapeABSCBN = async function scrapeABSCBN() {
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
