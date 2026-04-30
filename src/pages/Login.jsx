import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/admin')
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--g900)', padding: '24px'
    }}>
      <div style={{
        background: 'var(--white)', borderRadius: 'var(--r-xl)', padding: '44px',
        width: '100%', maxWidth: '400px', boxShadow: 'var(--sh-lg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🌸</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--g900)', marginBottom: '4px' }}>
            管理者ログイン
          </h1>
          <p style={{ fontSize: '.875rem', color: 'var(--g500)' }}>さくら保育園 管理システム</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">メールアドレス</label>
            <input className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">パスワード</label>
            <input className="form-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="form-error" style={{ marginBottom: '16px' }}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', marginTop: '4px' }}>
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a href="/" style={{ fontSize: '.875rem', color: 'var(--g400)' }}>← サイトに戻る</a>
        </div>
      </div>
    </div>
  )
}
