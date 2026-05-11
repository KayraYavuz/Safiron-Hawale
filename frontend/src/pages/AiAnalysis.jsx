import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '../utils/api'
import { Card, Info, Btn, C, Badge, Table, Th, Td, TrHover, Input } from '../components/UI'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'

// ── Executive Renderer Helper ────────────────────────────────────────────────
function AnalysisContent({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="analysis-render" style={{ color: C.text1, fontSize: '15.5px', lineHeight: '1.8', fontFamily: 'var(--font)' }}>
      {lines.map((line, i) => {
        // Section Headings (1., 2., etc.)
        if (line.startsWith('### ')) {
          const title = line.replace('### ', '')
          return (
            <div key={i} style={{ marginTop: 35, marginBottom: 15 }}>
              <h2 style={{ 
                color: C.navy, margin: 0, fontSize: '20px', fontWeight: 800, 
                borderBottom: `2px solid ${C.accent}`, paddingBottom: 8, display: 'block' 
              }}>
                {title}
              </h2>
            </div>
          )
        }

        // Professional Numbering (1.1, a., etc.)
        const isNumbered = /^\s*([0-9]+\.|[a-z]\.)\s+/.test(line)
        if (isNumbered) {
          return (
            <div key={i} style={{ 
              display: 'flex', gap: 12, marginBottom: 10, padding: '12px 16px', 
              background: 'white', borderRadius: '8px', borderLeft: `4px solid ${C.accent}`,
              boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
            }}>
              <span style={{ color: C.navy, fontWeight: 700 }}>{line.match(/^\s*([0-9]+\.|[a-z]\.)/)[0]}</span>
              <span style={{ fontWeight: 500 }}>{line.replace(/^\s*([0-9]+\.|[a-z]\.)\s+/, '')}</span>
            </div>
          )
        }

        // Empty line
        if (!line.trim()) return <div key={i} style={{ height: 15 }} />

        // Normal paragraph - detect if it looks like a sub-heading or emphasis
        return (
          <p key={i} style={{ 
            marginBottom: 12, color: line.length < 50 && line.endsWith(':') ? C.navy : C.text2,
            fontWeight: line.length < 50 && line.endsWith(':') ? 700 : 400,
            fontSize: line.length < 50 && line.endsWith(':') ? '16px' : '15.5px'
          }}>
            {line}
          </p>
        )
      })}
    </div>
  )
}

