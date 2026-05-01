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

export default function ReservationForm() {
  const navigate = useNavigate()
  const { termsAgreed, addReservation, getAvailableDates, getAvailableSlots, visitCounts, coupons } = useApp()

  const [form, setForm] = useState({
    parentName: '', parentKana: '', lineName: '', phone: '', email: '',
    childName: '', childKana: '', childBirthdate: '', relationship: '',
    date: '', timeSlot: '', purpose: '', notes: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!termsAgreed) navigate('/terms')
  }, [termsAgreed, navigate])

  const availableDates = getAvailableDates()
  const availableSlots = form.date ? getAvailableSlots(form.date) : []

  const set = (key) => (e) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    setErrors(prev => ({ ...prev, [key]: '' }))
    if (key === 'date') setForm(prev => ({ ...prev, date: e.target.value, timeSlot: '' }))
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
    if (!form.timeSlot) e.timeSlot = '希望時間帯を選択してください'
    if (!form.purpose) e.purpose = '利用目的を選択してください'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length > 0) { setErrors(e2); return }
    setSubmitting(true)
    const result = await addReservation(form)
    await sendConfirmationEmail(result).catch(() => {})
    navigate('/confirmation')
  }

  const phone = form.phone
  const currentVisits = visitCounts[phone] || 0
  const hasCoupon = !!coupons[phone]
  const willGetCoupon = currentVisits + 1 === 5 && !hasCoupon

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
                  placeholder="はなこ🌸" value={form.lineName} onChange={set('lineName')} />
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

          {/* 予約情報 */}
          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">📅</span>
              <span className="form-section-title">予約情報</span>
            </div>
            <div className="form-section-body">
              <div className="form-grid-2">
                <Field label="希望利用日" required error={errors.date}
                  hint={availableDates.length === 0 ? '現在予約可能な日はありません' : undefined}>
                  <select className={`form-select${errors.date ? ' err' : ''}`}
                    value={form.date} onChange={set('date')}>
                    <option value="">日付を選択</option>
                    {availableDates.map(d => (
                      <option key={d} value={d}>{formatDate(d)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="希望時間帯" required error={errors.timeSlot}>
                  <select className={`form-select${errors.timeSlot ? ' err' : ''}`}
                    value={form.timeSlot} onChange={set('timeSlot')} disabled={!form.date}>
                    <option value="">時間帯を選択</option>
                    {availableSlots.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
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

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '送信中…' : '予約を送信する →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
