'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const { classifyTopic, normalizeArticle } = require('./shared')

const BASE = 'https://www.denr.gov.ph'
const LIST_URL = `${BASE}/index.php/news-and-features/latest-news`

const axiosOpts = {
  timeout: 25000,
  headers: {
    'User-Agent': 'AquaWatchPH-Scraper/1.0 (educational)',
    Accept: 'text/html,application/xhtml+xml',
  },
}

function absUrl(href) {
  if (!href) return ''
  try {
    return new URL(href, BASE).href
  } catch {
    return ''
  }
}

module.exports.scrapeDENR = async function scrapeDENR() {
  try {
    const { data: html } = await axios.get(LIST_URL, axiosOpts)
    const $ = cheerio.load(html)
    const out = []
    const seen = new Set()

    $('article, .article-item, .views-row, .news-item, li, tr').each((_, el) => {
      const $el = $(el)
      const a = $el.find('h2 a, h3 a, h4 a, .title a, a').first()
      const title = a.text().trim()
      const href = absUrl(a.attr('href'))
      if (!title || !href || href === LIST_URL || seen.has(href)) return
      if (title.length < 8) return
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
        source: 'DENR',
        topic: classifyTopic(`${title} ${summary}`),
        publishedAt: pub || new Date(),
        imageUrl: img ? absUrl(img) : null,
      })
      if (norm) out.push(norm)
    })

    return out
  } catch {
    return []
  }
}
