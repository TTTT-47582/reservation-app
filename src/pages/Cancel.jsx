import { useState } from 'react'
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
  const {
    reservations, updateStatus, changeReservation,
    getAvailableDates, getAvailableSlots,
  } = useApp()

  const [phone, setPhone] = useState('')
  const [searched, setSearched] = useState(false)
  const [cancelledId, setCancelledId] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [changing, setChanging] = useState(null)
  const [changeForm, setChangeForm] = useState({ date: '', timeSlot: '' })
  const [changeError, setChangeError] = useState('')
  const [changedId, setChangedId] = useState(null)
  // 2段階確認
  const [nameInput, setNameInput] = useState('')
  const [nameVerified, setNameVerified] = useState(false)
  const [nameError, setNameError] = useState('')

  const reservationId = searchParams.get('id')
  const directReservation = reservationId
    ? reservations.find(r => r.id === reservationId)
    : null

  // 電話番号一致の予約（未キャンセル）
  const matchedReservations = searched
    ? reservations.filter(r =>
        (r.phone === phone.replace(/-/g, '') || r.phone === phone) &&
        r.status !== 'cancelled'
      )
    : []

  // 名前確認後のみ表示
  const foundReservations = nameVerified ? matchedReservations : []

  const availableDates = getAvailableDates()
  const changeSlots = changeForm.date ? getAvailableSlots(changeForm.date) : []

  const handleSearch = (e) => {
    e.preventDefault()
    setSearched(true)
    setNameVerified(false)
    setNameInput('')
    setNameError('')
    setCancelledId(null)
    setChangedId(null)
  }

  const handleVerifyName = (e) => {
    e.preventDefault()
    const input = nameInput.trim().replace(/\s/g, '')
    if (input.length < 2) {
      setNameError('2文字以上入力してください')
      return
    }
    const matched = matchedReservations.some(r =>
      r.childKana?.replace(/\s/g, '').startsWith(input) ||
      r.childName?.replace(/\s/g, '').startsWith(input)
    )
    if (matched) {
      setNameVerified(true)
      setNameError('')
    } else {
      setNameError('お名前が一致しませんでした。カタカナで入力してください')
      setNameInput('')
    }
  }

  const handleCancel = async (r) => {
    await updateStatus(r.id, 'cancelled')
    setCancelledId(r.id)
    setConfirming(null)
  }

  const startChanging = (r) => {
    setChanging(r.id)
    setChangeForm({ date: r.date, timeSlot: r.timeSlot })
    setChangeError('')
    setConfirming(null)
  }

  const handleChange = async (r) => {
    if (!changeForm.date || !changeForm.timeSlot) {
      setChangeError('日付と時間帯を選択してください')
      return
    }
    const result = await changeReservation(r.id, { ...r, date: changeForm.date, timeSlot: changeForm.timeSlot })
    if (result?.error === 'duplicate') {
      setChangeError('選択した日時・時間帯にはすでに予約があります。別の日時をお選びください。')
      return
    }
    setChangedId(r.id)
    setChanging(null)
  }

  const canModify = (r) => r.status === 'pending' || r.status === 'confirmed'

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

      {changedId === r.id ? (
        <div className="cancel-done">✅ 変更しました</div>
      ) : cancelledId === r.id ? (
        <div className="cancel-done">✅ キャンセルしました</div>
      ) : changing === r.id ? (
        <div style={{ marginTop: '12px', width: '100%' }}>
          <p style={{ fontWeight: 600, marginBottom: '10px', fontSize: '.9rem' }}>変更後の日時を選択してください</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <select
              className="form-select"
              value={changeForm.date}
              onChange={e => setChangeForm({ date: e.target.value, timeSlot: '' })}
            >
              <option value="">日付を選択</option>
              {availableDates.map(d => (
                <option key={d} value={d}>{formatDate(d)}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={changeForm.timeSlot}
              onChange={e => setChangeForm(p => ({ ...p, timeSlot: e.target.value }))}
              disabled={!changeForm.date}
            >
              <option value="">時間帯を選択</option>
              {changeSlots.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {changeError && (
            <p style={{ color: '#DC2626', fontSize: '.8125rem', marginTop: '6px' }}>{changeError}</p>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleChange(r)}>
              変更を確定
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setChanging(null)}>
              戻る
            </button>
          </div>
        </div>
      ) : canModify(r) ? (
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => startChanging(r)}>
              変更する
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirming(r.id)}>
              キャンセル
            </button>
          </div>
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
            予約のキャンセル・変更
          </h1>
          <p style={{ color: 'var(--g500)', fontSize: '.9375rem' }}>
            キャンセルポリシー：前日まで無料 / 当日はキャンセル料（半額）が発生します
          </p>
        </div>

        {directReservation ? (
          <div>
            <h2 style={{ fontWeight: 700, color: 'var(--g700)', marginBottom: '16px' }}>予約内容</h2>
            <ReservationCard r={directReservation} />
          </div>
        ) : (
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

              {searched && matchedReservations.length === 0 && (
                <p style={{ marginTop: '16px', color: 'var(--g500)', fontSize: '.875rem' }}>
                  この電話番号の予約が見つかりませんでした
                </p>
              )}

              {searched && matchedReservations.length > 0 && !nameVerified && (
                <div style={{ marginTop: '16px', background: 'var(--green50)', border: '1px solid var(--green200)', borderRadius: 'var(--r-md)', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: 'var(--green800)', marginBottom: '8px' }}>🔒 本人確認</p>
                  <p style={{ fontSize: '.875rem', color: 'var(--g600)', marginBottom: '12px' }}>
                    {matchedReservations.length}件の予約が見つかりました。<br />
                    お子様のお名前（カタカナ）の最初の2文字以上を入力してください
                  </p>
                  <form onSubmit={handleVerifyName}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        className="form-input"
                        placeholder="例：ヤマダ"
                        value={nameInput}
                        onChange={e => { setNameInput(e.target.value); setNameError('') }}
                      />
                      <button className="btn btn-primary" type="submit">確認</button>
                    </div>
                    {nameError && (
                      <p style={{ color: '#DC2626', fontSize: '.8125rem', marginTop: '6px' }}>{nameError}</p>
                    )}
                  </form>
                </div>
              )}

              {foundReservations.map(r => (
                <div key={r.id} style={{ marginTop: '16px' }}>
                  <ReservationCard r={r} />
                </div>
              ))}
            </div>
          </div>
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
