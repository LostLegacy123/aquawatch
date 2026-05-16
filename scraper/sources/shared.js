'use strict'

const KEYWORDS = [
  'water',
  'wind',
  'flood',
  'dam',
  'reservoir',
  'drought',
  'rainfall',
  'irrigation',
  'pipeline',
  'water district',
  'lwua',
  'waterworks',
  'turbine',
  'wind farm',
  'renewable energy',
  'water supply',
  'water shortage',
]

function classifyTopic(text) {
  const t = String(text).toLowerCase()
  if (
    t.includes('wind') ||
    t.includes('turbine') ||
    t.includes('wind farm') ||
    t.includes('wind energy')
  ) {
    return 'Wind Projects'
  }
  if (
    t.includes('water district') ||
    t.includes('lwua') ||
    t.includes('waterworks') ||
    t.includes('water utility') ||
    t.includes('water system') ||
    t.includes('water rate')
  ) {
    return 'Water District Updates'
  }
  return 'Water Related News'
}

function isRelevant(text) {
  const t = String(text).toLowerCase()
  return KEYWORDS.some((k) => t.includes(k))
}

/**
 * @param {{ url: string, title: string, summary?: string, source: string, topic?: string, publishedAt?: Date, imageUrl?: string|null }} raw
 */
function normalizeArticle(raw) {
  try {
    if (!raw || !raw.url || !raw.title) return null
    const title = String(raw.title).trim()
    const summary = String(raw.summary || '').trim()
    const blob = `${title} ${summary}`
    if (!isRelevant(blob)) return null
    let publishedAt = raw.publishedAt
    if (!(publishedAt instanceof Date) || isNaN(publishedAt.getTime())) {
      publishedAt = new Date()
    }
    return {
      url: String(raw.url).trim(),
      title,
      summary: summary.slice(0, 2000),
      source: raw.source,
      topic: raw.topic || classifyTopic(blob),
      publishedAt,
      imageUrl: raw.imageUrl != null ? String(raw.imageUrl).trim() || null : null,
    }
  } catch {
    return null
  }
}

module.exports = {
  KEYWORDS,
  classifyTopic,
  isRelevant,
  normalizeArticle,
}
