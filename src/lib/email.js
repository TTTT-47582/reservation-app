import emailjs from '@emailjs/browser'

const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const T_CONFIRM   = import.meta.env.VITE_EMAILJS_TEMPLATE_CONFIRMATION
const T_CONFIRMED = import.meta.env.VITE_EMAILJS_TEMPLATE_CONFIRMED
const T_COUPON    = import.meta.env.VITE_EMAILJS_TEMPLATE_COUPON

// EmailJS未設定の場合は送信をスキップ
const isReady = () => PUBLIC_KEY && SERVICE_ID

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${days[dt.getDay()]}）`
}

function baseParams(r) {
  return {
    to_email:     r.email,
    to_name:      r.parentName,
    child_name:   r.childName,
    date:         formatDate(r.date),
    time_slot:    r.timeSlot,
    purpose:      r.purpose,
    reservation_no: `#${String(r.id).slice(-6)}`,
  }
}

// 予約受付メール（フォーム送信直後）
export async function sendConfirmationEmail(reservation) {
  if (!isReady() || !reservation.email) return
  await emailjs.send(SERVICE_ID, T_CONFIRM, baseParams(reservation), PUBLIC_KEY)
}

// 予約確定メール（管理者が「確定」ボタンを押したとき）
export async function sendConfirmedEmail(reservation) {
  if (!isReady() || !reservation.email) return
  await emailjs.send(SERVICE_ID, T_CONFIRMED, baseParams(reservation), PUBLIC_KEY)
}

// クーポンメール（5回目のご利用確定時）
export async function sendCouponEmail(reservation, couponCode) {
  if (!isReady() || !reservation.email) return
  await emailjs.send(SERVICE_ID, T_COUPON, {
    ...baseParams(reservation),
    coupon_code: couponCode,
  }, PUBLIC_KEY)
}
