import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Login from './pages/Login'
import Home from './pages/Home'
import Terms from './pages/Terms'
import ReservationForm from './pages/ReservationForm'
import Confirmation from './pages/Confirmation'
import Admin from './pages/Admin'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/reservation" element={<ReservationForm />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
