/**
 * さくら保育園 シフト管理スクリプト
 *
 * 【スプレッドシートの形式】
 * ┌────────────────┬──────────────┬──────────────┬──────────────┐
 * │ 時間帯          │ 2024/05/04   │ 2024/05/05   │ 2024/05/06   │
 * ├────────────────┼──────────────┼──────────────┼──────────────┤
 * │ 07:00〜09:00   │ 山田,田中    │ 山田         │              │
 * │ 09:00〜12:00   │ 田中         │ 山田,田中    │ 田中         │
 * │ 12:00〜15:00   │ 山田         │              │              │
 * │ 15:00〜18:00   │              │ 田中         │              │
 * │ 18:00〜19:00   │              │              │              │
 * └────────────────┴──────────────┴──────────────┴──────────────┘
 *
 * ・保育士名はアプリに登録した名前と完全一致させてください
 * ・複数担当の場合はカンマ（,）で区切ってください
 * ・担当なしのセルは空白にしてください
 * ・シートを編集するたびに自動で Firebase に同期されます
 */

// ▼▼▼ Firebase の設定（.env と同じ値） ▼▼▼
const PROJECT_ID = 'reservation-app-c3e9a'
const API_KEY    = 'AIzaSyBOu3EGnsa-m0Rm4FBY3Xn5kIIVJwWQ62s'
const SHEET_NAME = 'シフト'
// ▲▲▲ ここまで ▲▲▲

const FIRESTORE_BASE =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const TIME_SLOTS = [
  '07:00〜09:00',
  '09:00〜12:00',
  '12:00〜15:00',
  '15:00〜18:00',
  '18:00〜19:00',
]

/**
 * Firestore から保育士一覧を取得して「名前 → ID」マップを作成
 */
function getNurseMap() {
  const url = `${FIRESTORE_BASE}/nurses?key=${API_KEY}&pageSize=100`
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) {
    Logger.log('❌ 保育士の取得に失敗: ' + res.getContentText())
    return {}
  }
  const data = JSON.parse(res.getContentText())
  const map = {}
  ;(data.documents || []).forEach(doc => {
    const name = doc.fields?.name?.stringValue
    const id   = doc.name.split('/').pop()
    if (name && id) map[name] = id
  })
  Logger.log('保育士マップ: ' + JSON.stringify(map))
  return map
}

/**
 * 1日分のシフトを Firestore に書き込む
 */
function writeShift(date, assignments) {
  const url = `${FIRESTORE_BASE}/shifts/${date}?key=${API_KEY}`

  // assignments を Firestore の Map 型形式に変換
  const assignmentFields = {}
  Object.entries(assignments).forEach(([slot, nurseIds]) => {
    assignmentFields[slot] = {
      arrayValue: { values: nurseIds.map(id => ({ stringValue: id })) }
    }
  })

  const body = {
    fields: {
      assignments: { mapValue: { fields: assignmentFields } },
      updatedAt:   { stringValue: new Date().toISOString() },
      source:      { stringValue: 'gas' },
    }
  }

  return UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  })
}

/**
 * スプレッドシートを読み取り、Firestore にシフトを同期する
 */
