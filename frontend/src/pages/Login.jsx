/**
 * Login.jsx — /login rotası artık Landing paneline yönlendirir.
 * Tüm giriş akışı (credentials + OTP) Landing.jsx'teki panel üzerinden yapılır.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/', { replace: true })
  }, [navigate])
  return null
}
