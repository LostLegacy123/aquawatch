'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const { classifyTopic, normalizeArticle } = require('./shared')

const BASE = 'https://mb.com.ph'
const LIST_URL = `${BASE}/?s=water`

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

module.exports.scrapeManilaBulletin = async function scrapeManilaBulletin() {
  try {
    const { data: html } = await axios.get(LIST_URL, axiosOpts)
    const $ = cheerio.load(html)
    const out = []
    const seen = new Set()

    const processBlock = ($el) => {
      let a = $el.find('h3.entry-title a, h2 a, h3 a').first()
      if (!a.length) a = $el.find('a').first()
      const title = a.text().trim()
      const href = absUrl(a.attr('href'))
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
        source: 'Manila Bulletin',
        topic: classifyTopic(`${title} ${summary}`),
        publishedAt: pub || new Date(),
        imageUrl: img ? absUrl(img) : null,
      })
      if (norm) out.push(norm)
    }

    $('article').each((_, el) => processBlock($(el)))
    if (out.length === 0) {
      $('.td-block-span6').each((_, el) => processBlock($(el)))
    }
    if (out.length === 0) {
      $('h3.entry-title a').each((_, el) =>
        processBlock($(el).closest('article, div, li')),
      )
    }

    return out
  } catch {
    return []
  }
}
