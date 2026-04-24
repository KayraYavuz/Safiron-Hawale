import { useLangStore } from '../store'

const T = {
  tr: { dir:'ltr', dashboard:'Ana Sayfa', transactions:'İşlemler', counterparties:'Karşı Taraflar', accounts:'Hesaplar', rates:'Kur Tablosu', reports:'Raporlar', users:'Kullanıcılar', logout:'Çıkış Yap', newTransaction:'Yeni İşlem', save:'Kaydet', cancel:'İptal', approve:'Onayla', delete:'Sil', back:'← Geri', next:'İleri →', loading:'Yükleniyor...', noData:'Veri yok', customer:'Müşteri', supplier:'Tedarikçi', founder:'Ortak' },
  ar: { dir:'rtl', dashboard:'الرئيسية', transactions:'المعاملات', counterparties:'الأطراف', accounts:'الحسابات', rates:'جدول الأسعار', reports:'التقارير', users:'المستخدمون', logout:'تسجيل الخروج', newTransaction:'معاملة جديدة', save:'حفظ', cancel:'إلغاء', approve:'موافقة', delete:'حذف', back:'→ رجوع', next:'التالي ←', loading:'جار التحميل...', noData:'لا توجد بيانات', customer:'عميل', supplier:'مورد', founder:'شريك' },
  en: { dir:'ltr', dashboard:'Dashboard', transactions:'Transactions', counterparties:'Counterparties', accounts:'Accounts', rates:'Exchange Rates', reports:'Reports', users:'Users', logout:'Logout', newTransaction:'New Transaction', save:'Save', cancel:'Cancel', approve:'Approve', delete:'Delete', back:'← Back', next:'Next →', loading:'Loading...', noData:'No data', customer:'Customer', supplier:'Supplier', founder:'Partner' },
}

export function useLang() {
  const { lang, setLang } = useLangStore()
  const t = T[lang] || T.tr
  return { lang, setLang, t, dir: t.dir }
}
