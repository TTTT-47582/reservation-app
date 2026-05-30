import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const DAYS = ['日', '月', '火', '水', '木', '金', '土']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export default function CalendarModal({ onClose }) {
  const navigate = useNavigate()
  const { getAvailableDates, getAvailableStartTimes, termsAgreed, setTermsAgreed } = useApp()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)

  const availableDates = new Set(getAvailableDates())

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const formatDateStr = (day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const handleDayClick = (day) => {
    const dateStr = formatDateStr(day)
    if (availableDates.has(dateStr) && dateStr >= todayStr) {
      setSelectedDate(dateStr)
    }
  }

  const handleSlotClick = (startTime) => {
    const existing = JSON.parse(sessionStorage.getItem('reservationForm') || '{}')
    sessionStorage.setItem('reservationForm', JSON.stringify({
      ...existing,
      date: selectedDate,
      startTime,
      endTime: '',
    }))
    onClose()
    navigate(termsAgreed ? '/reservation' : '/terms')
  }

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return ''
    const dt = new Date(dateStr)
    return `${dt.getMonth() + 1}月${dt.getDate()}日（${DAYS[dt.getDay()]}）`
  }

  const availableSlots = selectedDate ? getAvailableStartTimes(selectedDate) : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span>📅 予約可能日を確認</span>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>＜</button>
          <span className="cal-nav-label">{year}年 {MONTHS[month]}</span>
          <button className="cal-nav-btn" onClick={nextMonth}>＞</button>
        </div>

        <div className="cal-grid">
          {DAYS.map((d, i) => (
            <div key={d} className={`cal-day-hd${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = formatDateStr(day)
            const isAvailable = availableDates.has(dateStr)
            const isPast = dateStr < todayStr
            const isSelected = selectedDate === dateStr
            const dow = new Date(year, month, day).getDay()
            return (
              <div
                key={day}
                className={[
                  'cal-day',
                  isAvailable && !isPast ? 'cal-available' : '',
                  isPast ? 'cal-past' : '',
                  isSelected ? 'cal-selected' : '',
                  dow === 0 ? 'cal-sun' : dow === 6 ? 'cal-sat' : '',
                ].join(' ')}
                onClick={() => handleDayClick(day)}
              >
                {day}
              </div>
            )
          })}
        </div>

        <div className="cal-legend">
          <span className="cal-legend-dot available" />予約可能
        </div>

        {selectedDate && (
          <div className="cal-slots">
            <div className="cal-slots-title">{formatDateLabel(selectedDate)} の予約可能な開始時刻</div>
            {availableSlots.length === 0 ? (
              <p style={{ color: 'var(--g400)', fontSize: '.875rem' }}>この日は予約可能な時間帯がありません</p>
            ) : (
              <div className="cal-slot-list">
                {availableSlots.map(t => (
                  <button key={t} className="cal-slot-btn" onClick={() => handleSlotClick(t)}>
                    {t}〜
                    <span style={{ fontSize: '.75rem', marginLeft: '6px' }}>→ 予約へ</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
