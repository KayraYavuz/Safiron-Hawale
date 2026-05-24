import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../utils/api'
import { useAuthStore } from '../store'
import { useLang } from '../hooks/useLang'
import toast from 'react-hot-toast'
import { C } from '../components/UI'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPwd, setShowPwd]   = useState(false)
  const { setToken, setUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const { lang, setLang, t } = useLang()

  useEffect(() => { logout() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(email, password)
      setToken(data.access_token)
      const { data: me } = await authApi.me()
      setUser(me)
      navigate(me?.role === 'super_admin' ? '/companies' : '/dashboard')
    } catch {
      toast.error(t.loginError)
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width:'100%', padding:'11px 14px', borderRadius:10,
    background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.15)',
    color:'white', fontSize:14, outline:'none', fontFamily:'var(--font)',
    transition:'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', fontFamily:'var(--font)',
      background:'#0D1B2E',
    }}>
      {/* Left — Form */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ maxWidth:380, width:'100%' }}>
          {/* Logo */}
          <div style={{ marginBottom:36, display:'flex', justifyContent:'center' }}>
            <img
              src="/emblem.png"
              alt="Safiron"
              style={{ width:90, height:90, objectFit:'contain' }}
            />
          </div>

          <div style={{
            background:'rgba(255,255,255,0.06)', backdropFilter:'blur(20px)',
            borderRadius:20, padding:32, border:'1px solid rgba(255,255,255,0.1)',
          }}>
            {/* Lang */}
            <div style={{ display:'flex', gap:6, justifyContent:'flex-end', marginBottom:24 }}>
              {['tr','ar','en'].map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding:'4px 10px', borderRadius:7, fontSize:11.5, cursor:'pointer',
                  fontFamily:'var(--font)', transition:'all 0.15s', fontWeight: l===lang ? 600 : 400,
                  background: l===lang ? C.accent : 'transparent',
                  color: l===lang ? C.navy : 'rgba(255,255,255,0.4)',
                  border: l===lang ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>
                  {l==='tr'?'TR':l==='ar'?'ع':'EN'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }} aria-label={t.loginFormLabel}>
              <div>
                <label htmlFor="login-email" style={{ display:'block', color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:500, marginBottom:6 }}>{t.email}</label>
                <input id="login-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required style={inp} />
              </div>
              <div>
                <label htmlFor="login-password" style={{ display:'block', color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:500, marginBottom:6 }}>{t.password}</label>
                <div style={{ position:'relative' }}>
                  <input id="login-password" type={showPwd ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required style={{ ...inp, paddingRight:42 }} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                    position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)',
                    fontSize:13, padding:0, lineHeight:1,
                  }}>
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={{
                marginTop:4, padding:'12px', borderRadius:10, border:'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'rgba(201,168,76,0.5)' : `linear-gradient(135deg, ${C.accent}, ${C.accent})`,
                color:C.navy, fontSize:14, fontWeight:700, fontFamily:'var(--font)', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? t.loggingIn : t.loginBtn}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right — Decorative */}
      <div style={{
        width:380, borderLeft:'1px solid rgba(255,255,255,0.06)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, gap:16,
      }}>
        {[
          { label: t.activeLocation, value:'5', sub:'IST · CAI · RYD · DXB · CHN' },
          { label: t.currency, value:'22+', sub: t.majorRegional },
          { label: t.langSupport, value:'3', sub:'TR · AR · EN' },
        ].map((s,i) => (
          <div key={i} style={{
            width:'100%', padding:'18px 24px',
            background:'rgba(255,255,255,0.04)', borderRadius:14,
            border:'1px solid rgba(255,255,255,0.06)', textAlign:'center',
          }}>
            <div style={{ color:C.accent, fontSize:28, fontWeight:700, fontFamily:'var(--mono)' }}>{s.value}</div>
            <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13, fontWeight:500, margin:'4px 0' }}>{s.label}</div>
            <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
