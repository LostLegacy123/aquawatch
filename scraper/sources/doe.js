'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const { classifyTopic, normalizeArticle } = require('./shared')

const BASE = 'https://www.doe.gov.ph'
const LIST_URL = `${BASE}/news-and-updates`

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

module.exports.scrapeDOE = async function scrapeDOE() {
  try {
    const { data: html } = await axios.get(LIST_URL, axiosOpts)
    const $ = cheerio.load(html)
    const out = []
    const seen = new Set()

    const tryRow = ($root) => {
      const titleA =
        $root.find('.field--name-title a').first().length
          ? $root.find('.field--name-title a').first()
          : $root.find('h2 a, h3 a').first()
      let title = titleA.text().trim()
      let href = titleA.attr('href')
      if (!title && $root.is('a')) {
        title = $root.text().trim()
        href = $root.attr('href')
      }
      const link = absUrl(href)
      if (!title || !link || seen.has(link)) return
      seen.add(link)
      let pub = null
      const timeEl = $root.find('time[datetime]').first()
      if (timeEl.length) {
        const d = new Date(timeEl.attr('datetime'))
        if (!isNaN(d.getTime())) pub = d
      } else {
        const ds = $root.find('.date-display-single').first().text().trim()
        if (ds) {
          const d = new Date(ds)
          if (!isNaN(d.getTime())) pub = d
        }
      }
      let summary = ''
      const p = $root.find('.field--name-body p, .field--type-text-with-summary p, p').first()
      if (p.length) summary = p.text().trim()
      const img = $root.find('img').first().attr('src')
      const norm = normalizeArticle({
        url: link,
        title,
        summary,
        source: 'DOE',
        topic: classifyTopic(`${title} ${summary}`),
        publishedAt: pub || new Date(),
        imageUrl: img ? absUrl(img) : null,
      })
      if (norm) out.push(norm)
    }

    $('article').each((_, el) => tryRow($(el)))
    if (out.length === 0) {
      $('.views-row').each((_, el) => tryRow($(el)))
    }
    if (out.length === 0) {
      $('.field--name-title a').each((_, el) => tryRow($(el).closest('.views-row, article, li, div')))
    }

    return out
  } catch {
    return []
  }
}
