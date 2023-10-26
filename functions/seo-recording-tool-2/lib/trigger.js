const { google } = require('googleapis')
const { functions } = require('./firebase-admin')
const { GoogleAuth } = require('google-auth-library')

const driveId = '0AGckOXnCoVCAUk9PVA'
const toolFolderId = '1CgmrMWPb4tTz2SIIIeACewAqw-ehML3A'

exports.trigger = async () => {
  const [enqueueAmazon, enqueueRakuten] = getQueues()
  const sheets = await getSearchTargetSheets()

  for (const { name, id } of sheets) {
    await enqueueAmazon(id, name)
    await enqueueRakuten(id, name)
  }
}

const getQueues = () => {
  return [
    async (id, name) => {
      const queue = functions.taskQueue(
        'locations/asia-northeast2/functions/seorecordingtool2amazon',
      )

      await queue.enqueue({ id, name }, { uri: await getFunctionUrl('seorecordingtool2amazon', 'asia-northeast2') })
    },
    async (id, name) => {
      const queue = functions.taskQueue(
        'locations/asia-northeast2/functions/seorecordingtool2rakuten',
      )

      await queue.enqueue({ id, name }, { uri: await getFunctionUrl('seorecordingtool2rakuten', 'asia-northeast2') })
    }
  ]
}

async function getFunctionUrl (name, location) {
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  })
  const projectId = await auth.getProjectId()
  const url =
    'https://cloudfunctions.googleapis.com/v2beta/' +
    `projects/${projectId}/locations/${location}/functions/${name}`

  const client = await auth.getClient()
  const res = await client.request({ url })
  const uri = res.data?.serviceConfig?.uri
  if (!uri) {
    throw new Error(`URI が取得できませんでした: ${url}`)
  }
  return uri
}

/* シート一覧取得 */
const getSearchTargetSheets = async () => {
  const { drive, sheets } = await initializeGoogleApis()

  const currentYear = await getCurrentYear(sheets)
  const currentYearFolderId = await getCurrentYearFolderId(drive, currentYear)
  const brandFolders = await getAllFolders(drive, currentYearFolderId)

  let allSheets = []
  for (const brandFolder of brandFolders) {
    const brandSheets = await getAllSheets(drive, brandFolder.id)
    allSheets = [...allSheets, ...brandSheets]
  }

  return allSheets
}

const initializeGoogleApis = async () => {
  const authOptions = {
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ],
  }

  // なぜか GOOGLE_APPLICATION_CREDENTIALS を .env.local で設定できない
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    authOptions.keyFile = process.env.GOOGLE_API_KEY_FILE
  }

  const auth = await google.auth.getClient(authOptions)
  const drive = google.drive({ version: 'v3', auth })
  const sheets = google.sheets({ version: 'v4', auth })

  return { drive, sheets }
}

const getCurrentYear = async (sheets) => {
  const { data: { values } } = await sheets.spreadsheets.values.get({
    spreadsheetId: '1utb3e8w99r4l3CofCKlQOBHmEV5K9P_nyV0KAvJuNJI',
    range: '設定!A:B',
  })

  return values.find(value => value[0] === '年度')[1]
}

const getCurrentYearFolderId = async (drive, currentYear) => {
  const { data: { files: folders } } = await drive.files.list({
    corpora: 'drive',
    driveId,
    q: `mimeType='application/vnd.google-apps.folder' and '${toolFolderId}' in parents and name='${currentYear}' and trashed=false`,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  })

  return folders[0].id
}

const getAllFolders = async (drive, parentFolderId) => {
  const { data: { files: folders } } = await drive.files.list({
    corpora: 'drive',
    driveId,
    q: `mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  })

  return folders.map(({ id, name }) => ({ id, name }))
}

const getAllSheets = async (drive, parentFolderId) => {
  const { data: { files: sheets } } = await drive.files.list({
    corpora: 'drive',
    driveId,
    q: `mimeType='application/vnd.google-apps.spreadsheet' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  })

  return sheets
}