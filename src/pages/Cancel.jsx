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
    getAvailableDates, getAvailableStartTimes, getConsecutiveEndTimes,
  } = useApp()

  const [phone, setPhone] = useState('')
  const [searched, setSearched] = useState(false)
  const [cancelledId, setCancelledId] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [changing, setChanging] = useState(null)
  const [changeForm, setChangeForm] = useState({ date: '', startTime: '', endTime: '' })
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

  // 電話番号一致の予約（未キャンセル・今日以降のみ）
  const today = new Date().toISOString().split('T')[0]
  const matchedReservations = searched
    ? reservations.filter(r =>
        (r.phone === phone.replace(/-/g, '') || r.phone === phone) &&
        r.status !== 'cancelled' &&
        r.date >= today
      )
    : []

  // 名前確認後のみ表示
  const foundReservations = nameVerified ? matchedReservations : []

  const availableDates = getAvailableDates()
  const changeStartTimes = changeForm.date ? getAvailableStartTimes(changeForm.date) : []
  const changeEndTimes = changeForm.date && changeForm.startTime
    ? getConsecutiveEndTimes(changeForm.date, changeForm.startTime)
    : []

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
    const parts = r.timeSlot ? r.timeSlot.split('〜') : ['', '']
    setChanging(r.id)
    setChangeForm({ date: r.date, startTime: parts[0] || '', endTime: parts[1] || '' })
    setChangeError('')
    setConfirming(null)
  }

  const handleChange = async (r) => {
    if (!changeForm.date || !changeForm.startTime || !changeForm.endTime) {
      setChangeError('日付・開始時刻・終了時刻を選択してください')
      return
    }
    const timeSlot = `${changeForm.startTime}〜${changeForm.endTime}`
    const result = await changeReservation(r.id, { ...r, date: changeForm.date, timeSlot })
    if (result?.error === 'duplicate') {
      setChangeError('選択した日時・時間帯にはすでに予約があります。別の日時をお選びください。')
      return
    }
    setChangedId(r.id)
    setChanging(null)
  }

  const canModify = (r) => r.status === 'pending' || r.status === 'confirmed' || r.status === 'waitlisted'

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
          {r.status === 'confirmed' && <span className="badge badge-green">確定済み</span>}
          {r.status === 'pending' && <span className="badge badge-amber">確認中</span>}
          {r.status === 'waitlisted' && (() => {
            const pos = reservations
              .filter(x => x.date === r.date && x.timeSlot === r.timeSlot && x.status === 'waitlisted')
              .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
              .findIndex(x => x.id === r.id)
            return <span className="badge badge-purple">⏳ キャンセル待ち{pos >= 0 ? `（${pos + 1}番）` : ''}</span>
          })()}
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
              onChange={e => setChangeForm({ date: e.target.value, startTime: '', endTime: '' })}
            >
              <option value="">日付を選択</option>
              {availableDates.map(d => (
                <option key={d} value={d}>{formatDate(d)}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className="form-select"
                value={changeForm.startTime}
                onChange={e => setChangeForm(p => ({ ...p, startTime: e.target.value, endTime: '' }))}
                disabled={!changeForm.date}
                style={{ flex: 1 }}
              >
                <option value="">開始時刻</option>
                {changeStartTimes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span style={{ color: 'var(--g500)', fontWeight: 600 }}>〜</span>
              <select
                className="form-select"
                value={changeForm.endTime}
                onChange={e => setChangeForm(p => ({ ...p, endTime: e.target.value }))}
                disabled={!changeForm.startTime}
                style={{ flex: 1 }}
              >
                <option value="">終了時刻</option>
                {changeEndTimes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {changeForm.startTime && changeForm.endTime && (
              <p style={{ fontSize: '.8125rem', color: 'var(--g500)' }}>
                預け時間：{parseInt(changeForm.endTime) - parseInt(changeForm.startTime)}時間
              </p>
            )}
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
            {r.status !== 'waitlisted' && (
              <button className="btn btn-primary btn-sm" onClick={() => startChanging(r)}>
                変更する
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => setConfirming(r.id)}>
              {r.status === 'waitlisted' ? '待ちをキャンセル' : 'キャンセル'}
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
