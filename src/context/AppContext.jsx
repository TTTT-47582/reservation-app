import { createContext, useContext, useState, useEffect } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'

const AppContext = createContext(null)

export const TIME_SLOTS = [
  '07:00〜09:00', '09:00〜12:00', '12:00〜15:00', '15:00〜18:00', '18:00〜19:00',
]

function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `SAKURA-${seg()}-${seg()}`
}

export function AppProvider({ children }) {
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [reservations, setReservations] = useState([])
  const [shifts, setShifts] = useState({})
  const [visitCounts, setVisitCounts] = useState({})
  const [coupons, setCoupons] = useState({})
  const [lastReservation, setLastReservation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, 'reservations'), orderBy('createdAt', 'desc')),
        (snap) => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'shifts'), (snap) => {
        const data = {}
        snap.docs.forEach(d => { data[d.id] = d.data().slots || [] })
        setShifts(data)
      }),
      onSnapshot(collection(db, 'visitCounts'), (snap) => {
        const data = {}
        snap.docs.forEach(d => { data[d.id] = d.data().count })
        setVisitCounts(data)
      }),
      onSnapshot(collection(db, 'coupons'), (snap) => {
        const data = {}
        snap.docs.forEach(d => { data[d.id] = d.data() })
        setCoupons(data)
        setLoading(false)
      }),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  const addReservation = async (formData) => {
    const phone = formData.phone

    const visitRef = doc(db, 'visitCounts', phone)
    const visitSnap = await getDoc(visitRef)
    const newCount = (visitSnap.exists() ? visitSnap.data().count : 0) + 1
    await setDoc(visitRef, { count: newCount })

    let couponCode = null
    let couponInfo = null
    const couponRef = doc(db, 'coupons', phone)
    const couponSnap = await getDoc(couponRef)
    if (newCount === 5 && !couponSnap.exists()) {
      couponCode = generateCouponCode()
      couponInfo = { code: couponCode, issuedAt: new Date().toISOString(), used: false }
      await setDoc(couponRef, couponInfo)
    } else if (couponSnap.exists()) {
      couponInfo = couponSnap.data()
    }

    const reservation = {
      ...formData,
      createdAt: serverTimestamp(),
      status: 'pending',
      visitCount: newCount,
      couponCode,
      couponInfo,
    }

    const ref = await addDoc(collection(db, 'reservations'), reservation)
    const result = { ...reservation, id: ref.id, createdAt: new Date().toISOString() }
    setLastReservation(result)
    return result
  }

  const updateStatus = (id, status) =>
    updateDoc(doc(db, 'reservations', id), { status })

  const deleteReservation = (id) =>
    deleteDoc(doc(db, 'reservations', id))

  const addShiftDate = async (date) => {
    const ref = doc(db, 'shifts', date)
    const snap = await getDoc(ref)
    if (!snap.exists()) await setDoc(ref, { slots: [], updatedAt: serverTimestamp() })
  }

  const addShiftSlot = async (date, slot) => {
    const ref = doc(db, 'shifts', date)
    const snap = await getDoc(ref)
    const current = snap.exists() ? snap.data().slots || [] : []
    const updated = [...new Set([...current, slot])].sort()
    await setDoc(ref, { slots: updated, updatedAt: serverTimestamp() })
  }

  const removeShiftSlot = async (date, slot) => {
    const ref = doc(db, 'shifts', date)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const updated = snap.data().slots.filter(s => s !== slot)
    if (updated.length === 0) await deleteDoc(ref)
    else await updateDoc(ref, { slots: updated, updatedAt: serverTimestamp() })
  }

  const markCouponUsed = (phone) =>
    updateDoc(doc(db, 'coupons', phone), { used: true, usedAt: serverTimestamp() })

  const getAvailableDates = () => Object.keys(shifts).sort()
  const getAvailableSlots = (date) => shifts[date] || []

  return (
    <AppContext.Provider value={{
      termsAgreed, setTermsAgreed,
      reservations, addReservation, updateStatus, deleteReservation,
      shifts, addShiftDate, addShiftSlot, removeShiftSlot,
      getAvailableDates, getAvailableSlots,
      visitCounts, coupons, markCouponUsed,
      lastReservation, loading,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
