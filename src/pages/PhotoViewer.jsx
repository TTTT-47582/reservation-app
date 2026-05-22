import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import Header from '../components/Header'

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${DAYS[dt.getDay()]}）`
}

export default function PhotoViewer() {
  const { albumId } = useParams()
  const navigate = useNavigate()
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState('')
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'photoAlbums', albumId))
      .then(snap => {
        if (snap.exists()) setAlbum({ id: snap.id, ...snap.data() })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [albumId])

  const isExpired = album && new Date(album.expiresAt) < new Date()

  const handleVerify = (e) => {
    e.preventDefault()
    if (pin === album?.pin) {
      setVerified(true)
      setError('')
    } else {
      setError('PINコードが正しくありません')
      setPin('')
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g50)' }}>
      <p style={{ color: 'var(--g500)' }}>読み込み中…</p>
    </div>
  )

  if (!album) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g50)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '1.25rem', color: 'var(--g600)', marginBottom: '16px' }}>アルバムが見つかりませんでした</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>トップへ戻る</button>
      </div>
    </div>
  )

  return (
    <div className="page">
      <Header />
      <div className="form-wrap" style={{ maxWidth: '640px' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📸</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--g800)', marginBottom: '4px' }}>
            {album.childName}さんの写真
          </h1>
          <p style={{ color: 'var(--g500)', fontSize: '.9rem' }}>{formatDate(album.date)}</p>
        </div>

        {isExpired ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <p style={{ color: '#DC2626', fontWeight: 700, marginBottom: '8px' }}>このアルバムは有効期限が切れています</p>
            <p style={{ color: 'var(--g500)', fontSize: '.875rem' }}>保育園スタッフまでお問い合わせください</p>
          </div>
        ) : !verified ? (
          <div className="form-section">
            <div className="form-section-hd">
              <span className="form-section-icon">🔒</span>
              <span className="form-section-title">PINコードを入力してください</span>
            </div>
            <div className="form-section-body">
              <p style={{ fontSize: '.875rem', color: 'var(--g500)', marginBottom: '16px' }}>
                スタッフからお伝えした4桁のPINコードを入力してください
              </p>
              <form onSubmit={handleVerify}>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '12px' }}>
                  <input
                    className="form-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    value={pin}
                    onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
                    style={{ maxWidth: '120px', fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.3em' }}
                  />
                  <button className="btn btn-primary" type="submit">確認</button>
                </div>
                {error && (
                  <p style={{ color: '#DC2626', fontSize: '.875rem', textAlign: 'center' }}>{error}</p>
                )}
              </form>
              <p style={{ fontSize: '.8125rem', color: 'var(--g400)', textAlign: 'center', marginTop: '12px' }}>
                有効期限：{formatDate(album.expiresAt)}まで
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '.875rem', color: 'var(--g500)' }}>
                有効期限：{formatDate(album.expiresAt)}まで
              </p>
              <span style={{ fontSize: '.8125rem', color: 'var(--g400)' }}>{album.photoUrls?.length || 0}枚</span>
            </div>

            {!album.photoUrls?.length ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--g400)' }}>
                <p style={{ fontSize: '2rem' }}>📷</p>
                <p>写真はまだアップロードされていません</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                {album.photoUrls.map((url, i) => (
                  <div key={i} style={{ position: 'relative', paddingBottom: '100%', overflow: 'hidden', borderRadius: '8px', cursor: 'pointer', background: 'var(--g100)' }}
                    onClick={() => setSelected(url)}>
                    <img src={url} alt={`写真${i + 1}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>トップページへ戻る</button>
        </div>
      </div>

      {/* 拡大表示 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelected(null)}>
          <img src={selected} alt="拡大" style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          <button style={{ position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }}
            onClick={() => setSelected(null)}>×</button>
        </div>
      )}
    </div>
  )
}
