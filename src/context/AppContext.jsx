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

export const NURSE_COLORS = [
  '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE',
  '#CFFAFE', '#FFE4E6', '#DCFCE7', '#FEF9C3', '#E0E7FF',
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
  const [nurses, setNurses] = useState([])
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
      // shifts: { date: { assignments: { slot: nurseId[] } } }
      onSnapshot(collection(db, 'shifts'), (snap) => {
        const data = {}
        snap.docs.forEach(d => { data[d.id] = d.data() })
        setShifts(data)
      }),
      onSnapshot(
        query(collection(db, 'nurses'), orderBy('createdAt', 'asc')),
        (snap) => setNurses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      ),
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

  // ===== 保育士 =====
  const addNurse = async (name) => {
    if (!name.trim()) return
    await addDoc(collection(db, 'nurses'), { name: name.trim(), createdAt: serverTimestamp() })
  }

  const deleteNurse = async (id) => {
    await deleteDoc(doc(db, 'nurses', id))
  }

  // ===== シフト（保育士単位） =====
  const addShiftDate = async (date) => {
    const ref = doc(db, 'shifts', date)
    const snap = await getDoc(ref)
    if (!snap.exists()) await setDoc(ref, { assignments: {}, updatedAt: serverTimestamp() })
  }

  const addNurseToSlot = async (date, slot, nurseId) => {
    const ref = doc(db, 'shifts', date)
    const snap = await getDoc(ref)
    const assignments = snap.exists() ? (snap.data().assignments || {}) : {}
    const current = assignments[slot] || []
    if (current.includes(nurseId)) return
    await setDoc(ref, {
      assignments: { ...assignments, [slot]: [...current, nurseId] },
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  const removeNurseFromSlot = async (date, slot, nurseId) => {
    const ref = doc(db, 'shifts', date)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const assignments = snap.data().assignments || {}
    const updated = { ...assignments, [slot]: (assignments[slot] || []).filter(id => id !== nurseId) }
    await updateDoc(ref, { assignments: updated, updatedAt: serverTimestamp() })
  }

  const removeShiftDate = async (date) => {
    await deleteDoc(doc(db, 'shifts', date))
  }

  const getAvailableDates = () => Object.keys(shifts).sort()

  const getAvailableSlots = (date) => {
    const assignments = shifts[date]?.assignments || {}
    return TIME_SLOTS.filter(slot => (assignments[slot] || []).length > 0)
  }

  const getSlotNurses = (date, slot) => {
    const assignments = shifts[date]?.assignments || {}
    const ids = assignments[slot] || []
    return ids.map(id => nurses.find(n => n.id === id)).filter(Boolean)
  }

  // ===== 予約 =====
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

  const markCouponUsed = (phone) =>
    updateDoc(doc(db, 'coupons', phone), { used: true, usedAt: serverTimestamp() })

  return (
    <AppContext.Provider value={{
      termsAgreed, setTermsAgreed,
      reservations, addReservation, updateStatus, deleteReservation,
      shifts, nurses, addNurse, deleteNurse,
      addShiftDate, removeShiftDate,
      addNurseToSlot, removeNurseFromSlot,
      getAvailableDates, getAvailableSlots, getSlotNurses,
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
