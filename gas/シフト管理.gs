/**
 * さくら保育園 シフト管理スクリプト（Cloud Functions不要版）
 * Firestore REST API に直接書き込みます。
 *
 * スプレッドシートの構成:
 * ┌────────────────┬────────────┬────────────┬────────────┐
 * │  (空白)         │ 2024/04/03 │ 2024/04/04 │ 2024/04/05 │
 * ├────────────────┼────────────┼────────────┼────────────┤
 * │ 07:00〜09:00   │     ○      │            │     ○      │
 * │ 09:00〜12:00   │     ○      │     ○      │     ○      │
 * │ 12:00〜15:00   │            │     ○      │     ○      │
 * │ 15:00〜18:00   │     ○      │            │            │
 * │ 18:00〜19:00   │            │     ○      │            │
 * └────────────────┴────────────┴────────────┴────────────┘
 * セルに「○」を入力すると予約可能な時間帯として登録されます。
 */

// ▼▼▼ ここを変更してください ▼▼▼
const PROJECT_ID = 'reservation-app-c3e9a'
const API_KEY    = 'AIzaSyBOu3EGnsa-m0Rm4FBY3Xn5kIIVJwWQ62s'
const SHEET_NAME = 'シフト'
// ▲▲▲ ここまで ▲▲▲

const TIME_SLOTS = [
  '07:00〜09:00',
  '09:00〜12:00',
  '12:00〜15:00',
  '15:00〜18:00',
  '18:00〜19:00',
]

const FIRESTORE_BASE =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

/**
 * Firestore の shifts コレクションに1件書き込む
 */
function writeShift(date, slots) {
  const url = `${FIRESTORE_BASE}/shifts/${date}?key=${API_KEY}`
  const body = {
    fields: {
      slots: {
        arrayValue: {
          values: slots.map(s => ({ stringValue: s }))
        }
      },
      updatedAt: { stringValue: new Date().toISOString() },
      source:    { stringValue: 'gas' }
    }
  }
  const options = {
    method: 'patch',           // PATCH = upsert（なければ作成、あれば上書き）
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  }
  return UrlFetchApp.fetch(url, options)
}

/**
 * シートを読み取って Firestore に同期する
 */
function syncToFirestore() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  if (!sheet) {
    Logger.log('❌ シート「' + SHEET_NAME + '」が見つかりません')
    return
  }

  const data = sheet.getDataRange().getValues()
  let successCount = 0
  let errorCount = 0

  // 1行目の2列目以降が日付
  const rawDates = data[0].slice(1)

  rawDates.forEach((rawDate, colOffset) => {
    if (!rawDate) return
    const dt = new Date(rawDate)
    if (isNaN(dt.getTime())) return

    const dateStr = Utilities.formatDate(dt, 'Asia/Tokyo', 'yyyy-MM-dd')
    const availableSlots = []

    TIME_SLOTS.forEach((slot, rowOffset) => {
      const cell = data[rowOffset + 1]?.[colOffset + 1]
      if (cell === '○' || cell === '〇' || cell === 'o' || cell === 'O') {
        availableSlots.push(slot)
      }
    })

    const res = writeShift(dateStr, availableSlots)
    if (res.getResponseCode() === 200) {
      successCount++
    } else {
      errorCount++
      Logger.log(`❌ ${dateStr} の書き込み失敗: ` + res.getContentText())
    }
  })

  const msg = `✅ 同期完了: ${successCount}件成功 / ${errorCount}件失敗`
  Logger.log(msg)
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '🌸 シフト同期', 5)
}

/** シートが編集されたとき自動同期 */
function onEdit(e) {
  if (!e) return
  if (e.source.getActiveSheet().getName() !== SHEET_NAME) return
  syncToFirestore()
}

/** 手動実行 */
function manualSync() {
  syncToFirestore()
}

/** カスタムメニューを追加 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌸 さくら保育園')
    .addItem('Firebaseにシフトを同期', 'manualSync')
    .addToUi()
}
