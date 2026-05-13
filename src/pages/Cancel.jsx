import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${DAYS[dt.getDay()]}）`
}

export default function Cancel() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { reservations, updateStatus } = useApp()

  const [phone, setPhone] = useState('')
  const [searched, setSearched] = useState(false)
  const [cancelledId, setCancelledId] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const reservationId = searchParams.get('id')

  // メールリンクから来た場合：IDで直接表示
  const directReservation = reservationId
    ? reservations.find(r => r.id === reservationId)
    : null

  // 電話番号検索結果
  const foundReservations = searched
    ? reservations.filter(r =>
        r.phone === phone.replace(/-/g, '') || r.phone === phone
      ).filter(r => r.status !== 'cancelled')
    : []

  const handleSearch = (e) => {
    e.preventDefault()
    setSearched(true)
    setCancelledId(null)
  }

  const handleCancel = async (reservation) => {
    await updateStatus(reservation.id, 'cancelled')
    setCancelledId(reservation.id)
    setConfirming(null)
  }

  const canCancel = (r) => r.status === 'pending' || r.status === 'confirmed'

  const ReservationCard = ({ r }) => (
    <div className="cancel-card">
      <div className="cancel-card-info">
        <div className="cancel-card-name">{r.parentName} 様</div>
        <div className="cancel-card-meta">
          <span>📅 {formatDate(r.date)}</span>
          <span>⏰ {r.timeSlot}</span>
          <span>👶 {r.childName}</span>
          <span>🎯 {r.purpose}</span>
        </div>
        <div style={{ marginTop: '6px' }}>
          <span className={`badge ${r.status === 'confirmed' ? 'badge-green' : 'badge-amber'}`}>
            {r.status === 'confirmed' ? '確定済み' : '確認中'}
          </span>
        </div>
      </div>

      {cancelledId === r.id ? (
        <div className="cancel-done">
          ✅ キャンセルしました
        </div>
      ) : canCancel(r) ? (
        confirming === r.id ? (
          <div className="cancel-confirm-box">
            <p>本当にキャンセルしますか？</p>
            <p style={{ fontSize: '.8125rem', color: 'var(--g500)' }}>
              ※前日までは無料・当日はキャンセル料が発生します
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-danger btn-sm" onClick={() => handleCancel(r)}>
                キャンセルする
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirming(null)}>
                戻る
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={() => setConfirming(r.id)}>
            キャンセル
          </button>
        )
      ) : (
        <span style={{ fontSize: '.875rem', color: 'var(--g400)' }}>キャンセル済み</span>
      )}
    </div>
  )

  return (
    <div className="page">
      <Header />
      <div className="form-wrap" style={{ maxWidth: '560px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--g800)', marginBottom: '8px' }}>
            予約のキャンセル
          </h1>
          <p style={{ color: 'var(--g500)', fontSize: '.9375rem' }}>
            キャンセルポリシー：前日まで無料 / 当日はキャンセル料（半額）が発生します
          </p>
        </div>

        {/* メールリンクから来た場合 */}
        {directReservation ? (
          <div>
            <h2 style={{ fontWeight: 700, color: 'var(--g700)', marginBottom: '16px' }}>予約内容</h2>
            <ReservationCard r={directReservation} />
          </div>
        ) : (
          <>
            <div className="form-section">
              <div className="form-section-hd">
                <span className="form-section-icon">📱</span>
                <span className="form-section-title">電話番号で予約を検索</span>
              </div>
              <div className="form-section-body">
                <form onSubmit={handleSearch}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      className="form-input"
                      type="tel"
                      placeholder="090-1234-5678"
                      value={phone}
                      onChange={e => { setPhone(e.target.value); setSearched(false) }}
                    />
                    <button className="btn btn-primary" type="submit">検索</button>
                  </div>
                </form>

                {searched && foundReservations.length === 0 && (
                  <p style={{ marginTop: '16px', color: 'var(--g500)', fontSize: '.875rem' }}>
                    この電話番号の予約が見つかりませんでした
                  </p>
                )}

                {foundReservations.map(r => (
                  <div key={r.id} style={{ marginTop: '16px' }}>
                    <ReservationCard r={r} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            トップページへ戻る
          </button>
        </div>
      </div>
    </div>
  )
}
