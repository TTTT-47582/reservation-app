import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, storage } from '../firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useApp, TIME_SLOTS, NURSE_COLORS } from '../context/AppContext'
import { sendConfirmedEmail, sendCouponEmail } from '../lib/email'

const STATUS_LABEL = { pending: '未確認', confirmed: '確定', cancelled: 'キャンセル', waitlisted: 'キャンセル待ち' }
const STATUS_BADGE = { pending: 'badge-amber', confirmed: 'badge-green', cancelled: 'badge-gray', waitlisted: 'badge-purple' }

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
    getAvailableDates, getAvailableSlots, getSlotNurses, getSlotCapacity,
    visitCounts, coupons, markCouponUsed, reissueCoupon,
    closedDates, addClosedDate, removeClosedDate,
    photoAlbums, createPhotoAlbum, addPhotoUrl, removePhotoUrl, deletePhotoAlbum,
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
  const [statsMonth, setStatsMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [newClosedDate, setNewClosedDate] = useState('')
  const [photoForm, setPhotoForm] = useState({ childName: '', parentName: '', phone: '', date: new Date().toISOString().split('T')[0], expiryDays: 3 })
  const [photoFormRes, setPhotoFormRes] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const fileInputRef = useRef({})

  if (authLoading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--g900)', color:'var(--white)', fontSize:'1rem' }}>読み込み中…</div>
  if (!user) return null

  const filtered = reservations.filter(r =>
    filter === 'all' ? r.status !== 'waitlisted' :
    filter === 'coupon' ? r.couponInfo !== null :
    r.status === filter
  )

  // 累計統計
  const stats = {
    total: reservations.filter(r => r.status !== 'waitlisted').length,
    pending: reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    waitlisted: reservations.filter(r => r.status === 'waitlisted').length,
    coupon: Object.keys(coupons).length,
  }

  // 月別統計（選択月の予約日ベース）
  const monthlyRes = reservations.filter(r => r.date?.startsWith(statsMonth))
  const monthlyStats = {
    total: monthlyRes.length,
    pending: monthlyRes.filter(r => r.status === 'pending').length,
    confirmed: monthlyRes.filter(r => r.status === 'confirmed').length,
    cancelled: monthlyRes.filter(r => r.status === 'cancelled').length,
    coupon: Object.values(coupons).filter(c => c.issuedAt?.startsWith(statsMonth)).length,
  }

  // 月選択肢（過去12ヶ月 + 来月まで）
  const statsMonthOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - 12 + i)
    return d.toISOString().slice(0, 7)
  }).reverse()

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
            {/* 写真送付タブ：Firebase Storage（Blaze）が必要なため一時非表示
            <button className={`admin-tab${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')}>
              📸 写真送付
            </button>
            */}
            <button className={`admin-tab${tab === 'coupons' ? ' active' : ''}`} onClick={() => setTab('coupons')}>
              🎟️ クーポン管理
            </button>
          </div>

          {/* ===== 予約一覧 ===== */}
          {tab === 'reservations' && (
            <>
              {/* 月別統計 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '.9375rem', color: 'var(--green800)' }}>📅 月別統計</span>
                <select className="form-select" style={{ width: 'auto', fontSize: '.875rem', padding: '6px 32px 6px 12px' }}
                  value={statsMonth} onChange={e => setStatsMonth(e.target.value)}>
                  {statsMonthOptions.map(m => {
                    const [y, mo] = m.split('-')
                    return <option key={m} value={m}>{y}年{parseInt(mo)}月</option>
                  })}
                </select>
              </div>
              <div className="stats-row" style={{ marginBottom: '10px' }}>
                <div className="stat-card" style={{ borderTopColor: 'var(--green500)' }}>
                  <div className="stat-val blue">{monthlyStats.total}</div>
                  <div className="stat-label">予約数</div>
                </div>
                <div className="stat-card" style={{ borderTopColor: 'var(--amber400)' }}>
                  <div className="stat-val" style={{ color: 'var(--amber600)' }}>{monthlyStats.pending}</div>
                  <div className="stat-label">未確認</div>
                </div>
                <div className="stat-card" style={{ borderTopColor: 'var(--green400)' }}>
                  <div className="stat-val green">{monthlyStats.confirmed}</div>
                  <div className="stat-label">確定済み</div>
                </div>
                <div className="stat-card" style={{ borderTopColor: 'var(--sun400)' }}>
                  <div className="stat-val yellow">{monthlyStats.coupon}</div>
                  <div className="stat-label">クーポン付与</div>
                </div>
              </div>

              {/* 累計統計 */}
              <div style={{ fontWeight: 800, fontSize: '.9375rem', color: 'var(--g500)', marginBottom: '12px', marginTop: '20px' }}>
                📊 累計
              </div>
              <div className="stats-row">
                <div className="stat-card" style={{ borderTopColor: 'var(--g300)', background: 'var(--g50)' }}>
                  <div className="stat-val blue">{stats.total}</div>
                  <div className="stat-label">総予約数</div>
                </div>
                <div className="stat-card" style={{ borderTopColor: 'var(--g300)', background: 'var(--g50)' }}>
                  <div className="stat-val" style={{ color: 'var(--amber600)' }}>{stats.pending}</div>
                  <div className="stat-label">未確認（現在）</div>
                </div>
                <div className="stat-card" style={{ borderTopColor: 'var(--g300)', background: 'var(--g50)' }}>
                  <div className="stat-val green">{stats.confirmed}</div>
                  <div className="stat-label">確定済み（現在）</div>
                </div>
                <div className="stat-card" style={{ borderTopColor: 'var(--g300)', background: 'var(--g50)' }}>
                  <div className="stat-val yellow">{stats.coupon}</div>
                  <div className="stat-label">累計クーポン付与</div>
                </div>
              </div>

              <div className="filter-bar">
                {[
                  ['all', '予約一覧', stats.total],
                  ['pending', '未確認', stats.pending],
                  ['confirmed', '確定', stats.confirmed],
                  ['waitlisted', '⏳ 待ち', stats.waitlisted],
                  ['cancelled', 'キャンセル', null],
                  ['coupon', 'クーポンあり', null],
                ].map(([v, l, count]) => (
                  <button key={v} className={`filter-btn${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>
                    {l}{count != null ? ` (${count})` : ''}
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
                        <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`}>{STATUS_LABEL[r.status] || r.status}</span>
                        {r.status === 'waitlisted' && (() => {
                          const pos = reservations
                            .filter(x => x.date === r.date && x.timeSlot === r.timeSlot && x.status === 'waitlisted')
                            .sort((a, b) => {
                              const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime()
                              const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime()
                              return ta - tb
                            })
                            .findIndex(x => x.id === r.id)
                          return pos >= 0 ? <span className="badge badge-purple">{pos + 1}番待ち</span> : null
                        })()}
                        {r.promotedFromWaitlist && <span className="badge badge-blue">⬆️ 繰り上げ</span>}
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
                      {r.status === 'waitlisted' && (
                        <button className="btn btn-sm btn-success" onClick={() => {
                          if (confirm(`${r.parentName} さんをキャンセル待ちから繰り上げますか？`))
                            updateStatus(r.id, 'pending')
                        }}>
                          繰り上げ
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
                                <td className="slot-time">
                                  {slot}
                                  {assigned.length > 0 && (() => {
                                    const cap = getSlotCapacity(date, slot)
                                    return (
                                      <span style={{ fontSize: '.75rem', color: cap.isFull ? '#DC2626' : 'var(--green700)', marginLeft: '4px', fontWeight: 600 }}>
                                        {cap.current}/{cap.maxCapacity}
                                        {cap.waitlistCount > 0 && <span style={{ color: '#7C3AED' }}> +待{cap.waitlistCount}</span>}
                                      </span>
                                    )
                                  })()}
                                </td>
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

          {/* ===== 写真送付 ===== */}
          {tab === 'photos' && (() => {
            const handleCreateAlbum = async () => {
              if (!photoForm.childName || !photoForm.date) return
              await createPhotoAlbum(photoForm)
              setPhotoForm({ childName: '', parentName: '', phone: '', date: today, expiryDays: 3 })
              setPhotoFormRes('')
            }

            const handleUpload = async (albumId, files) => {
              setUploadingId(albumId)
              for (const file of Array.from(files)) {
                const filename = `${Date.now()}_${file.name}`
                const ref = sRef(storage, `photos/${albumId}/${filename}`)
                await uploadBytes(ref, file)
                const url = await getDownloadURL(ref)
                await addPhotoUrl(albumId, url)
              }
              setUploadingId(null)
            }

            const shareText = (album) => {
              const url = `${window.location.origin}/photos/${album.id}`
              return `🌳 けやき保育園より\nお子様の写真をご覧いただけます📸\n\n【閲覧URL】\n${url}\n\n【PINコード】\n${album.pin}\n\n有効期限：${new Date(album.expiresAt).toLocaleDateString('ja-JP')}まで`
            }

            return (
              <>
                {/* アルバム作成 */}
                <div className="nurse-mgmt-card">
                  <div className="nurse-mgmt-title">📸 新しいアルバムを作成</div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '.8125rem', color: 'var(--g500)', display: 'block', marginBottom: '4px' }}>予約から自動入力</label>
                    <select className="form-select" value={photoFormRes} onChange={e => {
                      setPhotoFormRes(e.target.value)
                      const r = reservations.find(r => r.id === e.target.value)
                      if (r) setPhotoForm(p => ({ ...p, childName: r.childName, parentName: r.parentName, phone: r.phone, date: r.date }))
                    }}>
                      <option value="">予約を選択（任意）</option>
                      {reservations.filter(r => r.status !== 'cancelled').slice(0, 30).map(r => (
                        <option key={r.id} value={r.id}>{formatDate(r.date)} {r.childName}（{r.parentName}）</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-grid-2" style={{ gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '.8125rem', color: 'var(--g500)' }}>お子様のお名前*</label>
                      <input className="form-input" placeholder="山田太郎" value={photoForm.childName}
                        onChange={e => setPhotoForm(p => ({ ...p, childName: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '.8125rem', color: 'var(--g500)' }}>保護者名</label>
                      <input className="form-input" placeholder="山田花子" value={photoForm.parentName}
                        onChange={e => setPhotoForm(p => ({ ...p, parentName: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '.8125rem', color: 'var(--g500)' }}>来園日*</label>
                      <input className="form-input" type="date" value={photoForm.date}
                        onChange={e => setPhotoForm(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '.8125rem', color: 'var(--g500)' }}>保存日数</label>
                      <select className="form-select" value={photoForm.expiryDays}
                        onChange={e => setPhotoForm(p => ({ ...p, expiryDays: e.target.value }))}>
                        {[1,2,3,5,7].map(d => <option key={d} value={d}>{d}日間</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={handleCreateAlbum}
                    disabled={!photoForm.childName || !photoForm.date}>
                    アルバムを作成
                  </button>
                </div>

                {/* アルバム一覧 */}
                {photoAlbums.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📷</div>
                    <div className="empty-text">アルバムはまだありません</div>
                  </div>
                ) : photoAlbums.map(album => {
                  const expired = new Date(album.expiresAt) < new Date()
                  return (
                    <div key={album.id} className="nurse-mgmt-card" style={{ opacity: expired ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--g800)', fontSize: '1rem' }}>
                            {album.childName}さん
                            {expired && <span className="badge badge-gray" style={{ marginLeft: '8px' }}>期限切れ</span>}
                          </div>
                          <div style={{ fontSize: '.8125rem', color: 'var(--g500)', marginTop: '2px' }}>
                            {formatDateFull(album.date)}　保護者：{album.parentName || '—'}
                          </div>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '.8125rem' }}>
                            <span>🔑 PIN：<strong style={{ fontSize: '1rem', letterSpacing: '0.15em' }}>{album.pin}</strong></span>
                            <span>📅 期限：{new Date(album.expiresAt).toLocaleDateString('ja-JP')}</span>
                            <span>🖼️ {album.photoUrls?.length || 0}枚</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {!expired && (
                            <>
                              <button className="btn btn-sm btn-secondary" onClick={() => {
                                const text = shareText(album)
                                navigator.clipboard.writeText(text).then(() => alert('コピーしました'))
                              }}>URLをコピー</button>
                              <button className="btn btn-sm btn-secondary" style={{ background: '#06C755', color: 'white', border: 'none' }} onClick={() => {
                                window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareText(album))}`, '_blank')
                              }}>LINEで送る</button>
                            </>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => {
                            if (confirm(`${album.childName}さんのアルバムを削除しますか？`)) deletePhotoAlbum(album.id)
                          }}>削除</button>
                        </div>
                      </div>

                      {/* 写真アップロード */}
                      {!expired && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--g100)', paddingTop: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: 'none' }}
                              ref={el => { fileInputRef.current[album.id] = el }}
                              onChange={e => handleUpload(album.id, e.target.files)}
                            />
                            <button className="btn btn-sm btn-primary"
                              disabled={uploadingId === album.id}
                              onClick={() => fileInputRef.current[album.id]?.click()}>
                              {uploadingId === album.id ? 'アップロード中…' : '＋ 写真を追加'}
                            </button>
                          </div>
                          {album.photoUrls?.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px', marginTop: '10px' }}>
                              {album.photoUrls.map((url, i) => (
                                <div key={i} style={{ position: 'relative', paddingBottom: '100%', borderRadius: '6px', overflow: 'hidden', background: 'var(--g100)' }}>
                                  <img src={url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <button style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => removePhotoUrl(album.id, url)}>×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )
          })()}

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
                      <div style={{ minWidth: '150px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {!info.used && (
                          <>
                            <button className="btn btn-sm btn-secondary" onClick={() => markCouponUsed(phone)}>
                              使用済みに
                            </button>
                            <button className="btn btn-sm btn-secondary" style={{ background: '#06C755', color: 'white', border: 'none' }} onClick={() => {
                              const name = (() => { const r = reservations.find(r => r.phone === phone); return r ? r.parentName : '' })()
                              const msg = `🌳 けやき保育園より\n${name ? name + ' 様\n' : ''}5回目のご利用ありがとうございます！\n割引クーポンをプレゼントします🎁\n\n【クーポンコード】\n${info.code}\n\n次回ご予約フォームのクーポン欄へ入力してください。`
                              window.open(`https://line.me/R/msg/text/?${encodeURIComponent(msg)}`, '_blank')
                            }}>LINEで送る</button>
                          </>
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
