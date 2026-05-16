const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');

// Init Firebase Admin from env secret
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function fetchPAGASA() {
  // TODO: scrape PAGASA water level / flood data
  // Return array of waterData objects
  return [];
}

async function fetchDOE() {
  // TODO: scrape DOE water-related data
  // Return array of waterData objects
  return [];
}

async function writeToFirestore(records) {
  const batch = db.batch();
  records.forEach(record => {
    const ref = db.collection('waterData').doc();
    batch.set(ref, { ...record, fetchedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  console.log(`Written ${records.length} records to Firestore`);
}

(async () => {
  const pagasaData = await fetchPAGASA();
  const doeData = await fetchDOE();
  await writeToFirestore([...pagasaData, ...doeData]);
})();
