/**
 * さくら保育園 シフト管理スクリプト（シフト予定表対応版）
 *
 * 【シフト予定表の形式】
 * 行4: 保育士名（列4=ひさえ先生, 列6=ひろこ先生, ...）
 * 行5: 「入りたい時間」「帰りたい時間」のラベル
 * 行6以降: 日付（列2）+ 各保育士の出退勤時間
 *
 * 保育士の出退勤時間からアプリの TIME_SLOTS を自動判定します。
 * 例: 8:00〜14:00 → 07:00〜09:00, 09:00〜12:00, 12:00〜15:00 をカバー
 */

var PROJECT_ID   = 'reservation-app-c3e9a';
var API_KEY      = 'AIzaSyBOu3EGnsa-m0Rm4FBY3Xn5kIIVJwWQ62s';
var SHEET_NAME   = 'シフト予定表';
var FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

var TIME_SLOTS = [
  { label: '07:00〜09:00', start: 7*60,  end: 9*60  },
  { label: '09:00〜12:00', start: 9*60,  end: 12*60 },
  { label: '12:00〜15:00', start: 12*60, end: 15*60 },
  { label: '15:00〜18:00', start: 15*60, end: 18*60 },
  { label: '18:00〜19:00', start: 18*60, end: 19*60 },
];

/**
 * Firestore から保育士一覧を取得して「名前 → ID」マップを作成
 */
function getNurseMap() {
  var url = FIRESTORE_BASE + '/nurses?key=' + API_KEY + '&pageSize=100';
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    Logger.log('保育士の取得に失敗: ' + res.getContentText());
    return {};
  }
  var data = JSON.parse(res.getContentText());
  var map = {};
  (data.documents || []).forEach(function(doc) {
    var name = doc.fields && doc.fields.name && doc.fields.name.stringValue;
    var id   = doc.name.split('/').pop();
    if (name && id) map[name] = id;
  });
  Logger.log('保育士マップ: ' + JSON.stringify(map));
  return map;
}

/**
 * 1日分のシフトを Firestore に書き込む
 */
function writeShift(date, assignments) {
  var url = FIRESTORE_BASE + '/shifts/' + date + '?key=' + API_KEY;

  var assignmentFields = {};
  Object.keys(assignments).forEach(function(slot) {
    var nurseIds = assignments[slot];
    assignmentFields[slot] = {
      arrayValue: { values: nurseIds.map(function(id) { return { stringValue: id }; }) }
    };
  });

  var body = {
    fields: {
      assignments: { mapValue: { fields: assignmentFields } },
      updatedAt:   { stringValue: new Date().toISOString() },
      source:      { stringValue: 'gas' },
    }
  };

  return UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
}

/**
 * Date オブジェクトを分数（0:00 = 0, 9:00 = 540）に変換
 */
function toMinutes(dateObj) {
  if (!dateObj || !(dateObj instanceof Date)) return null;
  return dateObj.getHours() * 60 + dateObj.getMinutes();
}

/**
 * 保育士の出退勤時間（分）から対応する TIME_SLOTS を返す
 * 勤務時間とスロットが1分でも重なればカバーしていると判定
 */
function getCoveredSlots(startMin, endMin) {
  var slots = [];
  TIME_SLOTS.forEach(function(slot) {
    if (startMin < slot.end && endMin > slot.start) {
      slots.push(slot.label);
    }
  });
  return slots;
}

/**
 * シフト予定表を読み取り、Firestore にシフトを同期する
 */
function syncToFirestore() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log('シート「' + SHEET_NAME + '」が見つかりません');
    ss.toast('シート「' + SHEET_NAME + '」が見つかりません', 'エラー', 6);
    return;
  }

  var nurseMap = getNurseMap();
  if (Object.keys(nurseMap).length === 0) {
    ss.toast('アプリで保育士を先に登録してください', '注意', 6);
    return;
  }

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  // 行4: 保育士名、行5: 入りたい/帰りたいラベル
  var nameRow  = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
  var labelRow = sheet.getRange(5, 1, 1, lastCol).getValues()[0];

  // 「入りたい時間」の列位置を見つけて保育士情報を構築
  var nurses = [];
  for (var c = 0; c < labelRow.length; c++) {
    if (labelRow[c] === '入りたい時間') {
      var nurseName = nameRow[c];
      if (nurseName && String(nurseName).trim() !== '') {
        nurses.push({
          name:     String(nurseName).trim(),
          startIdx: c,      // 0-indexed（入りたい時間の列）
          endIdx:   c + 1,  // 0-indexed（帰りたい時間の列）
        });
      }
    }
  }
  Logger.log('検出した保育士: ' + JSON.stringify(nurses.map(function(n){ return n.name; })));

  // 行6以降がデータ行（列2=日付、列4〜=各保育士の時間）
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var dataRows = sheet.getRange(6, 1, lastRow - 5, lastCol).getValues();
  var successCount = 0;
  var errorCount   = 0;
  var unknownNames = [];

  dataRows.forEach(function(row) {
    var dateCell = row[1]; // 列2（0-indexed: 1）
    if (!dateCell || !(dateCell instanceof Date)) return;

    var dt = new Date(dateCell);
    dt.setHours(0, 0, 0, 0);
    if (dt < today) return; // 過去の日付はスキップ

    var dateStr     = Utilities.formatDate(dt, 'Asia/Tokyo', 'yyyy-MM-dd');
    var assignments = {};

    nurses.forEach(function(nurse) {
      var nurseId = nurseMap[nurse.name];
      if (!nurseId) {
        if (unknownNames.indexOf(nurse.name) === -1) unknownNames.push(nurse.name);
        return;
      }

      var startCell = row[nurse.startIdx];
      var endCell   = row[nurse.endIdx];
      if (!startCell || !endCell || !(startCell instanceof Date) || !(endCell instanceof Date)) return;

      var startMin = toMinutes(startCell);
      var endMin   = toMinutes(endCell);
      if (startMin === null || endMin === null || startMin >= endMin) return;

      var coveredSlots = getCoveredSlots(startMin, endMin);
      coveredSlots.forEach(function(slot) {
        if (!assignments[slot]) assignments[slot] = [];
        if (assignments[slot].indexOf(nurseId) === -1) {
          assignments[slot].push(nurseId);
        }
      });
    });

    if (Object.keys(assignments).length === 0) return; // 誰も割り当てなければスキップ

    var res = writeShift(dateStr, assignments);
    if (res.getResponseCode() === 200) {
      successCount++;
    } else {
      errorCount++;
      Logger.log(dateStr + ' の書き込み失敗: ' + res.getContentText());
    }
  });

  var msg = '同期完了: ' + successCount + '件成功';
  if (errorCount   > 0) msg += ' / ' + errorCount + '件失敗';
  if (unknownNames.length > 0) msg += '\n未登録の保育士名: ' + unknownNames.join(', ');
  Logger.log(msg);
  ss.toast(msg, 'シフト同期', 8);
}

/**
 * 手動で同期（メニューから実行）
 */
function manualSync() {
  syncToFirestore();
}

/**
 * シートを編集したとき自動で同期
 */
function onEdit(e) {
  if (!e) return;
  if (e.source.getActiveSheet().getName() !== SHEET_NAME) return;
  Utilities.sleep(1000);
  syncToFirestore();
}

/**
 * カスタムメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('さくら保育園')
    .addItem('Firestoreにシフトを同期', 'manualSync')
    .addToUi();
}
