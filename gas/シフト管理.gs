/**
 * さくら保育園 シフト管理スクリプト
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
 *
 * セルに「○」を入力すると予約可能な時間帯として登録されます。
 */

// ▼▼▼ ここを変更してください ▼▼▼
const FUNCTION_URL = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/syncShifts'
const SYNC_SECRET  = 'YOUR_SYNC_SECRET'   // functions の GAS_SYNC_SECRET と同じ値
const SHEET_NAME   = 'シフト'
// ▲▲▲ ここまで ▲▲▲

const TIME_SLOTS = [
  '07:00〜09:00',
  '09:00〜12:00',
  '12:00〜15:00',
  '15:00〜18:00',
  '18:00〜19:00',
]

/**
 * シートのデータを読み取り、Firestoreへ同期する
 */
function syncToFirestore() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  if (!sheet) {
    Logger.log('❌ シート「' + SHEET_NAME + '」が見つかりません')
    return
  }

  const data   = sheet.getDataRange().getValues()
  const shifts = {}

  // 1行目の2列目以降が日付
  const rawDates = data[0].slice(1)

  rawDates.forEach((rawDate, colOffset) => {
    if (!rawDate) return

    // 日付をyyyy-MM-dd形式に変換
    const dt      = new Date(rawDate)
    if (isNaN(dt.getTime())) return
    const dateStr = Utilities.formatDate(dt, 'Asia/Tokyo', 'yyyy-MM-dd')

    const availableSlots = []
    TIME_SLOTS.forEach((slot, rowOffset) => {
      const cell = data[rowOffset + 1]?.[colOffset + 1]
      if (cell === '○' || cell === '〇' || cell === 'o' || cell === 'O') {
        availableSlots.push(slot)
      }
    })

    // 空の日程も送信して削除に対応
    shifts[dateStr] = availableSlots
  })

  if (Object.keys(shifts).length === 0) {
    Logger.log('⚠️ 同期対象のデータがありません')
    return
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify({ shifts }),
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch(FUNCTION_URL, options)
  const code     = response.getResponseCode()
  const body     = response.getContentText()

  if (code === 200) {
    Logger.log('✅ 同期完了: ' + body)
    SpreadsheetApp.getActiveSpreadsheet().toast('シフトをFirebaseに同期しました', '✅ 同期完了', 5)
  } else {
    Logger.log('❌ 同期失敗 [' + code + ']: ' + body)
    SpreadsheetApp.getActiveSpreadsheet().toast('同期に失敗しました。ログを確認してください', '❌ エラー', 8)
  }
}

/**
 * シートが編集されたとき自動で同期
 * ※ トリガー設定: スプレッドシート → 編集時 → syncToFirestore
 */
function onEdit(e) {
  if (!e) return
  const sheet = e.source.getActiveSheet()
  if (sheet.getName() !== SHEET_NAME) return
  syncToFirestore()
}

/**
 * 手動実行ボタン用（メニューから呼び出し）
 */
function manualSync() {
  syncToFirestore()
}

/**
 * スプレッドシートにカスタムメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌸 さくら保育園')
    .addItem('Firebaseにシフトを同期', 'manualSync')
    .addToUi()
}
