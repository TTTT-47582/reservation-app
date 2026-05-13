import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import CalendarModal from '../components/CalendarModal'

export default function Home() {
  const navigate = useNavigate()
  const [showCalendar, setShowCalendar] = useState(false)
  return (
    <div className="page">
      <Header />
      <main style={{ flex: 1 }}>
        {/* Hero */}
        <section className="hero">
          <div className="hero-inner">
            <div>
              <div className="hero-badge">一時保育オンライン予約</div>
              <h1 className="hero-title">けやき保育園へようこそ</h1>
              <p className="hero-subtitle">
                お仕事・通院・リフレッシュなど、さまざまなシーンで<br />
                一時保育をご利用いただけます。<br />
                スマートフォン・PCから24時間受付中です。
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-lg" onClick={() => navigate('/terms')}
                  style={{ background: 'var(--white)', color: 'var(--p600)', fontWeight: 700 }}>
                  予約をはじめる →
                </button>
                <button className="btn btn-lg" onClick={() => setShowCalendar(true)}
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--white)', fontWeight: 700, border: '2px solid rgba(255,255,255,0.6)' }}>
                  📅 予約可能日を確認
                </button>
              </div>
              {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} />}
            </div>
            <div>
              <div className="hero-card">
                <div className="hero-card-title">ご利用案内</div>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-icon">⏰</span>
                    <div>
                      <div className="info-label">受付時間</div>
                      <div className="info-value">7:00〜19:00</div>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">📅</span>
                    <div>
                      <div className="info-label">予約受付</div>
                      <div className="info-value">3日前まで</div>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">👶</span>
                    <div>
                      <div className="info-label">対象年齢</div>
                      <div className="info-value">生後6ヶ月〜就学前</div>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">💴</span>
                    <div>
                      <div className="info-label">料金</div>
                      <div className="info-value">1時間 ¥500〜</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="steps-section">
          <h2 className="steps-title">ご予約の流れ</h2>
          <p className="steps-subtitle">かんたん3ステップで予約が完了します</p>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-title">利用要綱を確認</div>
              <div className="step-desc">規約・注意事項をお読みください</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-title">フォームに記入</div>
              <div className="step-desc">必要事項を入力して送信</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-title">予約完了</div>
              <div className="step-desc">担当者よりご連絡します</div>
            </div>
          </div>
        </section>

        {/* Cancel */}
        <section style={{ background: 'var(--white)', padding: '40px 20px', borderTop: '1px solid var(--g200)' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--g800)', marginBottom: '6px' }}>
                🗓️ 予約のキャンセルはこちら
              </div>
              <div style={{ fontSize: '.875rem', color: 'var(--g500)' }}>
                電話番号で予約を検索してキャンセルできます。前日まで無料です。
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => navigate('/cancel')}
              style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
              キャンセルページへ →
            </button>
          </div>
        </section>

        {/* Notice */}
        <section className="notice-section">
          <div className="notice-inner">
            <span className="notice-icon">⚠️</span>
            <div>
              <div className="notice-title">キャンセルについて</div>
              <div className="notice-text">
                前日までのキャンセルは無料です。当日キャンセルはキャンセル料（半額）が発生します。
                5回以上ご利用のお客様には割引クーポンをプレゼントしています。
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        © 2024 けやき保育園 &nbsp;|&nbsp;
        <a href="/cancel">予約のキャンセル</a> &nbsp;|&nbsp;
        <a href="/admin">管理者ページ</a>
      </footer>
    </div>
  )
}
