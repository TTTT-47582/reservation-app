import { useNavigate } from 'react-router-dom'

export default function Header() {
  const navigate = useNavigate()
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="header-logo-icon">🌸</span>
          さくら保育園
        </div>
        <nav className="header-nav">
          <a href="/">トップ</a>
          <a href="/terms">利用要綱</a>
          <button className="nav-btn-primary" onClick={() => navigate('/terms')}>
            予約する
          </button>
        </nav>
      </div>
    </header>
  )
}
