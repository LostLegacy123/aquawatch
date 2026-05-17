'use strict'

const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

const { scrapeDOE } = require('./sources/doe')
const { scrapeLWUA } = require('./sources/lwua')
const { scrapeDENR } = require('./sources/denr')
const { scrapeWaterDistricts } = require('./sources/waterDistricts')
const { scrapeABSCBN } = require('./sources/abscbn')
const { scrapeGMA } = require('./sources/gma')
const { scrapeManilaBulletin } = require('./sources/manilaBulletin')
const { scrapeInquirer } = require('./sources/inquirer')
const { scrapeAllRssFeeds } = require('./sources/rssFeeds')

/** Load .env from repo root when running locally (GitHub Actions uses secrets). */
function loadDotEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  try {
    const dotenv = require('dotenv')
    dotenv.config({ path: envPath })
  } catch {
    console.warn('dotenv not installed; set FIREBASE_SERVICE_ACCOUNT in environment')
  }
}

function dedupeByUrl(records) {
  const map = new Map()
  for (const r of records) {
    if (r && r.url && !map.has(r.url)) map.set(r.url, r)
  }
  return [...map.values()]
}

async function writeArticlesToFirestore(db, records) {
  const CHUNK = 400
  let total = 0
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK)
    const batch = db.batch()
    for (const r of slice) {
      const ref = db.collection('articles').doc()
      batch.set(ref, {
        url: r.url,
        title: r.title,
        summary: r.summary,
        source: r.source,
        topic: r.topic,
        publishedAt: admin.firestore.Timestamp.fromDate(r.publishedAt),
        imageUrl: r.imageUrl,
        sentToGroup: false,
        scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
    total += slice.length
  }
  console.log(`Written ${total} articles to Firestore collection "articles"`)
  return total
}

async function main() {
  loadDotEnv()

  let db = null
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) {
      console.error('FIREBASE_SERVICE_ACCOUNT not set — cannot write to Firestore.')
      process.exitCode = 1
      return
    }
    const serviceAccount = JSON.parse(raw)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
    db = admin.firestore()
    console.log(`Firebase project: ${serviceAccount.project_id}`)
  } catch (e) {
    console.error('Firebase init failed:', e && e.message)
    process.exitCode = 1
    return
  }

  const rssRecords = await scrapeAllRssFeeds()
  const htmlParts = await Promise.all([
    scrapeDOE(),
    scrapeLWUA(),
    scrapeDENR(),
    scrapeWaterDistricts(),
    scrapeABSCBN(),
    scrapeGMA(),
    scrapeManilaBulletin(),
    scrapeInquirer(),
  ])

  const records = dedupeByUrl([...rssRecords, ...htmlParts.flat()])
  console.log(`Total relevant articles (RSS + HTML): ${records.length}`)

  if (records.length === 0) {
    console.error('No articles scraped — check network or RSS feeds.')
    process.exitCode = 1
    return
  }

  try {
    const written = await writeArticlesToFirestore(db, records)
    if (written === 0) {
      process.exitCode = 1
    }
  } catch (e) {
    console.error('Firestore write failed:', e && e.message)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
