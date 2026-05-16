'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const { classifyTopic, normalizeArticle } = require('./shared')

const axiosOpts = {
  timeout: 25000,
  headers: {
    'User-Agent': 'AquaWatchPH-Scraper/1.0 (educational)',
    Accept: 'text/html,application/xhtml+xml',
  },
}

const DISTRICTS = [
  { label: 'MCWD', base: 'https://www.mcwd.gov.ph', path: '/news' },
  { label: 'DCWD', base: 'https://dcwd.gov.ph', path: '/news' },
  { label: 'BWD', base: 'https://bwd.gov.ph', path: '/news' },
  { label: 'MWSS', base: 'https://www.mwss.gov.ph', path: '/news' },
  { label: 'PAMPANGA WD', base: 'https://www.pawd.gov.ph', path: '/news' },
]

function absUrl(href, base) {
  if (!href) return ''
  try {
    return new URL(href, base).href
  } catch {
    return ''
  }
}

async function scrapeOneDistrict({ label, base, path }) {
  try {
    const url = `${base}${path}`
    const { data: html } = await axios.get(url, axiosOpts)
    const $ = cheerio.load(html)
    const out = []
    const seen = new Set()

    $('article, .views-row, .news-item, .post, li').each((_, el) => {
      const $el = $(el)
      const a = $el.find('h2 a, h3 a, .entry-title a, .post-title a, a').first()
      const title = a.text().trim()
      const href = absUrl(a.attr('href'), base)
      if (!title || !href || seen.has(href)) return
      if (href === `${base}/` || href === base) return
      seen.add(href)
      const summary = $el.find('p').first().text().trim()
      const timeEl = $el.find('time[datetime]').first()
      let pub = null
      if (timeEl.length) {
        const d = new Date(timeEl.attr('datetime'))
        if (!isNaN(d.getTime())) pub = d
      }
      const img = $el.find('img').first().attr('src')
      const topic = classifyTopic(`${title} ${summary}`)
      const norm = normalizeArticle({
        url: href,
        title,
        summary,
        source: label,
        topic,
        publishedAt: pub || new Date(),
        imageUrl: img ? absUrl(img, base) : null,
      })
      if (norm) out.push(norm)
    })

    return out
  } catch {
    return []
  }
}

module.exports.scrapeWaterDistricts = async function scrapeWaterDistricts() {
  const combined = []
  for (const d of DISTRICTS) {
    try {
      const part = await scrapeOneDistrict(d)
      combined.push(...part)
    } catch {
      /* skip */
    }
  }
  return combined
}
