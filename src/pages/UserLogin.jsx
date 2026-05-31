import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'

export default function UserLogin() {
  const navigate = useNavigate()
  const { loginUser } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginUser(email, password)
      navigate('/mypage')
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else {
        setError('ログインに失敗しました。もう一度お試しください')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <Header />
      <div className="form-wrap" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--g800)', marginBottom: '8px' }}>
            ログイン
          </h1>
          <p style={{ color: 'var(--g500)', fontSize: '.9375rem' }}>
            登録済みの方はこちらからログインしてください
          </p>
        </div>

        <div className="form-section">
          <div className="form-section-body">
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">メールアドレス</label>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">パスワード</label>
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <p className="form-error" style={{ marginBottom: '16px' }}>{error}</p>}
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%' }}>
                {loading ? 'ログイン中…' : 'ログイン'}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '.875rem', color: 'var(--g500)' }}>
              まだ登録していない方は{' '}
              <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                新規登録
              </Link>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            トップページへ戻る
          </button>
        </div>
      </div>
    </div>
  )
}
