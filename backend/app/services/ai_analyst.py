from groq import Groq
from app.core.config import settings
from sqlalchemy.orm import Session
from app.models.transaction import Transaction
from datetime import datetime, timedelta
import json

def get_financial_summary(db: Session, company_id: str = None):
    """30 günlük anonimleştirilmiş finansal özeti hazırlar."""
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    q = db.query(Transaction).filter(
        Transaction.txn_date >= thirty_days_ago.date(),
        Transaction.status == 'completed'
    )
    if company_id is not None:
        q = q.filter(Transaction.company_id == company_id)
    txns = q.all()
    
    summary = {
        "period": "Son 30 Gün",
        "total_transactions": len(txns),
        "transaction_types": {},
        "location_performance": {},
        "total_estimated_pnl_usd": 0
    }

    for t in txns:
        summary["transaction_types"][t.txn_type.value] = summary["transaction_types"].get(t.txn_type.value, 0) + 1
        if t.pnl:
            summary["total_estimated_pnl_usd"] += float(t.pnl.net_pnl_usd or 0)
        if t.legs:
            loc_name = t.legs[0].account.location.name_tr if t.legs[0].account and t.legs[0].account.location else "Unknown"
            summary["location_performance"][loc_name] = summary["location_performance"].get(loc_name, 0) + 1
    
    return summary

def _get_groq_key(db: Session) -> str | None:
    """DB'den GROQ_API_KEY al, yoksa env'e bak."""
    try:
        from app.models.system_setting import SystemSetting
        row = db.query(SystemSetting).filter(SystemSetting.key == "GROQ_API_KEY").first()
        if row and row.value:
            return row.value
    except Exception:
        pass
    return settings.GROQ_API_KEY


def get_ai_financial_analysis(db: Session, prompt: str = None, company_id: str = None):
    """Güvenli AI Analizi (Groq)"""
    groq_key = _get_groq_key(db)
    if not groq_key:
        return "AI Analizcisi şu an aktif değil (Groq API Key eksik)."

    summary = get_financial_summary(db, company_id)
    
    try:
        client = Groq(api_key=groq_key)

        context = f"""
        Rol: Üst Düzey Finansal Stratejist ve Kurumsal Hazine Danışmanı (McKinsey/BCG Üslubu).
        Görev: Aşağıdaki 30 günlük operasyonel verileri derinlemesine analiz et ve kurum yönetimine sunulacak 'Stratejik Performans ve Risk Analizi' belgesi oluştur.
        
        HAM VERİ ÖZETİ:
        {json.dumps(summary, indent=2, ensure_ascii=False)}
        
        KULLANICI TALEBİ / ODAK NOKTASI: {prompt if prompt else "Operasyonel verimlilik ve stratejik büyüme fırsatları."}
        
        YAZIM KURALLARI VE ÜSLUP (KRİTİK):
        1. ASLA yapay zeka olduğunu belli etme. "Ben bir modelim", "Verilere göre", "Analizime göre" gibi ifadeler yerine "Mevcut tabloda", "Stratejik açıdan" gibi profesyonel ifadeler kullan.
        2. ASLA yıldız (*) veya çift yıldız (**) kullanma. Listeleme yapman gerekirse profesyonel numaralandırma (1., 1.1., a.) kullan.
        3. 'Bölüm' veya 'Kısım' gibi kelimeler kullanmadan doğrudan ana başlıklarla raporu yapılandır. Başlık formatı: '1. ANA BAŞLIK İSMİ'.
        4. Raporu şu bölümlere ayır ve bölümleri net başlıklarla (###) tanımla:
           ### 1. YÖNETİCİ ÖZETİ VE KRİTİK GÖZLEMLER
           ### 2. OPERASYONEL PERFORMANS ANALİZİ
           ### 3. BÖLGESEL VERİMLİLİK MATRİSİ
           ### 4. FİNANSAL RİSK VE KÂRLILIK DEĞERLENDİRMESİ
           ### 5. STRATEJİK ÖNERİLER
        5. Cümleler kısa, vurucu ve analitik olsun. Veriyi sadece söyleme, arkasındaki ticari mantığı açıkla.
        6. Analizi tamamen TÜRKÇE yap.
        """

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": context}],
            temperature=0.7,
            max_tokens=2048,
        )
        
        return completion.choices[0].message.content
        
    except Exception as e:
        error_msg = str(e)
        print(f"Groq Analiz hatası: {error_msg}")
        return f"Analiz servisine şu an ulaşılamıyor. Detay: {error_msg}"

def get_ai_chat_response(db: Session, message: str, history: list = None, company_id: str = None):
    """Kullanıcı ile interaktif finansal sohbet."""
    if history is None:
        history = []
    groq_key = _get_groq_key(db)
    if not groq_key:
        return "Chat servisi aktif değil."

    summary = get_financial_summary(db, company_id)
    
    try:
        client = Groq(api_key=groq_key)

        system_prompt = f"""
        Sen sistemin 'Akıllı Finansal Asistanı'sın.
        Kullanıcının finansal sorularını, sistemdeki verilere dayanarak veya genel finans bilgisiyle cevaplarsın.
        
        SİSTEM VERİLERİ (Son 30 Gün):
        {json.dumps(summary, indent=2, ensure_ascii=False)}
        
        KURALLAR (KESİN):
        1. Samimi ama profesyonel bir üslup kullan.
        2. ASLA yıldız (*) veya çift yıldız (**) kullanma. Kalın yazmak istediğin yerleri sadece büyük harfle veya numaralandırmayla belirt.
        3. Eğer kullanıcı sistemdeki verilerle ilgili soru sorarsa (Örn: 'En çok hangi şube çalışıyor?'), yukarıdaki verilere bakarak cevap ver.
        4. Genel finansal sorulara uzman görüşüyle kısa ve öz cevaplar ver.
        5. Cevapları profesyonel bir dille sun, asistan gibi davran.
        """
        
        messages = [{"role": "system", "content": system_prompt}]
        for h in history[-5:]:
            messages.append({"role": "user" if h['isUser'] else "assistant", "content": h['text']})
        
        messages.append({"role": "user", "content": message})

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.6,
            max_tokens=1024,
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"Üzgünüm, şu an cevap veremiyorum. (Hata: {str(e)})"
