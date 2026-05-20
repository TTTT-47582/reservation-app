import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useApp, TIME_SLOTS, NURSE_COLORS } from '../context/AppContext'
import { sendConfirmedEmail, sendCouponEmail } from '../lib/email'

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
  const {
    reservations, updateStatus, deleteReservation,
    shifts, nurses, addNurse, deleteNurse,
    addShiftDate, removeShiftDate, addNurseToSlot, removeNurseFromSlot,
    getAvailableDates, getAvailableSlots, getSlotNurses,
    visitCounts, coupons, markCouponUsed, reissueCoupon,
    closedDates, addClosedDate, removeClosedDate,
  } = useApp()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
      if (!u) navigate('/login')
    })
  }, [navigate])

  const [tab, setTab] = useState('reservations')
  const [filter, setFilter] = useState('all')
  const [newNurseName, setNewNurseName] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [newClosedDate, setNewClosedDate] = useState('')

  if (authLoading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--g900)', color:'var(--white)', fontSize:'1rem' }}>読み込み中…</div>
  if (!user) return null

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

  const handleAddNurse = async () => {
    if (!newNurseName.trim()) return
    await addNurse(newNurseName)
    setNewNurseName('')
  }

  const availableDates = getAvailableDates()
  const today = new Date().toISOString().split('T')[0]
  const allShiftDates = Object.keys(shifts)
    .filter(date => date >= today && date.startsWith(selectedMonth))
    .sort()

  const shiftMonths = [...new Set(
    Object.keys(shifts).filter(date => date >= today).map(date => date.slice(0, 7))
  )].sort()

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-logo">
            🌳 けやき保育園
            <span className="admin-logo-sub">管理者ダッシュボード</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '.8125rem', color: 'var(--g400)' }}>{user.email}</span>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/')}>サイトへ戻る</button>
            <button className="btn btn-sm btn-secondary" onClick={() => signOut(auth).then(() => navigate('/login'))}>ログアウト</button>
          </div>
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
            <button className={`admin-tab${tab === 'closed' ? ' active' : ''}`} onClick={() => setTab('closed')}>
              🚫 休園日
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
                        {r.couponApplied && <span className="badge badge-green">🎟️ クーポン使用</span>}
                        {r.couponInfo && !r.couponCode && !r.couponApplied && <span className="badge badge-yellow">🎟️ クーポン所持</span>}
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
                        <button className="btn btn-sm btn-success" onClick={async () => {
                          await updateStatus(r.id, 'confirmed')
                          await sendConfirmedEmail(r).catch(() => {})
                          if (r.couponCode) await sendCouponEmail(r, r.couponCode).catch(() => {})
                          if (r.couponApplied) await markCouponUsed(r.phone)
                        }}>
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
              {/* 保育士一覧 */}
              <div className="nurse-mgmt-card">
                <div className="nurse-mgmt-title">👩‍⚕️ 保育士一覧</div>
                <div className="nurse-add-row">
                  <input className="form-input" placeholder="保育士のお名前を入力"
                    value={newNurseName} onChange={e => setNewNurseName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNurse()} />
                  <button className="btn btn-primary" onClick={handleAddNurse}>追加</button>
                </div>
                {nurses.length === 0 ? (
                  <p style={{ fontSize: '.875rem', color: 'var(--g400)', marginTop: '10px' }}>
                    まず保育士を登録してください
                  </p>
                ) : (
                  <div className="nurse-chip-list">
                    {nurses.map((n, i) => (
                      <span key={n.id} className="nurse-chip" style={{ background: NURSE_COLORS[i % NURSE_COLORS.length] }}>
                        {n.name}
                        <button className="nurse-chip-del" onClick={() => { if (confirm(`${n.name}を削除しますか？`)) deleteNurse(n.id) }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 月選択 */}
              <div className="nurse-mgmt-card">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--g700)' }}>📅 表示月</span>
                  <select className="form-select" style={{ width: 'auto' }}
                    value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                    {shiftMonths.map(m => {
                      const [y, mo] = m.split('-')
                      return <option key={m} value={m}>{y}年{parseInt(mo)}月</option>
                    })}
                  </select>
                </div>
              </div>

              {/* シフト入力グリッド */}
              {allShiftDates.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <div className="empty-text">登録されているシフトはありません</div>
                </div>
              ) : (
                <div className="shift-grid">
                  {allShiftDates.map(date => (
                    <div key={date} className="shift-card">
                      <div className="shift-date">
                        <span>{formatDateFull(date)}</span>
                        <button className="nurse-chip-del" style={{ fontSize: '.8rem', padding: '3px 8px', borderRadius: 'var(--r)', background: 'var(--red50)', color: 'var(--red500)' }}
                          onClick={() => { if (confirm(`${formatDateFull(date)}のシフトを削除しますか？`)) removeShiftDate(date) }}>
                          削除
                        </button>
                      </div>

                      <table className="shift-nurse-table">
                        <tbody>
                          {TIME_SLOTS.map(slot => {
                            const assigned = getSlotNurses(date, slot)
                            const unassigned = nurses.filter(n => !assigned.find(a => a.id === n.id))
                            return (
                              <tr key={slot} className={assigned.length > 0 ? 'slot-active' : 'slot-empty'}>
                                <td className="slot-time">{slot}</td>
                                <td className="slot-nurses">
                                  <div className="slot-nurse-row">
                                    {assigned.map((n, i) => (
                                      <span key={n.id} className="nurse-chip-sm"
                                        style={{ background: NURSE_COLORS[nurses.findIndex(x => x.id === n.id) % NURSE_COLORS.length] }}>
                                        {n.name}
                                        <button className="nurse-chip-del" onClick={() => removeNurseFromSlot(date, slot, n.id)}>×</button>
                                      </span>
                                    ))}
                                    {unassigned.length > 0 && (
                                      <select className="slot-add-select"
                                        value="" onChange={e => { if (e.target.value) addNurseToSlot(date, slot, e.target.value) }}>
                                        <option value="">＋ 追加</option>
                                        {unassigned.map(n => (
                                          <option key={n.id} value={n.id}>{n.name}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== 休園日管理 ===== */}
          {tab === 'closed' && (
            <>
              <div className="nurse-mgmt-card">
                <div className="nurse-mgmt-title">🚫 休園日を追加</div>
                <p style={{ fontSize: '.875rem', color: 'var(--g500)', marginBottom: '12px' }}>
                  登録した日は予約フォーム・カレンダーに表示されなくなります。
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    className="form-input"
                    type="date"
                    value={newClosedDate}
                    min={today}
                    style={{ maxWidth: '200px' }}
                    onChange={e => setNewClosedDate(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={async () => {
                    if (!newClosedDate) return
                    await addClosedDate(newClosedDate)
                    setNewClosedDate('')
                  }}>
                    追加
                  </button>
                </div>
              </div>

              <div className="nurse-mgmt-card">
                <div className="nurse-mgmt-title">📋 登録済み休園日</div>
                {closedDates.filter(d => d >= today).sort().length === 0 ? (
                  <p style={{ fontSize: '.875rem', color: 'var(--g400)', marginTop: '8px' }}>
                    休園日は登録されていません
                  </p>
                ) : (
                  <div>
                    {closedDates.filter(d => d >= today).sort().map(date => (
                      <div key={date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--g100)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--g700)' }}>{formatDateFull(date)}</span>
                        <button className="btn btn-sm btn-danger" onClick={() => {
                          if (confirm(`${formatDateFull(date)}を休園日から外しますか？`)) removeClosedDate(date)
                        }}>
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                      <div style={{ minWidth: '130px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {!info.used && (
                          <button className="btn btn-sm btn-secondary" onClick={() => markCouponUsed(phone)}>
                            使用済みに
                          </button>
                        )}
                        <button className="btn btn-sm btn-secondary" onClick={async () => {
                          if (confirm(`${phone} のクーポンを再発行しますか？\n現在のコードは無効になります。`)) {
                            await reissueCoupon(phone)
                          }
                        }}>
                          再発行
                        </button>
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
