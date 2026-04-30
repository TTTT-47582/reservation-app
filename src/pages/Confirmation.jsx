import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function Confirmation() {
  const navigate = useNavigate()
  const { lastReservation } = useApp()

  useEffect(() => {
    if (!lastReservation) navigate('/')
  }, [lastReservation, navigate])

  if (!lastReservation) return null

  const r = lastReservation
  const formatDate = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${days[dt.getDay()]}）`
  }

  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-icon">✅</div>
        <h1 className="confirm-title">予約を受け付けました</h1>
        <p className="confirm-subtitle">
          内容を確認後、担当者よりお電話またはLINEにてご連絡いたします。<br />
          確認が取れた時点で予約確定となります。
        </p>

        {/* クーポン付与 */}
        {r.couponCode && (
          <div className="coupon-banner">
            <div className="coupon-banner-title">🎉 5回目のご利用ありがとうございます！</div>
            <div style={{ fontSize: '.875rem', color: '#78350F', marginBottom: '8px' }}>
              次回ご利用時に使える割引クーポンをプレゼントします
            </div>
            <div className="coupon-code">{r.couponCode}</div>
            <div className="coupon-desc">
              次回ご来園の際に、スタッフへこのコードをお伝えください。（20%割引）
            </div>
          </div>
        )}

        {/* 予約内容 */}
        <div className="confirm-detail">
          <div className="detail-row">
            <span className="detail-label">保護者氏名</span>
            <span className="detail-value">{r.parentName}（{r.parentKana}）</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">LINEお名前</span>
            <span className="detail-value">{r.lineName}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">電話番号</span>
            <span className="detail-value">{r.phone}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">お子様のお名前</span>
            <span className="detail-value">{r.childName}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">希望利用日</span>
            <span className="detail-value">{formatDate(r.date)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">希望時間帯</span>
            <span className="detail-value">{r.timeSlot}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">利用目的</span>
            <span className="detail-value">{r.purpose}</span>
          </div>
          {r.notes && (
            <div className="detail-row">
              <span className="detail-label">特記事項</span>
              <span className="detail-value">{r.notes}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">累計利用回数</span>
            <span className="detail-value">{r.visitCount}回目</span>
          </div>
        </div>

        <div className="confirm-note">
          📌 予約番号：<strong>#{String(r.id).slice(-6)}</strong><br />
          お問い合わせの際はこの番号をお伝えください。
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/')}>
          トップページへ戻る
        </button>
      </div>
    </div>
  )
}