// ── Export Helpers ───────────────────────────────────────────────────────────
function exportAnalysisPDF(title, content, t) {
  const { jsPDF } = window.jspdf ?? {}
  if (!jsPDF) { toast.error(t.pdfLibError); return }
  
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 20
  const maxW = pageW - (margin * 2)
  
  // Header
  doc.setFillColor(13, 27, 46)
  doc.rect(0, 0, pageW, 40, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text("STRATEJIK FINANSAL RAPOR", margin, 20)
  
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Tarih: ${new Date().toLocaleString('tr-TR')}`, margin, 30)
  
  // Title
  doc.setTextColor(13, 27, 46)
  doc.setFontSize(15); doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), margin, 55)
  doc.setDrawColor(201, 168, 76); doc.setLineWidth(1)
  doc.line(margin, 58, margin + 50, 58)

  // Content
  doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
  
  const cleanContent = content.replace(/[#*]/g, '')
  const lines = doc.splitTextToSize(cleanContent, maxW)
  
  let y = 70
  lines.forEach(line => {
    if (y > pageH - 25) {
      doc.addPage()
      y = 25
    }
    doc.text(line, margin, y)
    y += 8
  })
  
  // Footer
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(150)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageW / 2, pageH - 10, { align: 'center' })
  }
  
  doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

function exportAnalysisExcel(title, content, t) {
  const XLSX = window.XLSX
  if (!XLSX) { toast.error(t.excelLibError); return }
  const rows = [
    ["STRATEJİK FİNANSAL RAPOR"],
    ["Rapor Başlığı", title],
    ["Tarih", new Date().toLocaleString('tr-TR')],
    [""],
    ["BÖLÜM VE ANALİZ İÇERİĞİ"],
    ...content.split('\n').filter(l => l.trim()).map(l => [l.replace(/[#*]/g, '').trim()])
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Analiz")
  XLSX.writeFile(wb, `${title.replace(/\s+/g, '-').toLowerCase()}.xlsx`)
}

export default function AiAnalysis() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('new')
  const [reportTitle, setReportTitle] = useState('')

  const { data: aiData, refetch: refetchAI, isFetching: isAiLoading } = useQuery({
    queryKey: ['aiAnalysis'],
    queryFn: () => reportsApi.aiAnalysis().then(r => r.data),
    enabled: false, retry: false
  })

  useEffect(() => {
    if (aiData?.analysis && !reportTitle) {
      setReportTitle(`Stratejik Analiz - ${new Date().toLocaleDateString('tr-TR')}`)
    }
  }, [aiData])

  const { data: savedReports = [] } = useQuery({
    queryKey: ['savedReports'],
    queryFn: () => reportsApi.listSavedReports().then(r => r.data),
    enabled: activeTab === 'saved'
  })

  const saveMutation = useMutation({
    mutationFn: (data) => reportsApi.createSavedReport(data),
    onSuccess: () => { toast.success("Rapor arşive eklendi"); qc.invalidateQueries({ queryKey: ['savedReports'] }) }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => reportsApi.deleteSavedReport(id),
    onSuccess: () => { toast.success("Rapor silindi"); qc.invalidateQueries({ queryKey: ['savedReports'] }) }
  })

  const favMutation = useMutation({
    mutationFn: (id) => reportsApi.toggleFavoriteReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savedReports'] })
  })

  const [chatMessages, setChatMessages] = useState([
    { text: "Sayın Yönetici, Akıllı Finansal Asistanınız olarak hizmetinizdeyim. Kurumunuzun son 30 günlük verilerini analiz edebilir veya stratejik finansal sorularınızı yanıtlayabilirim.", isUser: false }
  ])
  const [chatInput, setChatInput] = useState('')
  const chatScrollRef = useRef(null)

  const chatMutation = useMutation({
    mutationFn: (msg) => reportsApi.aiChat({ message: msg, history: chatMessages }),
    onSuccess: (res) => setChatMessages(prev => [...prev, { text: res.data.response, isUser: false }]),
    onError: () => toast.error("Bağlantı hatası.")
  })

  const handleSendMessage = (e) => {
    e?.preventDefault()
    if (!chatInput.trim() || chatMutation.isPending) return
    const msg = chatInput
    setChatMessages(prev => [...prev, { text: msg, isUser: true }])
    setChatInput('')
    chatMutation.mutate(msg)
  }

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight }, [chatMessages])

  const quickQuestions = [
    "Operasyonel kârlılık trendimiz nasıl?",
    "En verimli çalışan şube hangisi?",
    "Risk yönetimi için hangi alanlara odaklanmalıyız?",
    "Hacim ve kâr dengesi ideal mi?"
  ]

  const handleStartAI = async () => {
    toast.loading("Veriler işleniyor...", { id: 'ai-load' })
    try {
      const res = await refetchAI()
      if (res.data?.analysis) toast.success("Analiz tamamlandı", { id: 'ai-load' })
      else toast.error("Veri alınamadı", { id: 'ai-load' })
    } catch (err) { toast.error("Hata: " + (err.response?.data?.detail || err.message), { id: 'ai-load' }) }
  }

  const [selectedSaved, setSelectedSaved] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {[
          { k: 'new', l: 'Yeni Analiz' },
          { k: 'chat', l: 'Asistan ile Sohbet' },
          { k: 'saved', l: 'Analiz Arşivi' }
        ].map(tab => (
          <button key={tab.k} onClick={() => setActiveTab(tab.k)} style={{ 
            padding: '12px 24px', cursor: 'pointer', border: 'none', background: 'none', fontSize: '13.5px', fontWeight: 600,
            color: activeTab === tab.k ? C.purple : C.text3,
            borderBottom: activeTab === tab.k ? `2px solid ${C.purple}` : 'none',
            transition: 'all 0.2s'
          }}>
            {tab.l}
          </button>
        ))}
      </div>

      {activeTab === 'new' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 14, 
                background: `linear-gradient(135deg, ${C.navy}, ${C.purple})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 5px 15px rgba(13,27,46,0.15)'
              }}>
                <Icon name="sparkles" size={24} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: C.navy, margin: 0 }}>Stratejik Finansal Değerlendirme</h1>
                <p style={{ fontSize: '12.5px', color: C.text3, margin: '3px 0 0' }}>Son 30 günlük veriler temel alınmaktadır</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {aiData?.analysis && (
                <>
                  <Btn variant="subtle" onClick={() => exportAnalysisPDF(reportTitle, aiData.analysis, t)} style={{ borderRadius: 8 }}>
                    <Icon name="reports" size={16} /> PDF
                  </Btn>
                  <Btn variant="subtle" onClick={() => exportAnalysisExcel(reportTitle, aiData.analysis, t)} style={{ color: C.green, border: `1px solid ${C.green}33`, borderRadius: 8 }}>
                    📊 Excel
                  </Btn>
                  <Btn variant="ghost" onClick={() => saveMutation.mutate({ title: reportTitle, content: aiData.analysis })} disabled={saveMutation.isPending} style={{ borderRadius: 8 }}>
                    <Icon name="check" size={16} /> Kaydet
                  </Btn>
                </>
              )}
              <Btn onClick={handleStartAI} disabled={isAiLoading} style={{ 
                  background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`, 
                  padding: '12px 28px', fontSize: '14px', fontWeight: 700,
                  boxShadow: '0 6px 18px rgba(107,70,193,0.3)', border: 'none', color: 'white', borderRadius: 10
                }}>
                <Icon name="refresh" size={18} color="white" style={{ marginRight: 8 }} />
                {isAiLoading ? "Analiz Ediliyor..." : "Yeni Analiz Başlat"}
              </Btn>
            </div>
          </div>

          {aiData?.analysis && (
            <div style={{ maxWidth: 450, background: 'white', padding: '12px 16px', borderRadius: 10, border: `1px solid ${C.border}`, boxShadow: C.shSm }}>
               <Input label="Rapor Başlığı" value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="İsim belirleyin..." />
            </div>
          )}

          <Card style={{ border: `1px solid ${C.border}`, boxShadow: C.shMd, borderRadius: 12 }}>
            <div style={{ padding: '40px 50px', minHeight: 450, background: 'linear-gradient(to bottom, #ffffff, #fcfdfe)' }}>
              {isAiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, padding: '120px 0' }}>
                  <div className="spinner-ai" />
                  <div style={{ color: C.navy, fontSize: '16px', fontWeight: 600 }}>Stratejik Analiz Hazırlanıyor</div>
                  <div style={{ color: C.text3, fontSize: '14px', textAlign: 'center', maxWidth: 300 }}>Verileriniz derinlemesine inceleniyor ve uzman yorumuyla harmanlanıyor...</div>
                </div>
              ) : aiData?.analysis ? (
                <AnalysisContent text={aiData.analysis} />
              ) : (
                <div style={{ textAlign: 'center', color: C.text4, padding: '100px 0' }}>
                  <div style={{ 
                    width: 72, height: 72, borderRadius: '50%', background: C.surface3, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' 
                  }}>
                    <Icon name="sparkles" size={36} color={C.text4} />
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 600, color: C.text3, marginBottom: 10 }}>Henüz bir analiz oluşturulmadı</div>
                  <div style={{ fontSize: '14.5px' }}>Yeni bir stratejik değerlendirme için yukarıdaki butonu kullanın.</div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {activeTab === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, height: 'calc(100vh - 280px)', minHeight: 550 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 12 }}>
            <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: 25, display: 'flex', flexDirection: 'column', gap: 20, background: '#f8fafc' }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ 
                  alignSelf: m.isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.isUser ? C.navy : 'white',
                  color: m.isUser ? 'white' : C.text1,
                  padding: '14px 20px',
                  borderRadius: m.isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  boxShadow: C.shSm,
                  fontSize: '14.5px', border: m.isUser ? 'none' : `1px solid ${C.border}`
                }}>
                  <AnalysisContent text={m.text} />
                </div>
              ))}
              {chatMutation.isPending && (
                <div style={{ alignSelf: 'flex-start', padding: '14px 20px', background: 'white', borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <div className="typing-dots"><span>.</span><span>.</span><span>.</span></div>
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 12, background: 'white' }}>
              <Input placeholder="Finansal bir analiz veya soru sorun..." value={chatInput} onChange={e => setChatInput(e.target.value)} style={{ borderRadius: 24, padding: '12px 20px', fontSize: '14.5px' }} />
              <Btn type="submit" disabled={chatMutation.isPending} style={{ borderRadius: '50%', width: 46, height: 46, padding: 0, justifyContent: 'center' }}>
                <Icon name="arrowRight" size={20} color="white" />
              </Btn>
            </form>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: C.navy, marginLeft: 5, letterSpacing: '0.05em' }}>STRATEJİK SORGULAR</div>
            {quickQuestions.map((q, i) => (
              <button key={i} onClick={() => setChatInput(q)} style={{ 
                  textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${C.border}`, background: 'white',
                  fontSize: '13px', color: C.text2, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font)', fontWeight: 500
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = C.shSm }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {q}
              </button>
            ))}
            <Info type="info" style={{ marginTop: 'auto', borderRadius: 12 }}>
              Akıllı Asistan, son 30 günlük operasyonel verilerinizle senkronize çalışır.
            </Info>
          </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedSaved ? '380px 1fr' : '1fr', gap: 24 }}>
          <Card style={{ borderRadius: 12 }}>
            <Table>
              <thead><tr><Th>Analiz Başlığı</Th><Th>Tarih</Th><Th right>Yönet</Th></tr></thead>
              <tbody>
                {savedReports.map(r => (
                  <TrHover key={r.id} onClick={() => setSelectedSaved(r)} style={{ background: selectedSaved?.id === r.id ? C.surface3 : 'none' }}>
                    <Td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={(e) => { e.stopPropagation(); favMutation.mutate(r.id) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: r.is_favorite ? C.accent : C.text4, fontSize: '18px' }}>★</button>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.title}</span>
                    </div></Td>
                    <Td style={{ fontSize: '12px', color: C.text3 }}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</Td>
                    <Td right><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); exportAnalysisPDF(r.title, r.content, t) }}><Icon name="reports" size={14} /></Btn>
                        <Btn variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); if(confirm('Bu analiz silinsin mi?')) deleteMutation.mutate(r.id) }}><Icon name="trash" size={14} /></Btn>
                    </div></Td>
                  </TrHover>
                ))}
              </tbody>
            </Table>
          </Card>

          {selectedSaved && (
            <Card style={{ boxShadow: C.shLg, borderRadius: 12 }}>
              <div style={{ padding: '24px 30px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface2 }}>
                <h3 style={{ margin: 0, color: C.navy, fontWeight: 800 }}>{selectedSaved.title}</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn variant="subtle" size="sm" onClick={() => exportAnalysisPDF(selectedSaved.title, selectedSaved.content, t)}>PDF</Btn>
                  <Btn variant="subtle" size="sm" onClick={() => exportAnalysisExcel(selectedSaved.title, selectedSaved.content, t)}>EXCEL</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setSelectedSaved(null)}>KAPAT</Btn>
                </div>
              </div>
              <div style={{ padding: '40px 50px', background: '#fff' }}>
                <AnalysisContent text={selectedSaved.content} />
              </div>
            </Card>
          )}
        </div>
      )}

      <Info type="info">
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: '20px' }}>🔐</span>
          <div>
            <strong style={{ display: 'block', marginBottom: 3, color: C.navy }}>Üst Düzey Veri Güvenliği</strong>
            <span style={{ fontSize: '13px', opacity: 0.85 }}>Raporlarınız tamamen anonim verilerle üretilir; müşteri isimleri veya özel bilgiler asla sisteme dışına çıkmaz.</span>
          </div>
        </div>
      </Info>

      <style>{`
        @keyframes ai-pulse {
          0% { transform: scale(1); opacity: 0.7; box-shadow: 0 0 0 0 rgba(107,70,193,0.3); }
          50% { transform: scale(1.08); opacity: 1; box-shadow: 0 0 0 20px rgba(107,70,193,0); }
          100% { transform: scale(1); opacity: 0.7; box-shadow: 0 0 0 0 rgba(107,70,193,0); }
        }
        .spinner-ai { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, ${C.navy}, ${C.purple}); animation: ai-pulse 2.2s infinite ease-in-out; }
        .typing-dots span { animation: typing 1s infinite; font-size: 26px; color: ${C.text3}; margin: 0 1px; }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .analysis-render p { margin: 0 0 1.2em 0; }
        .analysis-render h2 { letter-spacing: -0.02em; }
      `}</style>
    </div>
  )
}
