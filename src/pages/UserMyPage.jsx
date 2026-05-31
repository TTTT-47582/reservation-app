import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${DAYS[dt.getDay()]}）`
}

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

export default function UserMyPage() {
  const navigate = useNavigate()
  const { authUser, userProfile, logoutUser, updateUserProfile, changeUserPassword, reservations } = useApp()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  if (!authUser || !userProfile) {
    return (
      <div className="page">
        <Header />
        <div className="form-wrap" style={{ maxWidth: '440px', textAlign: 'center', paddingTop: '48px' }}>
          <p style={{ color: 'var(--g500)', marginBottom: '24px' }}>ログインが必要です</p>
          <button className="btn btn-primary" onClick={() => navigate('/user-login')}>
            ログインへ
          </button>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const myReservations = reservations.filter(r =>
    r.phone === userProfile.phone && r.date >= today && r.status !== 'cancelled'
  ).sort((a, b) => a.date.localeCompare(b.date))

  const handleEdit = () => {
    setEditForm({ ...userProfile })
    setEditErrors({})
    setSaved(false)
    setEditing(true)
  }

  const setField = (field) => (e) => setEditForm(p => ({ ...p, [field]: e.target.value }))

  const validateEdit = () => {
    const errs = {}
    if (!editForm.parentName?.trim()) errs.parentName = '必須項目です'
    if (!editForm.parentKana?.trim()) errs.parentKana = '必須項目です'
    if (!/^[゠-ヿ\s]+$/.test(editForm.parentKana)) errs.parentKana = 'カタカナで入力してください'
    if (!editForm.phone?.trim()) errs.phone = '必須項目です'
    if (!editForm.childName?.trim()) errs.childName = '必須項目です'
    if (!editForm.childKana?.trim()) errs.childKana = '必須項目です'
    if (!editForm.childBirthdate) errs.childBirthdate = '必須項目です'
    if (!editForm.relationship?.trim()) errs.relationship = '必須項目です'
    return errs
  }

  const handleSave = async () => {
    const errs = validateEdit()
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return }
    setSaving(true)
    try {
      const { email, createdAt, ...updateFields } = editForm
      await updateUserProfile(updateFields)
      setSaved(true)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePw = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.next.length < 6) { setPwError('新しいパスワードは6文字以上で入力してください'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('新しいパスワードが一致しません'); return }
    try {
      await changeUserPassword(pwForm.current, pwForm.next)
      setPwSaved(true)
      setChangingPw(false)
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwError('現在のパスワードが正しくありません')
      } else {
        setPwError('変更に失敗しました。もう一度お試しください')
      }
    }
  }

  const handleLogout = async () => {
    await logoutUser()
    navigate('/')
  }

  const profile = editing ? editForm : userProfile

  return (
    <div className="page">
      <Header />
      <div className="form-wrap" style={{ maxWidth: '560px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--g800)', marginBottom: '8px' }}>
            マイページ
          </h1>
          <p style={{ color: 'var(--g500)', fontSize: '.9375rem' }}>{authUser.email}</p>
        </div>

        {saved && (
          <div style={{ background: 'var(--green50)', border: '1px solid var(--green200)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: '16px', color: 'var(--green800)', fontSize: '.875rem' }}>
            プロフィールを更新しました
          </div>
        )}
        {pwSaved && (
          <div style={{ background: 'var(--green50)', border: '1px solid var(--green200)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: '16px', color: 'var(--green800)', fontSize: '.875rem' }}>
            パスワードを変更しました
          </div>
        )}

        {/* プロフィール */}
        <div className="form-section">
          <div className="form-section-hd">
            <span className="form-section-icon">👤</span>
            <span className="form-section-title">登録情報</span>
            {!editing && (
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleEdit}>
                編集
              </button>
            )}
          </div>
          <div className="form-section-body">
            {editing ? (
              <>
                <Field label="保護者氏名" required error={editErrors.parentName}>
                  <input className="form-input" value={profile.parentName || ''} onChange={setField('parentName')} />
                </Field>
                <Field label="保護者氏名（カタカナ）" required error={editErrors.parentKana}>
                  <input className="form-input" value={profile.parentKana || ''} onChange={setField('parentKana')} />
                </Field>
                <Field label="電話番号" required error={editErrors.phone}>
                  <input className="form-input" type="tel" value={profile.phone || ''} onChange={setField('phone')} />
                </Field>
                <Field label="LINE名">
                  <input className="form-input" value={profile.lineName || ''} onChange={setField('lineName')} placeholder="任意" />
                </Field>
                <Field label="お子様氏名" required error={editErrors.childName}>
                  <input className="form-input" value={profile.childName || ''} onChange={setField('childName')} />
                </Field>
                <Field label="お子様氏名（カタカナ）" required error={editErrors.childKana}>
                  <input className="form-input" value={profile.childKana || ''} onChange={setField('childKana')} />
                </Field>
                <Field label="生年月日" required error={editErrors.childBirthdate}>
                  <input className="form-input" type="date" value={profile.childBirthdate || ''} onChange={setField('childBirthdate')} />
                </Field>
                <Field label="続柄" required error={editErrors.relationship}>
                  <input className="form-input" value={profile.relationship || ''} onChange={setField('relationship')} placeholder="母・父など" />
                </Field>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? '保存中…' : '保存する'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gap: '8px', fontSize: '.9375rem' }}>
                <ProfileRow label="保護者氏名" value={`${userProfile.parentName}（${userProfile.parentKana}）`} />
                <ProfileRow label="電話番号" value={userProfile.phone} />
                {userProfile.lineName && <ProfileRow label="LINE名" value={userProfile.lineName} />}
                <ProfileRow label="お子様氏名" value={`${userProfile.childName}（${userProfile.childKana}）`} />
                <ProfileRow label="生年月日" value={userProfile.childBirthdate} />
                <ProfileRow label="続柄" value={userProfile.relationship} />
              </div>
            )}
          </div>
        </div>

        {/* 予約一覧 */}
        <div className="form-section">
          <div className="form-section-hd">
            <span className="form-section-icon">📅</span>
            <span className="form-section-title">今後の予約</span>
          </div>
          <div className="form-section-body">
            {myReservations.length === 0 ? (
              <p style={{ color: 'var(--g400)', fontSize: '.875rem' }}>予約はありません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myReservations.map(r => (
                  <div key={r.id} style={{ background: 'var(--g50)', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: '.875rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{formatDate(r.date)}</div>
                    <div style={{ color: 'var(--g600)' }}>{r.timeSlot} / {r.childName}</div>
                    <div style={{ marginTop: '4px' }}>
                      {r.status === 'confirmed' && <span className="badge badge-green">確定済み</span>}
                      {r.status === 'pending' && <span className="badge badge-amber">確認中</span>}
                      {r.status === 'waitlisted' && <span className="badge badge-purple">キャンセル待ち</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/cancel')}>
                予約のキャンセル・変更
              </button>
            </div>
          </div>
        </div>

        {/* パスワード変更 */}
        <div className="form-section">
          <div className="form-section-hd">
            <span className="form-section-icon">🔐</span>
            <span className="form-section-title">パスワード変更</span>
          </div>
          <div className="form-section-body">
            {changingPw ? (
              <form onSubmit={handleChangePw}>
                <div className="form-group">
                  <label className="form-label">現在のパスワード<span className="req">*</span></label>
                  <input className="form-input" type="password" value={pwForm.current}
                    onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" required />
                </div>
                <div className="form-group">
                  <label className="form-label">新しいパスワード<span className="req">*</span></label>
                  <input className="form-input" type="password" value={pwForm.next}
                    onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} placeholder="6文字以上" required />
                </div>
                <div className="form-group">
                  <label className="form-label">新しいパスワード（確認）<span className="req">*</span></label>
                  <input className="form-input" type="password" value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" required />
                </div>
                {pwError && <p className="form-error" style={{ marginBottom: '12px' }}>{pwError}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" type="submit">変更する</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setChangingPw(false)}>キャンセル</button>
                </div>
              </form>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => setChangingPw(true)}>
                パスワードを変更する
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={() => navigate('/terms')}>
            予約する
          </button>
          <button className="btn btn-secondary" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ color: 'var(--g500)', minWidth: '130px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--g800)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
