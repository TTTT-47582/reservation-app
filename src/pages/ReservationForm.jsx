import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import { sendConfirmationEmail } from '../lib/email'

const PURPOSES = ['就労', '求職・就活', '通院・医療', '冠婚葬祭', 'リフレッシュ', '学校行事', 'その他']

function Field({ label, required, error, hint, children }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span className="req">*</span>}
      </label>
      {children}
      {error && <p className="form-error">{error}</p>}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  )
}

const EMPTY_FORM = {
  parentName: '', parentKana: '', lineName: '', phone: '', email: '',
  childName: '', childKana: '', childBirthdate: '', relationship: '',
  date: '', startTime: '', endTime: '', purpose: '', notes: '',
}

export default function ReservationForm() {
  const navigate = useNavigate()
  const {
    termsAgreed, addReservation, addToWaitlist,
    getAvailableDates, getAvailableStartTimes, getConsecutiveEndTimes, getSlotCapacity,
    visitCounts, coupons, shifts, userProfile,
  } = useApp()

  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem('reservationForm')
      const parsed = saved ? JSON.parse(saved) : {}
      // 旧形式 (timeSlot) を startTime/endTime に変換
      if (parsed.timeSlot && !parsed.startTime) {
        const [s, e] = parsed.timeSlot.split('〜')
        return { ...EMPTY_FORM, ...parsed, startTime: s || '', endTime: e || '' }
      }
      return { ...EMPTY_FORM, ...parsed }
    } catch {
      return EMPTY_FORM
    }
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [joinWaitlist, setJoinWaitlist] = useState(false)
  const [profileApplied, setProfileApplied] = useState(false)

  useEffect(() => {
    if (!termsAgreed) navigate('/terms')
  }, [termsAgreed, navigate])

  // ログイン済みかつプロフィールがある場合、未入力フィールドを自動入力
  useEffect(() => {
    if (!userProfile || profileApplied) return
    setForm(prev => ({
      ...prev,
      parentName: prev.parentName || userProfile.parentName || '',
      parentKana: prev.parentKana || userProfile.parentKana || '',
      phone: prev.phone || userProfile.phone || '',
      lineName: prev.lineName || userProfile.lineName || '',
      childName: prev.childName || userProfile.childName || '',
      childKana: prev.childKana || userProfile.childKana || '',
      childBirthdate: prev.childBirthdate || userProfile.childBirthdate || '',
      relationship: prev.relationship || userProfile.relationship || '',
      email: prev.email || userProfile.email || '',
    }))
    setProfileApplied(true)
  }, [userProfile, profileApplied])

  const availableDates = getAvailableDates()
  const shiftsConfigured = Object.keys(shifts).length > 0
  const hasShifts = availableDates.length > 0

  const startTimes = hasShifts && form.date ? getAvailableStartTimes(form.date) : []
  const endTimes = hasShifts && form.date && form.startTime
    ? getConsecutiveEndTimes(form.date, form.startTime)
    : []

  // 選択中の範囲で最も制限の厳しい（残席最小の）スロット容量を計算
  const slotCapacity = (() => {
    if (!hasShifts || !form.date || !form.startTime || !form.endTime) return null
    const startH = parseInt(form.startTime)
    const endH = parseInt(form.endTime)
    let minAvailable = Infinity
    let maxWaitlist = 0
    let anyFull = false
    let minMax = Infinity
    for (let h = startH; h < endH; h++) {
      const slot = `${String(h).padStart(2, '0')}:00〜${String(h + 1).padStart(2, '0')}:00`
      const cap = getSlotCapacity(form.date, slot)
      if (cap.available < minAvailable) minAvailable = cap.available
      if (cap.maxCapacity < minMax) minMax = cap.maxCapacity
      if (cap.waitlistCount > maxWaitlist) maxWaitlist = cap.waitlistCount
      if (cap.isFull) anyFull = true
    }
    return {
      available: minAvailable === Infinity ? 0 : minAvailable,
      maxCapacity: minMax === Infinity ? 0 : minMax,
      waitlistCount: maxWaitlist,
      isFull: anyFull,
    }
  })()

  const set = (key) => (e) => {
    const val = e.target.value
    setErrors(prev => ({ ...prev, [key]: '', timeSlot: '' }))
    if (key === 'date' || key === 'startTime' || key === 'endTime') setJoinWaitlist(false)
    setForm(prev => {
      let next
      if (key === 'date') {
        next = { ...prev, date: val, startTime: '', endTime: '' }
      } else if (key === 'startTime') {
        next = { ...prev, startTime: val, endTime: '' }
      } else {
        next = { ...prev, [key]: val }
      }
      sessionStorage.setItem('reservationForm', JSON.stringify(next))
      return next
    })
  }

  const validate = () => {
    const e = {}
    if (!form.parentName.trim()) e.parentName = '保護者氏名を入力してください'
    if (!form.parentKana.trim()) e.parentKana = 'フリガナを入力してください'
    if (!form.lineName.trim()) e.lineName = 'LINEのお名前を入力してください'
    if (!form.phone.match(/^[0-9\-]{10,13}$/)) e.phone = '正しい電話番号を入力してください（例：090-1234-5678）'
    if (form.email && !form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = '正しいメールアドレスを入力してください'
    if (!form.childName.trim()) e.childName = 'お子様のお名前を入力してください'
    if (!form.childKana.trim()) e.childKana = 'フリガナを入力してください'
    if (!form.childBirthdate) e.childBirthdate = '生年月日を入力してください'
    if (!form.relationship) e.relationship = '続柄を選択してください'
    if (!form.date) e.date = '希望利用日を選択してください'
    if (!form.startTime || !form.endTime) e.timeSlot = '開始時刻と終了時刻を選択してください'
    if (!form.purpose) e.purpose = '利用目的を選択してください'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length > 0) { setErrors(e2); return }
    setSubmitting(true)
    const submittedData = { ...form, timeSlot: `${form.startTime}〜${form.endTime}` }
    try {
      const result = joinWaitlist
        ? await addToWaitlist(submittedData)
        : await addReservation(submittedData)
      if (result?.error === 'max_reservations') {
        setErrors({ submit: '同じ電話番号で予約できるのは3件までです。キャンセル後に再予約してください。' })
        setSubmitting(false)
        return
      }
      if (result?.error === 'duplicate' || result?.error === 'duplicate_waitlist') {
        setErrors({ submit: '同じ日時・時間帯の予約が既にあります。別の日時をお選びください。' })
        setSubmitting(false)
        return
      }
      if (result?.error === 'no_shift') {
        setErrors({ submit: '選択した時間帯の一部にシフトが設定されていません。別の時間帯をお選びください。' })
        setSubmitting(false)
        return
      }
      if (result?.error === 'full') {
        setErrors({ submit: 'この時間帯は満席です。キャンセル待ちを希望される場合は「キャンセル待ちに登録する」にチェックしてください。' })
        setSubmitting(false)
        return
      }
      if (!joinWaitlist) await sendConfirmationEmail(result).catch(() => {})
      sessionStorage.removeItem('reservationForm')
      navigate('/confirmation')
    } catch {
      setErrors({ submit: '予約の送信に失敗しました。もう一度お試しください。' })
      setSubmitting(false)
    }
  }

  const phone = form.phone
  const currentVisits = visitCounts[phone] || 0
  const hasCoupon = !!coupons[phone]
  const willGetCoupon = currentVisits + 1 === 5 && !hasCoupon

  const couponData = coupons[phone]
  const hasUnusedCoupon = couponData && !couponData.used
  const couponValid = hasUnusedCoupon && form.couponCode === couponData.code
  const couponInvalid = !!form.couponCode && !couponValid

  const formatDate = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${days[dt.getDay()]}）`
  }

  return (
    <div className="form-page">
      <div className="form-page-hero">
        <div className="form-page-hero-inner">
          <h1 className="form-page-title">一時保育 予約フォーム</h1>
          <p className="form-page-subtitle">必須項目（*）をすべて入力のうえ、送信ボタンを押してください</p>
        </div>
      </div>

      <div className="form-wrap">
        {userProfile && (
          <div style={{ background: 'var(--green50)', border: '1px solid var(--green200)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: '16px', fontSize: '.875rem', color: 'var(--green800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>登録情報を自動入力しました（{userProfile.parentName} 様）</span>
          </div>
        )}
        {willGetCoupon && (
          <div className="coupon-hint">
            🎉 今回のご予約で5回目の利用となります！送信後に割引クーポンをプレゼントします。
          </div>
        )}
        {hasCoupon && (
          <div className="coupon-hint">
            🎟️ 割引クーポンをお持ちです。ご来園の際にスタッフへお申し出ください。
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* 保護者情報 */}
          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">👤</span>
              <span className="form-section-title">保護者情報</span>
            </div>
            <div className="form-section-body">
              <div className="form-grid-2">
                <Field label="保護者氏名" required error={errors.parentName}>
                  <input className={`form-input${errors.parentName ? ' err' : ''}`}
                    placeholder="山田 花子" value={form.parentName} onChange={set('parentName')} />
                </Field>
                <Field label="フリガナ" required error={errors.parentKana}>
                  <input className={`form-input${errors.parentKana ? ' err' : ''}`}
                    placeholder="ヤマダ ハナコ" value={form.parentKana} onChange={set('parentKana')} />
                </Field>
              </div>
              <Field label="LINEのお名前" required error={errors.lineName}
                hint="予約者の特定に使用します。LINE表示名をそのまま入力してください">
                <input className={`form-input${errors.lineName ? ' err' : ''}`}
                  placeholder="はなこ" value={form.lineName} onChange={set('lineName')} />
              </Field>
              <div className="form-grid-2">
                <Field label="電話番号" required error={errors.phone} hint="ハイフンあり・なし両方可">
                  <input className={`form-input${errors.phone ? ' err' : ''}`}
                    type="tel" placeholder="090-1234-5678" value={form.phone} onChange={set('phone')} />
                </Field>
                <Field label="メールアドレス" error={errors.email} hint="任意">
                  <input className={`form-input${errors.email ? ' err' : ''}`}
                    type="email" placeholder="example@email.com" value={form.email} onChange={set('email')} />
                </Field>
              </div>
            </div>
          </div>

          {/* お子様情報 */}
          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">👶</span>
              <span className="form-section-title">お子様の情報</span>
            </div>
            <div className="form-section-body">
              <div className="form-grid-2">
                <Field label="お子様の氏名" required error={errors.childName}>
                  <input className={`form-input${errors.childName ? ' err' : ''}`}
                    placeholder="山田 太郎" value={form.childName} onChange={set('childName')} />
                </Field>
                <Field label="フリガナ" required error={errors.childKana}>
                  <input className={`form-input${errors.childKana ? ' err' : ''}`}
                    placeholder="ヤマダ タロウ" value={form.childKana} onChange={set('childKana')} />
                </Field>
              </div>
              <div className="form-grid-2">
                <Field label="生年月日" required error={errors.childBirthdate}>
                  <input className={`form-input${errors.childBirthdate ? ' err' : ''}`}
                    type="date" value={form.childBirthdate} onChange={set('childBirthdate')} />
                </Field>
                <Field label="続柄" required error={errors.relationship}>
                  <select className={`form-select${errors.relationship ? ' err' : ''}`}
                    value={form.relationship} onChange={set('relationship')}>
                    <option value="">選択してください</option>
                    <option>父</option><option>母</option>
                    <option>祖父</option><option>祖母</option><option>その他</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>

          {/* クーポン */}
          {phone.length >= 10 && (
            <div className="form-section">
              <div className="form-section-hd">
                <span className="form-section-icon">🎟️</span>
                <span className="form-section-title">割引クーポン</span>
              </div>
              <div className="form-section-body">
                {hasUnusedCoupon ? (
                  <Field label="クーポンコード" error={couponInvalid ? 'クーポンコードが正しくありません' : ''} hint="お持ちのクーポンコードを入力してください">
                    <input
                      className={`form-input${couponInvalid ? ' err' : ''}`}
                      placeholder="SAKURA-XXXX-XXXX"
                      value={form.couponCode || ''}
                      onChange={set('couponCode')}
                    />
                    {couponValid && (
                      <p style={{ color: '#16a34a', fontSize: '.875rem', marginTop: '6px', fontWeight: 600 }}>
                        ✓ クーポンが適用されます。ご来園時に割引いたします。
                      </p>
                    )}
                  </Field>
                ) : (
                  <p style={{ fontSize: '.875rem', color: 'var(--g500)' }}>
                    {couponData?.used
                      ? '🎟️ このクーポンはすでに使用済みです。'
                      : '利用回数5回達成でクーポンが発行されます。'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 予約情報 */}
          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">📅</span>
              <span className="form-section-title">予約情報</span>
            </div>
            <div className="form-section-body">
              {/* 希望利用日 */}
              <Field label="希望利用日" required error={errors.date}>
                {hasShifts ? (
                  <select className={`form-select${errors.date ? ' err' : ''}`}
                    value={form.date} onChange={set('date')}>
                    <option value="">日付を選択</option>
                    {availableDates.map(d => (
                      <option key={d} value={d}>{formatDate(d)}</option>
                    ))}
                  </select>
                ) : shiftsConfigured ? (
                  <div style={{ padding: '10px 14px', background: 'var(--amber50)', border: '1px solid var(--amber400)', borderRadius: 'var(--r-md)', fontSize: '.875rem', color: '#92400E' }}>
                    ⚠️ 現在予約可能な日程がありません。しばらくお待ちいただくか、園へお問い合わせください。
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px', background: 'var(--amber50)', border: '1px solid var(--amber400)', borderRadius: 'var(--r-md)', fontSize: '.875rem', color: '#92400E' }}>
                    ⚠️ 現在シフトが設定されていません。しばらくお待ちください。
                  </div>
                )}
              </Field>

              {/* 時間帯：開始 + 終了 */}
              <Field label="希望時間帯" required error={errors.timeSlot}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    className={`form-select${errors.timeSlot ? ' err' : ''}`}
                    value={form.startTime}
                    onChange={set('startTime')}
                    disabled={!form.date || !hasShifts}
                    style={{ flex: 1 }}
                  >
                    <option value="">開始時刻</option>
                    {startTimes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span style={{ color: 'var(--g500)', fontWeight: 600, whiteSpace: 'nowrap' }}>〜</span>
                  <select
                    className={`form-select${errors.timeSlot ? ' err' : ''}`}
                    value={form.endTime}
                    onChange={set('endTime')}
                    disabled={!form.startTime}
                    style={{ flex: 1 }}
                  >
                    <option value="">終了時刻</option>
                    {endTimes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                {form.startTime && form.endTime && (
                  <p style={{ fontSize: '.8125rem', color: 'var(--g500)', marginTop: '4px' }}>
                    預け時間：{parseInt(form.endTime) - parseInt(form.startTime)}時間
                  </p>
                )}
                {slotCapacity && !slotCapacity.isFull && (
                  <p style={{ fontSize: '.8125rem', color: 'var(--green700)', marginTop: '4px', fontWeight: 600 }}>
                    ✓ 空きあり（残り{slotCapacity.available}席）
                  </p>
                )}
                {slotCapacity?.isFull && (
                  <div style={{ marginTop: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                    <p style={{ fontWeight: 700, color: '#DC2626', marginBottom: '6px' }}>
                      ⛔ この時間帯は満席です
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.9rem', color: '#7C2D12' }}>
                      <input
                        type="checkbox"
                        checked={joinWaitlist}
                        onChange={e => setJoinWaitlist(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#DC2626' }}
                      />
                      キャンセル待ちに登録する
                      {slotCapacity.waitlistCount > 0 && (
                        <span style={{ fontSize: '.8125rem', color: '#9A3412' }}>
                          （現在{slotCapacity.waitlistCount}番待ち）
                        </span>
                      )}
                    </label>
                    {joinWaitlist && (
                      <p style={{ marginTop: '8px', fontSize: '.8125rem', color: '#9A3412' }}>
                        ⚡ キャンセルが出た場合、登録順にご連絡いたします。
                      </p>
                    )}
                  </div>
                )}
              </Field>

              <Field label="利用目的" required error={errors.purpose}>
                <select className={`form-select${errors.purpose ? ' err' : ''}`}
                  value={form.purpose} onChange={set('purpose')}>
                  <option value="">選択してください</option>
                  {PURPOSES.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="アレルギー・特記事項" hint="アレルギーや特別なご配慮が必要な場合はご記入ください">
                <textarea className="form-textarea" rows={3}
                  placeholder="例：卵アレルギーあり（卵・卵加工品を除去）"
                  value={form.notes} onChange={set('notes')} />
              </Field>
            </div>
          </div>

          {errors.submit && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px', color: '#DC2626', fontSize: '.9rem' }}>
              {errors.submit}
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !hasShifts}
              style={joinWaitlist ? { background: '#9A3412', borderColor: '#9A3412' } : {}}>
              {submitting
                ? '送信中…'
                : joinWaitlist
                  ? 'キャンセル待ちに登録する →'
                  : '予約を送信する →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
