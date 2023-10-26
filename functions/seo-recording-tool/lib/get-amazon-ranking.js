const puppeteer = require('puppeteer')
const dateformat = require('dateformat')
const { google } = require('googleapis')
const { sleep } = require('./utils')
// const { initializeApp } = require('firebase-admin/app')
// const { getStorage } = require('firebase-admin/storage')
// const fs = require('fs')
// const { ulid } = require('ulid')

const isEmulatorEnabled = process.env.FUNCTIONS_EMULATOR === 'true'

if (isEmulatorEnabled) {
  process.env.GOOGLE_APPLICATION_CRDEENTIALS = process.env.GOOGLE_API_KEY_FILE
}

// const app = initializeApp()
// const storage = getStorage(app)

exports.getAmazonRanking = async function (
  searchURL,
  searchResultsSelector,
  adResultsSelector,
  nextPageLinkSelector,
  itemIdName,
  spreadsheetId,
  {
    prefix = '',
    interval = 1000,
    pageParam = 'p',
    searchLimit = 80,
    adLimit = 80,
  }) {
  // const timestamp = Date.now()

  // init sheets api
  const authOptions = {
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }

  // なぜか GOOGLE_APPLICATION_CREDENTIALS を .env.local で設定できない
  if (isEmulatorEnabled) {
    authOptions.keyFile = process.env.GOOGLE_API_KEY_FILE
  }

  const auth = await google.auth.getClient(authOptions)
  const sheets = google.sheets({ version: 'v4', auth })

  // init puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--lang=ja,en-US,en'],
    defaultViewport: {
      width: 1920,
      height: 2000,
    }
  })
  const page = await browser.newPage()

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja'
  })

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'language', {
      get: function () {
        return 'ja'
      }
    })
    Object.defineProperty(navigator, 'languages', {
      get: function () {
        return ['ja', 'en-US', 'en']
      }
    })
  })

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36')

  const items = await readItems(sheets, spreadsheetId, prefix)

  const itemCount = items.length

  let index = 0

  for (const { keyword, itemId } of items) {
    const ad = await getRank(page, adResultsSelector, keyword, itemId, adLimit)
    const search = await getRank(page, searchResultsSelector, keyword, itemId, searchLimit)
    const date = dateformat(new Date, 'yyyy/mm/dd')

    const result = [keyword, itemId, ad, search, date]
    await writeResult(sheets, spreadsheetId, prefix, result)
    console.log((++index) + '/' + itemCount, itemId, keyword, 'Search:', search, 'Ad:', ad)
  }

  await browser.close()

  async function getResults (page, selector, itemId, keyword, rank) {
    // const results = page.evaluate((selector, itemIdName) => {
    //     return Array.from(
    //       document.querySelectorAll(selector),
    //       (el, i) => ({
    //         rank: i + 1,
    //         title: el.querySelector('.s-image').alt,
    //         asin: el.dataset[itemIdName],
    //         url: 'https://amazon.co.jp/dp/' + el.dataset[itemIdName],
    //       })
    //     )
    //   },
    //   selector,
    //   itemIdName
    // )
    // const title = `${itemId}_${keyword}_${rank === 0 ? 'not-found' : rank}`
    //
    // const bucket = storage.bucket('seo-recording-tool')
    //
    // const resultBuffer = Buffer.from(JSON.stringify(results, null, 2))
    // const resultFile = bucket.file(`${timestamp}/${title}.json`)
    // const resultToken = ulid()
    // await resultFile.save(resultBuffer, {
    //   metadata: {
    //     contentType: 'application/json',
    //     metadata: {
    //       firebaseStorageDownloadTokens: resultToken
    //     }
    //   }
    // })
    //
    // const screenshotBuffer = await page.screenshot()
    // const screenshotFile = bucket.file(`${timestamp}/${title}.png`)
    // const screenshotToken = ulid()
    // await screenshotFile.save(screenshotBuffer, {
    //   metadata: {
    //     contentType: 'image/png',
    //     metadata: {
    //       firebaseStorageDownloadTokens: screenshotToken
    //     }
    //   }
    // })
  }

  async function getRank (page, selector, keyword, itemId, limit = 50, surveyedItems = 0, pageNo = 1) {
    const url = new URL(searchURL + encodeURIComponent(keyword))
    if (pageNo > 1) url.searchParams.set(pageParam, page)

    console.log(`Searching... keyword:${keyword} itemId:${itemId} page:${pageNo}`)

    await Promise.all([
      sleep(interval),
      page.goto(url.toString())
    ])

    const itemIdList = await page.evaluate((selector, itemIdName) => Array.from(document.querySelectorAll(selector), el => el.dataset[itemIdName]), selector, itemIdName)
    const hasNext = await page.evaluate(selector => document.querySelector(selector) !== null, nextPageLinkSelector)

    const rank = itemIdList.indexOf(itemId) + 1
    const items = surveyedItems + itemIdList.length

    if (rank !== 0 || items > limit || !hasNext || items === 0) {
      await getResults(page, selector, itemId, keyword, rank)

      return rank !== 0 ? surveyedItems + rank : '-'
    }

    return getRank(page, selector, keyword, itemId, limit, items, ++pageNo)
  }
}

async function readItems (sheets, spreadsheetId, prefix) {
  console.log(spreadsheetId)

  const { data: { values } } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${prefix}keywords!A2:B`,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  })

  return values.map(([keyword, itemId]) => ({ keyword, itemId }))
}

async function writeResult (sheets, spreadsheetId, prefix, result) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${prefix}results`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [result]
    }
  })
}
