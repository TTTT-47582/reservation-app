const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

initializeApp()
const db = getFirestore()

// 環境変数（firebase functions:secrets:set で設定）
const getSes = () => new SESClient({
  region: process.env.AWS_SES_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const FROM = process.env.SES_FROM_EMAIL   // 例: noreply@sakura-hoikuen.com
const SYNC_SECRET = process.env.GAS_SYNC_SECRET

async function sendMail(to, subject, html) {
  const ses = getSes()
  await ses.send(new SendEmailCommand({
    Source: `さくら保育園 <${FROM}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
  }))
}

// ========== メールテンプレート ==========

function baseLayout(content) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <style>
    body{font-family:'Hiragino Kaku Gothic ProN',sans-serif;background:#F8FAFC;margin:0;padding:0}
    .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.1)}
    .hd{background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:28px 32px;color:#fff}
    .hd h1{font-size:1.125rem;margin:0;font-weight:800}
    .hd p{font-size:.875rem;margin:6px 0 0;opacity:.85}
    .body{padding:28px 32px}
    .body p{color:#374151;line-height:1.75;font-size:.9375rem;margin:0 0 12px}
    .table{width:100%;border-collapse:collapse;margin:16px 0}
    .table td{padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:.875rem}
    .table td:first-child{color:#6B7280;font-weight:600;width:130px}
    .table td:last-child{color:#1F2937}
    .btn{display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:.9375rem;margin:16px 0}
    .coupon-box{background:linear-gradient(135deg,#FEF3C7,#FDE68A);border:2px solid #FBB C24;border-radius:10px;padding:20px;margin:16px 0;text-align:center}
    .coupon-code{font-family:monospace;font-size:1.375rem;font-weight:800;color:#92400E;letter-spacing:.1em;background:#fff;padding:8px 16px;border-radius:6px;display:inline-block;margin-top:8px}
    .ft{background:#F3F4F6;padding:16px 32px;text-align:center;font-size:.8125rem;color:#9CA3AF}
  </style></head><body>
  <div class="wrap">${content}
    <div class="ft">さくら保育園｜〒000-0000 東京都○○区○○ 1-2-3｜TEL: 03-0000-0000</div>
  </div></body></html>`
}

function reservationTable(r) {
  const fmtDate = (d) => {
    if (!d) return ''
    const dt = d.toDate ? d.toDate() : new Date(d)
    const days = ['日','月','火','水','木','金','土']
    return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日（${days[dt.getDay()]}）`
  }
  return `<table class="table">
    <tr><td>保護者氏名</td><td>${r.parentName}（${r.parentKana}）</td></tr>
    <tr><td>お子様</td><td>${r.childName}</td></tr>
    <tr><td>利用日</td><td>${r.date}</td></tr>
    <tr><td>時間帯</td><td>${r.timeSlot}</td></tr>
    <tr><td>利用目的</td><td>${r.purpose}</td></tr>
    ${r.notes ? `<tr><td>特記事項</td><td>${r.notes}</td></tr>` : ''}
    <tr><td>予約番号</td><td>#${String(r.id || '').slice(-6)}</td></tr>
  </table>`
}

function confirmationHtml(r) {
  return baseLayout(`
    <div class="hd"><h1>🌸 ご予約を承りました</h1><p>さくら保育園 一時保育</p></div>
    <div class="body">
      <p>${r.parentName} 様<br>この度はご予約いただきありがとうございます。<br>
      以下の内容で受け付けました。確認後、担当者よりご連絡いたします。</p>
      ${reservationTable(r)}
      <p style="font-size:.875rem;color:#6B7280;background:#EFF6FF;border-radius:8px;padding:12px 14px;border-left:3px solid #2563EB">
        ご予約の確定は、担当者からの確認連絡をもって完了となります。<br>
        ご不明な点は お気軽にお問い合わせください。
      </p>
    </div>`)
}

function confirmedHtml(r) {
  return baseLayout(`
    <div class="hd"><h1>✅ ご予約が確定しました</h1><p>さくら保育園 一時保育</p></div>
    <div class="body">
      <p>${r.parentName} 様<br>ご予約の確定をご連絡いたします。当日お待ちしております。</p>
      ${reservationTable(r)}
      <p style="font-size:.875rem;color:#6B7280">
        【持ち物】着替え 2〜3セット、おむつ（必要な場合）、タオル、水筒など<br>
        当日の体調不良によるキャンセルはお電話にてご連絡ください。
      </p>
    </div>`)
}

function couponHtml(r, couponCode) {
  return baseLayout(`
    <div class="hd"><h1>🎉 5回目のご利用ありがとうございます！</h1><p>さくら保育園 割引クーポンのご案内</p></div>
    <div class="body">
      <p>${r.parentName} 様<br>この度で5回目のご利用となりました。<br>日頃のご愛顧に感謝して、割引クーポンをプレゼントいたします。</p>
      <div class="coupon-box">
        <p style="margin:0;font-weight:700;color:#78350F;font-size:1rem">次回ご利用時 20%OFF クーポン</p>
        <div class="coupon-code">${couponCode}</div>
        <p style="margin:8px 0 0;font-size:.8125rem;color:#92400E">ご来園の際にスタッフへコードをお伝えください</p>
      </div>
      <p style="font-size:.875rem;color:#6B7280">※有効期限：発行日から6ヶ月間｜1回のみ使用可</p>
    </div>`)
}

// ========== Cloud Functions ==========

// 1. 予約受付メール（予約作成時）
exports.onReservationCreate = onDocumentCreated('reservations/{id}', async (event) => {
  const r = { ...event.data.data(), id: event.params.id }
  if (!r.email) return
  await sendMail(r.email, '【さくら保育園】一時保育のご予約を承りました', confirmationHtml(r))
})

// 2. 予約確定メール & クーポンメール（statusがconfirmedになったとき）
exports.onReservationUpdate = onDocumentUpdated('reservations/{id}', async (event) => {
  const before = event.data.before.data()
  const after = { ...event.data.after.data(), id: event.params.id }
  if (before.status === after.status || after.status !== 'confirmed' || !after.email) return

  await sendMail(after.email, '【さくら保育園】ご予約が確定しました', confirmedHtml(after))

  if (after.couponCode) {
    await sendMail(
      after.email,
      '【さくら保育園】5回目のご利用ありがとうございます！割引クーポンのご案内',
      couponHtml(after, after.couponCode)
    )
  }
})

// 3. GASからのシフト同期エンドポイント（HTTP）
exports.syncShifts = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
  if (req.headers['x-sync-secret'] !== SYNC_SECRET) { res.status(401).send('Unauthorized'); return }

  const { shifts } = req.body
  if (!shifts || typeof shifts !== 'object') { res.status(400).send('Bad Request'); return }

  const batch = db.batch()
  // 既存のシフトを全削除してから再登録（スプシが正）
  const existing = await db.collection('shifts').get()
  existing.docs.forEach(d => batch.delete(d.ref))

  Object.entries(shifts).forEach(([date, slots]) => {
    batch.set(db.collection('shifts').doc(date), {
      slots,
      updatedAt: FieldValue.serverTimestamp(),
      source: 'gas',
    })
  })

  await batch.commit()
  res.json({ ok: true, dates: Object.keys(shifts).length })
})
