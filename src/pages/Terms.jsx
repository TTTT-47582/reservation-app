import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function Terms() {
  const navigate = useNavigate()
  const { setTermsAgreed } = useApp()
  const [checked, setChecked] = useState(false)

  const handleNext = () => {
    if (!checked) return
    setTermsAgreed(true)
    navigate('/reservation')
  }

  return (
    <div className="terms-page">
      <div className="terms-page-header">
        <div className="terms-page-header-inner">
          <button className="terms-back-btn" onClick={() => navigate('/')}>
            <span>←</span> トップに戻る
          </button>
          <span style={{ fontSize: '.875rem', color: 'var(--g500)' }}>
            利用要綱を最後までお読みのうえ、同意してお進みください
          </span>
        </div>
      </div>

      <div className="terms-content">
        <h1 className="terms-title">一時保育 利用要綱</h1>
        <p className="terms-meta">最終更新日：2024年4月1日</p>

        <div className="terms-section">
          <h2 className="terms-section-title">
            <span className="terms-num">1</span>目的・対象
          </h2>
          <p>さくら保育園の一時保育は、就労・求職活動・通院・冠婚葬祭・リフレッシュ等の理由で、一時的に保育を必要とする保護者のお子様をお預かりするサービスです。</p>
          <p>対象年齢：生後6ヶ月から就学前のお子様。定員は1日10名様までです。</p>
        </div>

        <div className="terms-section">
          <h2 className="terms-section-title">
            <span className="terms-num">2</span>予約について
          </h2>
          <p>ご利用希望日の3日前（営業日ベース）までに本フォームからお申し込みください。受付後、担当者より電話またはメールにてご連絡いたします。</p>
          <ul>
            <li>予約確定は担当者からの確認連絡をもって完了となります</li>
            <li>定員に達した場合はご希望に添えない場合があります</li>
            <li>体調不良・感染症の疑いがある場合はご利用をお断りする場合があります</li>
            <li>ご予約はお1人のお子様につき1件とさせていただきます</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2 className="terms-section-title">
            <span className="terms-num">3</span>利用時間・料金
          </h2>
          <p>受付時間は7:00〜19:00（日曜・祝日を除く）です。</p>
          <ul>
            <li>基本料金：1時間あたり500円（0〜2歳児）/ 400円（3歳以上）</li>
            <li>昼食・おやつが必要な場合は別途 300円</li>
            <li>延長保育（18:00以降）は追加料金 200円/30分</li>
            <li>5回目のご利用から割引クーポンをプレゼントいたします</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2 className="terms-section-title">
            <span className="terms-num">4</span>キャンセルポリシー
          </h2>
          <p>キャンセルは必ず事前にお電話またはLINEにてご連絡ください。</p>
          <ul>
            <li>3日前以前のキャンセル：無料</li>
            <li>前日のキャンセル：無料</li>
            <li>当日のキャンセル：ご利用料金の50%</li>
            <li>無断キャンセル：ご利用料金の100%</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2 className="terms-section-title">
            <span className="terms-num">5</span>持ち物
          </h2>
          <ul>
            <li>着替え（2〜3セット）</li>
            <li>おむつ・おしりふき（必要な場合）</li>
            <li>哺乳瓶・ミルク（乳児の場合）</li>
            <li>タオル・エプロン（食事時に使用する場合）</li>
            <li>アレルギーのあるお子様は除去食申請書（事前提出）</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2 className="terms-section-title">
            <span className="terms-num">6</span>個人情報の取り扱い
          </h2>
          <p>ご入力いただいた個人情報は、一時保育サービスの提供・運営管理・緊急時の連絡のみに使用し、第三者へ提供しません。利用後は適切な期間保管の上、廃棄します。</p>
        </div>

        <div className="terms-section">
          <h2 className="terms-section-title">
            <span className="terms-num">7</span>禁止事項・免責
          </h2>
          <p>以下に該当する場合はご利用をお断りする場合があります。</p>
          <ul>
            <li>37.5℃以上の発熱、または発熱後24時間未満のお子様</li>
            <li>感染症（インフルエンザ・水痘等）罹患中または疑いのある場合</li>
            <li>持病・障害について事前に申告がない場合</li>
          </ul>
          <p>天災・不測の事態による施設の閉鎖や予約キャンセルについては、当園の責任を免除させていただきます。</p>
        </div>
      </div>

      <div className="terms-footer-bar">
        <div className="terms-footer-inner">
          <label className="agree-label">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
            利用要綱をすべて読み、同意します
          </label>
          <button className="btn btn-primary" onClick={handleNext} disabled={!checked}>
            同意して予約へ進む →
          </button>
        </div>
      </div>
    </div>
  )
}
