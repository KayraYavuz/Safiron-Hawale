import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../utils/api'
import { useAuthStore } from '../store'
import { useLang } from '../hooks/useLang'
import toast from 'react-hot-toast'
import { C } from '../components/UI'

export default function Login() {
  const [email, setEmail]       = useState('admin@hawala.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading]   = useState(false)
  const { setToken, setUser }   = useAuthStore()
  const navigate = useNavigate()
  const { lang, setLang } = useLang()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(email, password)
      setToken(data.access_token)
      const { data: me } = await authApi.me()
      setUser(me)
      navigate('/')
    } catch {
      toast.error('Hatalı email veya şifre')
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
      {/* Sol — Form */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ maxWidth:380, width:'100%' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:32 }}>
            <div style={{
              width:44, height:44, borderRadius:12,
              background:`linear-gradient(135deg, ${C.accent}, ${C.accent})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, fontWeight:700, color:C.navy,
            }}>H</div>
            <div>
              <div style={{ color:'white', fontWeight:700, fontSize:20 }}>Hawala System</div>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12 }}>نظام المحاسبة للحوالة</div>
            </div>
          </div>

          <div style={{
            background:'rgba(255,255,255,0.06)', backdropFilter:'blur(20px)',
            borderRadius:20, padding:32, border:'1px solid rgba(255,255,255,0.1)',
          }}>
            {/* Dil */}
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

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }} aria-label="Giriş formu">
              <div>
                <label htmlFor="login-email" style={{ display:'block', color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:500, marginBottom:6 }}>E-posta</label>
                <input id="login-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required style={inp} />
              </div>
              <div>
                <label htmlFor="login-password" style={{ display:'block', color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:500, marginBottom:6 }}>Şifre</label>
                <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required style={inp} />
              </div>
              <button type="submit" disabled={loading} style={{
                marginTop:4, padding:'12px', borderRadius:10, border:'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'rgba(201,168,76,0.5)' : `linear-gradient(135deg, ${C.accent}, ${C.accent})`,
                color:C.navy, fontSize:14, fontWeight:700, fontFamily:'var(--font)', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap →'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Sağ — Dekoratif */}
      <div style={{
        width:380, borderLeft:'1px solid rgba(255,255,255,0.06)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, gap:16,
      }}>
        {[
          { label:'Aktif Lokasyon', value:'5', sub:'IST · CAI · RYD · DXB · CHN' },
          { label:'Para Birimi', value:'22+', sub:'Majör ve bölgesel' },
          { label:'Dil Desteği', value:'3', sub:'TR · AR · EN' },
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
