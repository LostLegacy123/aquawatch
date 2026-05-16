'use strict'

const admin = require('firebase-admin')

const { scrapeDOE } = require('./sources/doe')
const { scrapeLWUA } = require('./sources/lwua')
const { scrapeDENR } = require('./sources/denr')
const { scrapeWaterDistricts } = require('./sources/waterDistricts')
const { scrapeABSCBN } = require('./sources/abscbn')
const { scrapeGMA } = require('./sources/gma')
const { scrapeManilaBulletin } = require('./sources/manilaBulletin')
const { scrapeInquirer } = require('./sources/inquirer')

/** Dedupe by canonical URL */
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
  console.log(`Written ${total} articles to Firestore`)
}

async function main() {
  let db = null
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (raw) {
      const serviceAccount = JSON.parse(raw)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      db = admin.firestore()
    } else {
      console.warn(
        'FIREBASE_SERVICE_ACCOUNT not set; will skip Firestore write.',
      )
    }
  } catch (e) {
    console.warn('Firebase init failed:', e && e.message)
    db = null
  }

  const parts = await Promise.all([
    scrapeDOE(),
    scrapeLWUA(),
    scrapeDENR(),
    scrapeWaterDistricts(),
    scrapeABSCBN(),
    scrapeGMA(),
    scrapeManilaBulletin(),
    scrapeInquirer(),
  ])

  const records = dedupeByUrl(parts.flat())
  console.log(`Scraped ${records.length} relevant articles (deduped by url)`)

  if (!db || records.length === 0) {
    return
  }

  try {
    await writeArticlesToFirestore(db, records)
  } catch (e) {
    console.error('Firestore write failed:', e && e.message)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
