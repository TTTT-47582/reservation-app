import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, TIME_SLOTS } from '../context/AppContext'

const STATUS_LABEL = { pending: '未確認', confirmed: '確定', cancelled: 'キャンセル' }
const STATUS_BADGE = { pending: 'badge-amber', confirmed: 'badge-green', cancelled: 'badge-gray' }

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${dt.getMonth() + 1}/${dt.getDate()}（${days[dt.getDay()]}）`
}

function formatDateFull(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`
}

export default function Admin() {
  const navigate = useNavigate()
  const { reservations, updateStatus, deleteReservation, shifts, addShiftSlot, removeShiftSlot, addShiftDate, getAvailableDates, visitCounts, coupons, markCouponUsed } = useApp()
  const [tab, setTab] = useState('reservations')
  const [filter, setFilter] = useState('all')
  const [newShiftDate, setNewShiftDate] = useState('')
  const [newSlot, setNewSlot] = useState({})

  const filtered = reservations.filter(r =>
    filter === 'all' ? true :
    filter === 'coupon' ? r.couponInfo !== null :
    r.status === filter
  )

  const stats = {
    total: reservations.length,
    pending: reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    coupon: Object.keys(coupons).length,
  }

  const handleAddShiftDate = () => {
    if (!newShiftDate) return
    addShiftDate(newShiftDate)
    setNewShiftDate('')
  }

  const handleAddSlot = (date) => {
    const slot = newSlot[date]
    if (!slot) return
    addShiftSlot(date, slot)
    setNewSlot(prev => ({ ...prev, [date]: '' }))
  }

  const availableDates = getAvailableDates()

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-logo">
            🌸 さくら保育園
            <span className="admin-logo-sub">管理者ダッシュボード</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/')}>
            サイトへ戻る
          </button>
        </div>
      </div>

      <div className="admin-body">
        <div className="admin-body-inner">
          {/* Tabs */}
          <div className="admin-tabs">
            <button className={`admin-tab${tab === 'reservations' ? ' active' : ''}`} onClick={() => setTab('reservations')}>
              📋 予約一覧
            </button>
            <button className={`admin-tab${tab === 'shifts' ? ' active' : ''}`} onClick={() => setTab('shifts')}>
              📅 シフト管理
            </button>
            <button className={`admin-tab${tab === 'coupons' ? ' active' : ''}`} onClick={() => setTab('coupons')}>
              🎟️ クーポン管理
            </button>
          </div>

          {/* ===== 予約一覧 ===== */}
          {tab === 'reservations' && (
            <>
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-val blue">{stats.total}</div>
                  <div className="stat-label">総予約数</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val" style={{ color: 'var(--amber600)' }}>{stats.pending}</div>
                  <div className="stat-label">未確認</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val green">{stats.confirmed}</div>
                  <div className="stat-label">確定済み</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val yellow">{stats.coupon}</div>
                  <div className="stat-label">クーポン付与数</div>
                </div>
              </div>

              <div className="filter-bar">
                {[['all', '全て'], ['pending', '未確認'], ['confirmed', '確定'], ['cancelled', 'キャンセル'], ['coupon', 'クーポンあり']].map(([v, l]) => (
                  <button key={v} className={`filter-btn${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>
                    {l} {v === 'all' ? `(${stats.total})` : v === 'pending' ? `(${stats.pending})` : v === 'confirmed' ? `(${stats.confirmed})` : ''}
                  </button>
                ))}
              </div>

              <div className="res-list">
                {filtered.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <div className="empty-text">該当する予約はありません</div>
                  </div>
                )}
                {filtered.map(r => (
                  <div key={r.id} className={`res-item${r.status === 'confirmed' ? ' done' : ''}`}>
                    <div className="res-body">
                      <div className="res-name">
                        {r.parentName}
                        <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        {r.couponCode && <span className="badge badge-yellow">🎟️ クーポン付与済</span>}
                        {r.couponInfo && !r.couponCode && <span className="badge badge-yellow">🎟️ クーポン所持</span>}
                        {r.visitCount >= 5 && <span className="badge badge-blue">👑 {r.visitCount}回目</span>}
                      </div>
                      <div className="res-meta">
                        <span className="res-meta-item">📅 {formatDate(r.date)} {r.timeSlot}</span>
                        <span className="res-meta-item">👶 {r.childName}</span>
                        <span className="res-meta-item">📱 LINE: {r.lineName}</span>
                        <span className="res-meta-item">☎ {r.phone}</span>
                        <span className="res-meta-item">🎯 {r.purpose}</span>
                      </div>
                      {r.notes && (
                        <div style={{ fontSize: '.8125rem', color: 'var(--g500)', marginTop: '4px' }}>
                          📝 {r.notes}
                        </div>
                      )}
                    </div>
                    <div className="res-actions">
                      {r.status === 'pending' && (
                        <button className="btn btn-sm btn-success" onClick={() => updateStatus(r.id, 'confirmed')}>
                          確定
                        </button>
                      )}
                      {r.status === 'confirmed' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(r.id, 'pending')}>
                          戻す
                        </button>
                      )}
                      {r.status !== 'cancelled' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(r.id, 'cancelled')}>
                          ✕
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('削除しますか？')) deleteReservation(r.id) }}>
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== シフト管理 ===== */}
          {tab === 'shifts' && (
            <>
              <div style={{ background: 'var(--white)', borderRadius: 'var(--r-lg)', padding: '20px 24px', border: '1px solid var(--g200)', marginBottom: '24px' }}>
                <div style={{ fontWeight: 700, color: 'var(--g700)', marginBottom: '12px', fontSize: '.9375rem' }}>
                  📅 新しい日程を追加
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">日付</label>
                    <input className="form-input" type="date" value={newShiftDate} onChange={e => setNewShiftDate(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" onClick={handleAddShiftDate}>
                    追加
                  </button>
                </div>
                <p className="form-hint">日程を追加後、各日に時間帯を設定してください</p>
              </div>

              {availableDates.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <div className="empty-text">登録されているシフトはありません</div>
                </div>
              ) : (
                <div className="shift-grid">
                  {availableDates.map(date => (
                    <div key={date} className="shift-card">
                      <div className="shift-date">
                        <span>{formatDateFull(date)}</span>
                        <button className="btn btn-sm btn-danger" style={{ padding: '3px 10px', fontSize: '.75rem' }}
                          onClick={() => { if (confirm(`${formatDateFull(date)}のシフトを全削除しますか？`)) { ;(shifts[date] || []).forEach(s => removeShiftSlot(date, s)) } }}>
                          削除
                        </button>
                      </div>
                      <div className="shift-slots">
                        {(shifts[date] || []).length === 0 && (
                          <p style={{ fontSize: '.8125rem', color: 'var(--g400)' }}>時間帯が未設定です</p>
                        )}
                        {(shifts[date] || []).map(slot => (
                          <div key={slot} className="shift-slot">
                            <span>{slot}</span>
                            <span className="shift-slot-remove" onClick={() => removeShiftSlot(date, slot)}>✕</span>
                          </div>
                        ))}
                      </div>
                      <div className="shift-add-row">
                        <select className="form-select" style={{ fontSize: '.8125rem', padding: '6px 10px' }}
                          value={newSlot[date] || ''}
                          onChange={e => setNewSlot(prev => ({ ...prev, [date]: e.target.value }))}>
                          <option value="">時間帯を選択</option>
                          {TIME_SLOTS.filter(s => !(shifts[date] || []).includes(s)).map(s => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-outline" onClick={() => handleAddSlot(date)}>追加</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== クーポン管理 ===== */}
          {tab === 'coupons' && (
            <>
              <div style={{ background: 'var(--white)', borderRadius: 'var(--r-lg)', padding: '16px 20px', border: '1px solid var(--g200)', marginBottom: '20px', fontSize: '.875rem', color: 'var(--g600)' }}>
                💡 5回目のご利用時に自動でクーポンが発行されます。「使用済み」にすることで二重利用を防止できます。
              </div>

              {Object.keys(coupons).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🎟️</div>
                  <div className="empty-text">クーポン付与者はまだいません</div>
                </div>
              ) : (
                <div className="coupon-table">
                  <div className="coupon-table-row header">
                    <div className="coupon-user">利用者（電話番号）</div>
                    <div className="coupon-code-display">クーポンコード</div>
                    <div className="coupon-visits">累計</div>
                    <div style={{ minWidth: '80px' }}>発行日</div>
                    <div style={{ minWidth: '100px' }}>ステータス</div>
                    <div style={{ minWidth: '80px' }}></div>
                  </div>
                  {Object.entries(coupons).map(([phone, info]) => (
                    <div key={phone} className="coupon-table-row">
                      <div className="coupon-user">
                        {/* 電話番号から利用者名を逆引き */}
                        {(() => {
                          const r = reservations.find(r => r.phone === phone)
                          return r ? `${r.parentName}（${phone}）` : phone
                        })()}
                      </div>
                      <div className="coupon-code-display">{info.code}</div>
                      <div className="coupon-visits">{visitCounts[phone] || 0}回</div>
                      <div style={{ fontSize: '.8125rem', color: 'var(--g500)', minWidth: '80px' }}>
                        {new Date(info.issuedAt).toLocaleDateString('ja-JP')}
                      </div>
                      <div style={{ minWidth: '100px' }}>
                        {info.used
                          ? <span className="badge badge-gray">使用済み</span>
                          : <span className="badge badge-green">未使用</span>}
                      </div>
                      <div style={{ minWidth: '80px' }}>
                        {!info.used && (
                          <button className="btn btn-sm btn-secondary" onClick={() => markCouponUsed(phone)}>
                            使用済みに
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 利用回数一覧 */}
              <div style={{ marginTop: '28px', fontWeight: 700, color: 'var(--g700)', marginBottom: '12px' }}>
                利用回数ランキング
              </div>
              <div className="coupon-table">
                <div className="coupon-table-row header">
                  <div className="coupon-user">利用者</div>
                  <div className="coupon-visits">利用回数</div>
                  <div style={{ flex: 1 }}>クーポン状況</div>
                </div>
                {Object.entries(visitCounts)
                  .sort(([,a],[,b]) => b - a)
                  .map(([phone, count]) => {
                    const r = reservations.find(r => r.phone === phone)
                    const coupon = coupons[phone]
                    return (
                      <div key={phone} className="coupon-table-row">
                        <div className="coupon-user">{r ? `${r.parentName}（${phone}）` : phone}</div>
                        <div className="coupon-visits">{count}回</div>
                        <div style={{ flex: 1 }}>
                          {coupon
                            ? coupon.used
                              ? <span className="badge badge-gray">使用済み</span>
                              : <span className="badge badge-green">クーポン未使用</span>
                            : count >= 4
                              ? <span className="badge badge-amber">次回付与予定</span>
                              : <span style={{ fontSize: '.8125rem', color: 'var(--g400)' }}>あと{5 - count}回で付与</span>
                          }
                        </div>
                      </div>
                    )
                  })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