function syncToFirestore() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  if (!sheet) {
    Logger.log('❌ シート「' + SHEET_NAME + '」が見つかりません')
    SpreadsheetApp.getActiveSpreadsheet().toast('シート「' + SHEET_NAME + '」が見つかりません', '❌ エラー', 6)
    return
  }

  const nurseMap = getNurseMap()
  if (Object.keys(nurseMap).length === 0) {
    Logger.log('⚠️ 保育士が登録されていません。先にアプリで保育士を登録してください。')
    SpreadsheetApp.getActiveSpreadsheet().toast('アプリで保育士を先に登録してください', '⚠️ 注意', 6)
    return
  }

  const data = sheet.getDataRange().getValues()
  let successCount = 0
  let errorCount = 0
  let unknownNames = new Set()

  // 1行目の2列目以降が日付
  const rawDates = data[0].slice(1)

  rawDates.forEach((rawDate, colOffset) => {
    if (!rawDate) return
    const dt = new Date(rawDate)
    if (isNaN(dt.getTime())) return

    const dateStr     = Utilities.formatDate(dt, 'Asia/Tokyo', 'yyyy-MM-dd')
    const assignments = {}

    TIME_SLOTS.forEach((slot, rowOffset) => {
      const cell = data[rowOffset + 1]?.[colOffset + 1]
      if (!cell) return

      // カンマ・読点・全角カンマで分割
      const names = String(cell)
        .split(/[,、，]/)
        .map(s => s.trim())
        .filter(Boolean)

      const nurseIds = []
      names.forEach(name => {
        if (nurseMap[name]) {
          nurseIds.push(nurseMap[name])
        } else {
          unknownNames.add(name)  // 名前が一致しない場合は記録
        }
      })

      if (nurseIds.length > 0) {
        assignments[slot] = nurseIds
      }
    })

    const res = writeShift(dateStr, assignments)
    if (res.getResponseCode() === 200) {
      successCount++
    } else {
      errorCount++
      Logger.log(`❌ ${dateStr} の書き込み失敗: ` + res.getContentText())
    }
  })

  let msg = `✅ 同期完了: ${successCount}件成功`
  if (errorCount > 0) msg += ` / ${errorCount}件失敗`
  if (unknownNames.size > 0) {
    msg += `\n⚠️ 未登録の保育士名: ${[...unknownNames].join(', ')}`
  }
  Logger.log(msg)
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '🌸 シフト同期', 6)
}

/**
 * シートを編集したとき自動で同期
 */
function onEdit(e) {
  if (!e) return
  if (e.source.getActiveSheet().getName() !== SHEET_NAME) return
  // 重い処理のため少し遅延して実行（連続入力の負荷を軽減）
  Utilities.sleep(500)
  syncToFirestore()
}

/**
 * 手動で同期（メニューから実行）
 */
function manualSync() {
  syncToFirestore()
}

/**
 * スプレッドシートのテンプレートを自動生成
 */
function createTemplate() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  let sheet   = ss.getSheetByName(SHEET_NAME)

  if (sheet) {
    if (!Browser.msgBox(`シート「${SHEET_NAME}」を初期化しますか？\n既存のデータは削除されます。`, Browser.Buttons.OK_CANCEL) === 'ok') return
    sheet.clear()
  } else {
    sheet = ss.insertSheet(SHEET_NAME)
  }

  // 今日から21日分の日付を生成（日曜除く）
  const dates = []
  const today = new Date()
  for (let i = 1; i <= 30 && dates.length < 21; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    if (d.getDay() !== 0) dates.push(d)
  }

  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  const headers  = ['時間帯', ...dates.map(d =>
    `${d.getMonth()+1}/${d.getDate()}(${dayNames[d.getDay()]})`
  )]

  // ヘッダー行
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1E3A8A')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')

  // 時間帯列
  TIME_SLOTS.forEach((slot, i) => {
    sheet.getRange(i + 2, 1).setValue(slot)
      .setFontWeight('bold')
      .setBackground('#EFF6FF')
  })

  // 土曜列をハイライト
  dates.forEach((d, colOffset) => {
    if (d.getDay() === 6) {
      sheet.getRange(1, colOffset + 2, TIME_SLOTS.length + 1, 1)
        .setBackground(sheet.getRange(colOffset + 2, 1).getBackground() === '#1E3A8A' ? '#1E3A8A' : '#FEF9C3')
    }
  })

  // セルのサイズ調整
  sheet.setColumnWidth(1, 130)
  dates.forEach((_, i) => sheet.setColumnWidth(i + 2, 100))
  sheet.setRowHeight(1, 36)

  // 入力例をA1に
  sheet.getRange(2, 2).setValue('（例）山田,田中')
    .setFontColor('#9CA3AF')
    .setFontStyle('italic')

  ss.toast('テンプレートを作成しました！\n保育士名はアプリ登録済みの名前と一致させてください。', '✅ 完了', 6)
  ss.setActiveSheet(sheet)
}

/**
 * カスタムメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌸 さくら保育園')
    .addItem('Firebaseにシフトを同期', 'manualSync')
    .addSeparator()
    .addItem('シートテンプレートを作成', 'createTemplate')
    .addToUi()
}
