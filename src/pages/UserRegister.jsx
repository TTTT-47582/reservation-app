import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'

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

const EMPTY = {
  parentName: '', parentKana: '', phone: '', lineName: '',
  childName: '', childKana: '', childBirthdate: '', relationship: '',
  email: '', password: '', passwordConfirm: '',
}

export default function UserRegister() {
  const navigate = useNavigate()
  const { registerUser } = useApp()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.parentName.trim()) errs.parentName = '必須項目です'
    if (!form.parentKana.trim()) errs.parentKana = '必須項目です'
    if (!/^[゠-ヿ\s]+$/.test(form.parentKana)) errs.parentKana = 'カタカナで入力してください'
    if (!form.phone.trim()) errs.phone = '必須項目です'
    if (!/^[0-9\-]{10,15}$/.test(form.phone.replace(/-/g, ''))) errs.phone = '正しい電話番号を入力してください'
    if (!form.childName.trim()) errs.childName = '必須項目です'
    if (!form.childKana.trim()) errs.childKana = '必須項目です'
    if (!/^[゠-ヿ\s]+$/.test(form.childKana)) errs.childKana = 'カタカナで入力してください'
    if (!form.childBirthdate) errs.childBirthdate = '必須項目です'
    if (!form.relationship.trim()) errs.relationship = '必須項目です'
    if (!form.email.trim()) errs.email = '必須項目です'
    if (form.password.length < 6) errs.password = '6文字以上で入力してください'
    if (form.password !== form.passwordConfirm) errs.passwordConfirm = 'パスワードが一致しません'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    try {
      const { email, password, passwordConfirm, ...profile } = form
      await registerUser(email, password, profile)
      navigate('/mypage')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setErrors({ email: 'このメールアドレスはすでに登録されています' })
      } else if (err.code === 'auth/weak-password') {
        setErrors({ password: 'パスワードが短すぎます（6文字以上）' })
      } else {
        setErrors({ _general: '登録に失敗しました。もう一度お試しください' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <Header />
      <div className="form-wrap" style={{ maxWidth: '560px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--g800)', marginBottom: '8px' }}>
            新規登録
          </h1>
          <p style={{ color: 'var(--g500)', fontSize: '.9375rem' }}>
            一度登録すると、次回から情報を自動入力できます
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">👤</span>
              <span className="form-section-title">保護者情報</span>
            </div>
            <div className="form-section-body">
              <Field label="保護者氏名" required error={errors.parentName}>
                <input className="form-input" value={form.parentName} onChange={set('parentName')}
                  placeholder="山田 太郎" />
              </Field>
              <Field label="保護者氏名（カタカナ）" required error={errors.parentKana}>
                <input className="form-input" value={form.parentKana} onChange={set('parentKana')}
                  placeholder="ヤマダ タロウ" />
              </Field>
              <Field label="電話番号" required error={errors.phone}
                hint="ハイフンあり・なしどちらでも可">
                <input className="form-input" type="tel" value={form.phone} onChange={set('phone')}
                  placeholder="090-1234-5678" />
              </Field>
              <Field label="LINE名" hint="任意">
                <input className="form-input" value={form.lineName} onChange={set('lineName')}
                  placeholder="LINE表示名（任意）" />
              </Field>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">👶</span>
              <span className="form-section-title">お子様情報</span>
            </div>
            <div className="form-section-body">
              <Field label="お子様氏名" required error={errors.childName}>
                <input className="form-input" value={form.childName} onChange={set('childName')}
                  placeholder="山田 花子" />
              </Field>
              <Field label="お子様氏名（カタカナ）" required error={errors.childKana}>
                <input className="form-input" value={form.childKana} onChange={set('childKana')}
                  placeholder="ヤマダ ハナコ" />
              </Field>
              <Field label="生年月日" required error={errors.childBirthdate}>
                <input className="form-input" type="date" value={form.childBirthdate}
                  onChange={set('childBirthdate')} />
              </Field>
              <Field label="続柄" required error={errors.relationship}>
                <input className="form-input" value={form.relationship} onChange={set('relationship')}
                  placeholder="母・父など" />
              </Field>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">🔐</span>
              <span className="form-section-title">ログイン情報</span>
            </div>
            <div className="form-section-body">
              <Field label="メールアドレス" required error={errors.email}>
                <input className="form-input" type="email" value={form.email} onChange={set('email')}
                  placeholder="example@email.com" />
              </Field>
              <Field label="パスワード" required error={errors.password}
                hint="6文字以上">
                <input className="form-input" type="password" value={form.password} onChange={set('password')}
                  placeholder="••••••••" />
              </Field>
              <Field label="パスワード（確認）" required error={errors.passwordConfirm}>
                <input className="form-input" type="password" value={form.passwordConfirm}
                  onChange={set('passwordConfirm')} placeholder="••••••••" />
              </Field>
            </div>
          </div>

          {errors._general && (
            <p className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>{errors._general}</p>
          )}

          <button className="btn btn-primary" type="submit" disabled={submitting}
            style={{ width: '100%', marginBottom: '12px' }}>
            {submitting ? '登録中…' : '登録する'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '.875rem', color: 'var(--g500)' }}>
          すでにアカウントをお持ちの方は{' '}
          <Link to="/user-login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            ログイン
          </Link>
        </div>
      </div>
    </div>
  )
}
