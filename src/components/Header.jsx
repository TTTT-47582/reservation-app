import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function Header() {
  const navigate = useNavigate()
  const { authUser, userProfile, logoutUser, authLoading } = useApp()

  const handleLogout = async () => {
    await logoutUser()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="header-logo-icon">🌳</span>
          けやき保育園
        </div>
        <nav className="header-nav">
          <a href="/">トップ</a>
          <a href="/terms">利用要綱</a>
          {!authLoading && (
            authUser && userProfile ? (
              <>
                <button className="nav-btn-secondary" onClick={() => navigate('/mypage')}>
                  {userProfile.parentName}さん
                </button>
                <button className="nav-btn-primary" onClick={() => navigate('/terms')}>
                  予約する
                </button>
              </>
            ) : (
              <>
                <button className="nav-btn-secondary" onClick={() => navigate('/user-login')}>
                  ログイン
                </button>
                <button className="nav-btn-primary" onClick={() => navigate('/terms')}>
                  予約する
                </button>
              </>
            )
          )}
          {authLoading && (
            <button className="nav-btn-primary" onClick={() => navigate('/terms')}>
              予約する
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
