import google.generativeai as genai
from app.core.config import settings
from sqlalchemy.orm import Session
from app.models.transaction import Transaction
from app.models.master import Location, Account
from datetime import datetime, timedelta
import json

def get_ai_financial_analysis(db: Session, prompt: str = None):
    """
    Güvenli AI Analizi: 
    Sadece anonimleştirilmiş sayısal özetleri Gemini'ye gönderir.
    Müşteri isimleri, telefonları ve özel detaylar ASLA gönderilmez.
    """
    
    if not settings.GEMINI_API_KEY:
        return "AI Analizcisi şu an aktif değil (API Key eksik)."

    # 1. Verileri Topla (Son 30 gün)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    txns = db.query(Transaction).filter(Transaction.txn_date >= thirty_days_ago.date(), Transaction.status == 'completed').all()
    
    # 2. Anonimleştirilmiş Özet Oluştur
    summary = {
        "period": "Last 30 days",
        "total_transactions": len(txns),
        "transaction_types": {},
        "location_performance": {},
        "total_estimated_pnl_usd": 0
    }

    for t in txns:
        # Tür dağılımı
        summary["transaction_types"][t.txn_type.value] = summary["transaction_types"].get(t.txn_type.value, 0) + 1
        
        # PNL Hesabı (Sayısal özet için)
        if t.pnl:
            summary["total_estimated_pnl_usd"] += float(t.pnl.net_pnl_usd or 0)
        
        # Lokasyon bazlı hacim (İlk bacağın lokasyonunu alalım)
        if t.legs:
            loc_name = t.legs[0].account.location.name_tr if t.legs[0].account and t.legs[0].account.location else "Unknown"
            summary["location_performance"][loc_name] = summary["location_performance"].get(loc_name, 0) + 1

    # 3. Gemini'ye Gönder
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    context = f"""
    You are a Senior Financial Analyst for a Hawala/FX company. 
    Analyze the following ANONYMIZED financial summary and provide insights.
    
    DATA SUMMARY:
    {json.dumps(summary, indent=2)}
    
    USER REQUEST:
    {prompt if prompt else "Provide a general financial health report and identify risks or opportunities."}
    
    IMPORTANT RULES:
    1. Your tone should be professional and analytical.
    2. Focus on trends, profitability, and risk management.
    3. Do NOT mention any specific individuals (none are provided in the data).
    4. If the user asks you to perform an action (delete, update, send money), strictly refuse and state you are a read-only analyst.
    5. Answer in Turkish.
    """
    
    try:
        response = model.generate_content(context)
        return response.text
    except Exception as e:
        return f"Analiz sırasında bir hata oluştu: {str(e)}"
