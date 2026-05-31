import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Login from './pages/Login'
import Home from './pages/Home'
import Terms from './pages/Terms'
import ReservationForm from './pages/ReservationForm'
import Confirmation from './pages/Confirmation'
import Admin from './pages/Admin'
import Cancel from './pages/Cancel'
import PhotoViewer from './pages/PhotoViewer'
import UserLogin from './pages/UserLogin'
import UserRegister from './pages/UserRegister'
import UserMyPage from './pages/UserMyPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/reservation" element={<ReservationForm />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/cancel" element={<Cancel />} />
          <Route path="/photos/:albumId" element={<PhotoViewer />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/user-login" element={<UserLogin />} />
          <Route path="/register" element={<UserRegister />} />
          <Route path="/mypage" element={<UserMyPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
