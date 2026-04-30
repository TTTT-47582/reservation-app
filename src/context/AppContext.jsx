import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(null)

export const TIME_SLOTS = [
  '07:00〜09:00',
  '09:00〜12:00',
  '12:00〜15:00',
  '15:00〜18:00',
  '18:00〜19:00',
]

function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `SAKURA-${seg()}-${seg()}`
}

function buildDefaultShifts() {
  const shifts = {}
  const today = new Date()
  for (let i = 3; i <= 21; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    if (dow === 0) continue
    const dateStr = d.toISOString().split('T')[0]
    shifts[dateStr] = dow === 6
      ? ['07:00〜09:00', '09:00〜12:00', '12:00〜15:00']
      : [...TIME_SLOTS]
  }
  return shifts
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}

export function AppProvider({ children }) {
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [reservations, setReservations] = useState(() => load('reservations', []))
  const [shifts, setShifts] = useState(() => load('shifts', buildDefaultShifts()))
  const [visitCounts, setVisitCounts] = useState(() => load('visitCounts', {}))
  const [coupons, setCoupons] = useState(() => load('coupons', {}))
  const [lastReservation, setLastReservation] = useState(null)

  useEffect(() => { localStorage.setItem('reservations', JSON.stringify(reservations)) }, [reservations])
  useEffect(() => { localStorage.setItem('shifts', JSON.stringify(shifts)) }, [shifts])
  useEffect(() => { localStorage.setItem('visitCounts', JSON.stringify(visitCounts)) }, [visitCounts])
  useEffect(() => { localStorage.setItem('coupons', JSON.stringify(coupons)) }, [coupons])

  const addReservation = (formData) => {
    const phone = formData.phone
    const newCount = (visitCounts[phone] || 0) + 1

    let couponCode = null
    const newCoupons = { ...coupons }
    if (newCount === 5 && !coupons[phone]) {
      couponCode = generateCouponCode()
      newCoupons[phone] = { code: couponCode, issuedAt: new Date().toISOString(), used: false }
      setCoupons(newCoupons)
    }

    setVisitCounts(prev => ({ ...prev, [phone]: newCount }))

    const reservation = {
      ...formData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      visitCount: newCount,
      couponCode,
      couponInfo: newCoupons[phone] || coupons[phone] || null,
    }
    setReservations(prev => [reservation, ...prev])
    setLastReservation(reservation)
    return reservation
  }

  const updateStatus = (id, status) =>
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))

  const deleteReservation = (id) =>
    setReservations(prev => prev.filter(r => r.id !== id))

  const addShiftSlot = (date, slot) =>
    setShifts(prev => ({ ...prev, [date]: [...new Set([...(prev[date] || []), slot])].sort() }))

  const removeShiftSlot = (date, slot) =>
    setShifts(prev => {
      const updated = (prev[date] || []).filter(s => s !== slot)
      if (updated.length === 0) {
        const { [date]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [date]: updated }
    })

  const addShiftDate = (date) =>
    setShifts(prev => ({ ...prev, [date]: prev[date] || [] }))

  const getAvailableDates = () => Object.keys(shifts).sort()
  const getAvailableSlots = (date) => shifts[date] || []

  const markCouponUsed = (phone) =>
    setCoupons(prev => prev[phone] ? { ...prev, [phone]: { ...prev[phone], used: true } } : prev)

  return (
    <AppContext.Provider value={{
      termsAgreed, setTermsAgreed,
      reservations, addReservation, updateStatus, deleteReservation,
      shifts, addShiftSlot, removeShiftSlot, addShiftDate,
      getAvailableDates, getAvailableSlots,
      visitCounts, coupons, markCouponUsed,
      lastReservation,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
