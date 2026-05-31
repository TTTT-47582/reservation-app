import { createContext, useContext, useState, useEffect } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth'
import { db, auth } from '../firebase'

const AppContext = createContext(null)

export const TIME_SLOTS = [
  '07:00〜08:00', '08:00〜09:00', '09:00〜10:00', '10:00〜11:00',
  '11:00〜12:00', '12:00〜13:00', '13:00〜14:00', '14:00〜15:00',
  '15:00〜16:00', '16:00〜17:00', '17:00〜18:00', '18:00〜19:00',
]

export const NURSE_COLORS = [
  '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE',
  '#CFFAFE', '#FFE4E6', '#DCFCE7', '#FEF9C3', '#E0E7FF',
]

// 時間範囲を { startH, endH } に変換 ("09:00〜17:00" → { startH:9, endH:17 })
export function parseTimeRange(timeSlot) {
  if (!timeSlot) return { startH: 0, endH: 0 }
  const [s, e] = timeSlot.split('〜')
  return { startH: parseInt(s) || 0, endH: parseInt(e) || 0 }
}

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
  const [closedDates, setClosedDates] = useState([])
  const [photoAlbums, setPhotoAlbums] = useState([])
  const [lastReservation, setLastReservation] = useState(null)
  const [loading, setLoading] = useState(true)
  // ユーザー認証
  const [authUser, setAuthUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user)
      if (user) {
        const snap = await getDoc(doc(db, 'userProfiles', user.uid))
        setUserProfile(snap.exists() ? snap.data() : null)
      } else {
        setUserProfile(null)
      }
      setAuthLoading(false)
    })
    return () => unsubAuth()
  }, [])

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
      onSnapshot(collection(db, 'closedDates'), (snap) => {
        setClosedDates(snap.docs.map(d => d.id))
      }),
      onSnapshot(
        query(collection(db, 'photoAlbums'), orderBy('createdAt', 'desc')),
        (snap) => setPhotoAlbums(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      ),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  // ===== ユーザー認証 =====
  const registerUser = async (email, password, profile) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const profileData = { ...profile, email, createdAt: new Date().toISOString() }
    await setDoc(doc(db, 'userProfiles', cred.user.uid), profileData)
    setUserProfile(profileData)
    return cred.user
  }

  const loginUser = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, 'userProfiles', cred.user.uid))
    if (snap.exists()) setUserProfile(snap.data())
    return cred.user
  }

  const logoutUser = () => {
    setUserProfile(null)
    return signOut(auth)
  }

  const updateUserProfile = async (profile) => {
    if (!authUser) return
    const updated = { ...profile, updatedAt: new Date().toISOString() }
    await updateDoc(doc(db, 'userProfiles', authUser.uid), updated)
    setUserProfile(prev => ({ ...prev, ...updated }))
  }

  const changeUserPassword = async (currentPassword, newPassword) => {
    if (!authUser) return
    const cred = EmailAuthProvider.credential(authUser.email, currentPassword)
    await reauthenticateWithCredential(authUser, cred)
    await updatePassword(authUser, newPassword)
  }

  // 管理者かどうか（環境変数で指定したメールアドレスと一致するか）
  const isAdmin = authUser?.email === import.meta.env.VITE_ADMIN_EMAIL

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
    if (!snap.exists()) {
      await setDoc(ref, { assignments: {}, source: 'app', updatedAt: serverTimestamp() })
    } else {
      await updateDoc(ref, { source: 'app', updatedAt: serverTimestamp() })
    }
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

  const getAvailableDates = () => {
    const today = new Date().toISOString().split('T')[0]
    return Object.keys(shifts)
      .filter(date => {
        if (date < today) return false
        if (closedDates.includes(date)) return false
        const assignments = shifts[date]?.assignments || {}
        return Object.values(assignments).some(ids => Array.isArray(ids) && ids.length > 0)
      })
      .sort()
  }

  // ===== 休園日 =====
  const addClosedDate = async (date) => {
    await setDoc(doc(db, 'closedDates', date), { createdAt: serverTimestamp() })
  }

  const removeClosedDate = async (date) => {
    await deleteDoc(doc(db, 'closedDates', date))
  }

  // ===== 写真アルバム =====
  const createPhotoAlbum = async ({ childName, parentName, phone, date, expiryDays = 3 }) => {
    const pin = String(Math.floor(1000 + Math.random() * 9000))
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + Number(expiryDays))
    const ref = await addDoc(collection(db, 'photoAlbums'), {
      childName, parentName, phone, date,
      pin,
      expiresAt: expiresAt.toISOString(),
      photoUrls: [],
      createdAt: serverTimestamp(),
    })
    return { id: ref.id, pin }
  }

  const addPhotoUrl = async (albumId, url) => {
    const ref = doc(db, 'photoAlbums', albumId)
    const snap = await getDoc(ref)
    const current = snap.data()?.photoUrls || []
    await updateDoc(ref, { photoUrls: [...current, url] })
  }

  const removePhotoUrl = async (albumId, url) => {
    const ref = doc(db, 'photoAlbums', albumId)
    const snap = await getDoc(ref)
    const current = snap.data()?.photoUrls || []
    await updateDoc(ref, { photoUrls: current.filter(u => u !== url) })
  }

  const deletePhotoAlbum = async (albumId) => {
    await deleteDoc(doc(db, 'photoAlbums', albumId))
  }

  const getAvailableSlots = (date) => {
    const assignments = shifts[date]?.assignments || {}
    return TIME_SLOTS.filter(slot => (assignments[slot] || []).length > 0)
  }

  const getSlotNurses = (date, slot) => {
    const assignments = shifts[date]?.assignments || {}
    const ids = assignments[slot] || []
    return ids.map(id => nurses.find(n => n.id === id)).filter(Boolean)
  }

  const getSlotCapacity = (date, slot) => {
    const nurseCount = getSlotNurses(date, slot).length
    const maxCapacity = nurseCount * 5
    const { startH: slotStart, endH: slotEnd } = parseTimeRange(slot)
    const overlaps = (r) => {
      const { startH, endH } = parseTimeRange(r.timeSlot)
      return startH < slotEnd && endH > slotStart
    }
    const active = reservations.filter(r =>
      r.date === date && r.status !== 'cancelled' && r.status !== 'waitlisted' && overlaps(r)
    )
    const waitlisted = reservations.filter(r =>
      r.date === date && r.status === 'waitlisted' && overlaps(r)
    )
    return {
      nurseCount,
      maxCapacity,
      current: active.length,
      available: nurseCount > 0 ? Math.max(0, maxCapacity - active.length) : 0,
      waitlistCount: waitlisted.length,
      isFull: nurseCount > 0 && active.length >= maxCapacity,
    }
  }

  // 指定日の予約可能な開始時刻一覧（保育士が配置されているスロットの開始時刻）
  const getAvailableStartTimes = (date) => {
    const assignments = shifts[date]?.assignments || {}
    return TIME_SLOTS
      .filter(slot => (assignments[slot] || []).length > 0)
      .map(slot => slot.split('〜')[0])
  }

  // 指定日・開始時刻から連続して保育士が配置されている終了時刻一覧
  const getConsecutiveEndTimes = (date, startTime) => {
    if (!startTime) return []
    const assignments = shifts[date]?.assignments || {}
    const startH = parseInt(startTime)
    const ends = []
    for (let h = startH; h <= 18; h++) {
      const slot = `${String(h).padStart(2, '0')}:00〜${String(h + 1).padStart(2, '0')}:00`
      if ((assignments[slot] || []).length === 0) break
      ends.push(`${String(h + 1).padStart(2, '0')}:00`)
    }
    return ends
  }

  // ===== 予約 =====
  const sanitize = (v, maxLen = 100) =>
    typeof v === 'string' ? v.trim().slice(0, maxLen) : v

  const addReservation = async (formData) => {
    const sanitized = {
      ...formData,
      parentName: sanitize(formData.parentName, 50),
      childName: sanitize(formData.childName, 50),
      childKana: sanitize(formData.childKana, 50),
      phone: sanitize(formData.phone, 20),
      purpose: sanitize(formData.purpose, 200),
      notes: sanitize(formData.notes, 500),
      couponCode: sanitize(formData.couponCode, 30),
    }
    const phone = sanitized.phone

    // 同一電話番号の有効予約が3件以上なら拒否（過去・キャンセル・キャンセル待ちは除く）
    const today = new Date().toISOString().split('T')[0]
    const active = reservations.filter(r =>
      r.phone === phone &&
      r.status !== 'cancelled' &&
      r.status !== 'waitlisted' &&
      r.date >= today
    )
    if (active.length >= 3) return { error: 'max_reservations' }

    // 同一電話番号・同一日付・時間帯が重複する予約を拒否
    const { startH: newStart, endH: newEnd } = parseTimeRange(sanitized.timeSlot)
    const duplicate = reservations.some(r => {
      if (r.phone !== phone || r.date !== sanitized.date) return false
      if (r.status === 'cancelled' || r.status === 'waitlisted') return false
      const { startH, endH } = parseTimeRange(r.timeSlot)
      return startH < newEnd && endH > newStart
    })
    if (duplicate) return { error: 'duplicate' }

    // シフト確認・定員チェック（範囲内の全1時間スロットを確認）
    if (Object.keys(shifts).length > 0) {
      const assignments = shifts[sanitized.date]?.assignments || {}
      for (let h = newStart; h < newEnd; h++) {
        const slot = `${String(h).padStart(2, '0')}:00〜${String(h + 1).padStart(2, '0')}:00`
        if ((assignments[slot] || []).length === 0) return { error: 'no_shift' }
        if (getSlotCapacity(sanitized.date, slot).isFull) return { error: 'full' }
      }
    }

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

    // 入力されたクーポンコードを検証し、即座に使用済みにする
    let couponApplied = false
    if (sanitized.couponCode && couponSnap.exists()) {
      const c = couponSnap.data()
      if (c.code === sanitized.couponCode && !c.used) {
        couponApplied = true
        await updateDoc(couponRef, { used: true, usedAt: serverTimestamp() })
      }
    }

    const reservation = {
      ...sanitized,
      createdAt: serverTimestamp(),
      status: 'pending',
      visitCount: newCount,
      couponCode,
      couponInfo,
      couponApplied,
    }
    const ref = await addDoc(collection(db, 'reservations'), reservation)
    const result = { ...reservation, id: ref.id, createdAt: new Date().toISOString() }
    setLastReservation(result)
    return result
  }

  const addToWaitlist = async (formData) => {
    const sanitized = {
      ...formData,
      parentName: sanitize(formData.parentName, 50),
      childName: sanitize(formData.childName, 50),
      childKana: sanitize(formData.childKana, 50),
      phone: sanitize(formData.phone, 20),
      purpose: sanitize(formData.purpose, 200),
      notes: sanitize(formData.notes, 500),
    }
    const phone = sanitized.phone

    // シフト確認（範囲内の全スロット）
    const { startH: wStart, endH: wEnd } = parseTimeRange(sanitized.timeSlot)
    if (Object.keys(shifts).length > 0) {
      const assignments = shifts[sanitized.date]?.assignments || {}
      for (let h = wStart; h < wEnd; h++) {
        const slot = `${String(h).padStart(2, '0')}:00〜${String(h + 1).padStart(2, '0')}:00`
        if ((assignments[slot] || []).length === 0) return { error: 'no_shift' }
      }
    }

    const existingWaitlist = reservations.some(r => {
      if (r.phone !== phone || r.date !== sanitized.date || r.status !== 'waitlisted') return false
      const { startH, endH } = parseTimeRange(r.timeSlot)
      return startH < wEnd && endH > wStart
    })
    if (existingWaitlist) return { error: 'duplicate_waitlist' }

    const reservation = {
      ...sanitized,
      createdAt: serverTimestamp(),
      status: 'waitlisted',
      visitCount: visitCounts[phone] || 0,
      couponCode: null,
      couponInfo: null,
      couponApplied: false,
    }
    const ref = await addDoc(collection(db, 'reservations'), reservation)
    const result = { ...reservation, id: ref.id, createdAt: new Date().toISOString() }
    setLastReservation(result)
    return result
  }

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, 'reservations', id), { status })
    if (status === 'cancelled') {
      const cancelled = reservations.find(r => r.id === id)
      if (cancelled) {
        const waitlist = reservations
          .filter(r =>
            r.date === cancelled.date &&
            r.timeSlot === cancelled.timeSlot &&
            r.status === 'waitlisted'
          )
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime()
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime()
            return ta - tb
          })
        if (waitlist.length > 0) {
          await updateDoc(doc(db, 'reservations', waitlist[0].id), {
            status: 'pending',
            promotedFromWaitlist: true,
            promotedAt: serverTimestamp(),
          })
        }
      }
    }
  }

  const changeReservation = async (id, updatedData) => {
    const phone = updatedData.phone
    const { startH: cStart, endH: cEnd } = parseTimeRange(updatedData.timeSlot)
    const duplicate = reservations.some(r => {
      if (r.id === id || r.phone !== phone || r.date !== updatedData.date) return false
      if (r.status === 'cancelled' || r.status === 'waitlisted') return false
      const { startH, endH } = parseTimeRange(r.timeSlot)
      return startH < cEnd && endH > cStart
    })
    if (duplicate) return { error: 'duplicate' }
    await updateDoc(doc(db, 'reservations', id), {
      date: updatedData.date,
      timeSlot: updatedData.timeSlot,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  }

  const deleteReservation = (id) =>
    deleteDoc(doc(db, 'reservations', id))

  const markCouponUsed = (phone) =>
    updateDoc(doc(db, 'coupons', phone), { used: true, usedAt: serverTimestamp() })

  const reissueCoupon = async (phone) => {
    const code = generateCouponCode()
    await setDoc(doc(db, 'coupons', phone), {
      code,
      issuedAt: new Date().toISOString(),
      used: false,
      reissuedAt: serverTimestamp(),
    })
  }

  return (
    <AppContext.Provider value={{
      termsAgreed, setTermsAgreed,
      reservations, addReservation, addToWaitlist, updateStatus, changeReservation, deleteReservation,
      shifts, nurses, addNurse, deleteNurse,
      addShiftDate, removeShiftDate,
      addNurseToSlot, removeNurseFromSlot,
      getAvailableDates, getAvailableSlots, getAvailableStartTimes, getConsecutiveEndTimes,
      getSlotNurses, getSlotCapacity,
      visitCounts, coupons, markCouponUsed, reissueCoupon,
      closedDates, addClosedDate, removeClosedDate,
      photoAlbums, createPhotoAlbum, addPhotoUrl, removePhotoUrl, deletePhotoAlbum,
      lastReservation, loading,
      authUser, userProfile, authLoading, isAdmin,
      registerUser, loginUser, logoutUser, updateUserProfile, changeUserPassword,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
