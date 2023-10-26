const { onSchedule } = require('firebase-functions/v2/scheduler')
const { getRakutenRanking } = require('./get-rakuten-ranking.js')
const { sheets } = require('../config.json')
const { sleep } = require('./utils')
const { setGlobalOptions } = require('firebase-functions/v2')
const { onRequest } = require('firebase-functions/v2/https')
const { getAmazonRanking } = require('./get-amazon-ranking')

const rakuten = async () => {
  for (const { name, id: spreadsheetId } of sheets) {
    console.log(`${name} - 楽天`)
    await getRakutenRanking(
      'https://search.rakuten.co.jp/search/mall/',
      '.dui-card.searchresultitem:not(:nth-child(1),:nth-child(2),:nth-child(3),:nth-child(4))',
      '.dui-card.searchresultitem:nth-child(1),.dui-card.searchresultitem:nth-child(2),.dui-card.searchresultitem:nth-child(3),.dui-card.searchresultitem:nth-child(4)',
      'a.nextPage',
      'trackItemid',
      spreadsheetId,
      {
        prefix: 'rakuten_',
        adLimit: 3,
        searchLimit: 100,
      }
    )

    await sleep(1000)
  }
  console.log('DONE.')
}

const amazon = async () => {
  for (const { name, id: spreadsheetId } of sheets) {
    console.log(`${name} - Amazon`)
    await getAmazonRanking(
      'https://www.amazon.co.jp/s?k=',
      '.s-result-item.s-asin:not(.AdHolder),.s-inner-result-item[data-asin]',
      '.s-result-item.s-asin.AdHolder',
      'li.a-last > a',
      'asin',
      spreadsheetId,
      {
        prefix: 'amazon_',
        pageParam: 'page',
        searchLimit: 100,
      }
    )

    await sleep(1000)
  }
  console.log('DONE.')
}

setGlobalOptions({
  region: 'asia-northeast2',
  memory: '1GiB',
  timeoutSeconds: 540,
})

const onEmulator = (handler) => onRequest(async (_req, res) => {
  await handler()
  res.send('DONE')
})

const onProduct = (handler) => onSchedule({
  schedule: 'every day 12:00',
  timeZone: 'Asia/Tokyo',
}, handler)

// exports.recordrakutenseo = process.env.FUNCTIONS_EMULATOR === 'true' ? onEmulator(rakuten) : onProduct(rakuten)
// exports.recordamazonseo = process.env.FUNCTIONS_EMULATOR === 'true' ? onEmulator(amazon) : onProduct(amazon)
