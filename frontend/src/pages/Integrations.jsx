import { useState } from 'react'
import { Card, Btn, Input, C } from '../components/UI'
import { Icon } from '../components/Icons'
import { useLang } from '../hooks/useLang'

// ── Integration catalogue ─────────────────────────────────────────────────────
const AI_SERVICES = [
  {
    key:        'SAFIRON_LLM',
    name:       'Safiron LLM',
    description: 'AI analiz ve finansal chat asistanı.',
    icon:       '✦',
    color:      '#C9A84C',
    bg:         '#FBF7EE',
    builtin:    true,
  },
  {
    key:        'OPENAI_API_KEY',
    name:       'OpenAI',
    description: 'Gelişmiş dil modeli entegrasyonu.',
    icon:       '🧠',
    color:      '#10A37F',
    bg:         '#EDFAF5',
    comingSoon: true,
  },
  {
    key:        'GEMINI_API_KEY',
    name:       'Google Gemini',
    description: 'Google\'ın çok modlu yapay zeka modeli.',
    icon:       '✦',
    color:      '#4285F4',
    bg:         '#EEF3FF',
    comingSoon: true,
  },
  {
    key:        'ANTHROPIC_API_KEY',
    name:       'Anthropic Claude',
    description: 'Analitik ve uzun bağlam işleme için.',
    icon:       '◆',
    color:      '#D97706',
    bg:         '#FFFBEB',
    comingSoon: true,
  },
]

const AGENTS = [
  {
    name:        'İşlem Ajanı',
    description: 'Yeni işlemleri otomatik sınıflandırır ve uyarı verir.',
    icon:        'bot',
    comingSoon:  true,
  },
  {
    name:        'Risk Ajanı',
    description: 'Anormal harcama ve kur dalgalanmalarını tespit eder.',
    icon:        'zap',
    comingSoon:  true,
  },
  {
    name:        'Raporlama Ajanı',
    description: 'Haftalık/aylık raporları otomatik oluşturup e-posta atar.',
    icon:        'reports',
    comingSoon:  true,
  },
]

const NOTIFICATIONS = [
  {
    key:         'TELEGRAM_BOT_TOKEN',
    name:        'Telegram Bot',
    description: 'İşlem ve uyarı bildirimleri için.',
    icon:        '✈️',
    color:       '#229ED9',
    bg:          '#EFF8FF',
    comingSoon:  true,
  },
  {
    key:         'SLACK_WEBHOOK',
    name:        'Slack',
    description: 'Ekip bildirimleri ve raporlar.',
    icon:        '#',
    color:       '#4A154B',
    bg:          '#F9F0FF',
    comingSoon:  true,
  },
  {
    key:         'WEBHOOK_URL',
    name:        'Webhook',
    description: 'Özel sistemlere HTTP POST bildirimi.',
    icon:        '🔗',
    color:       '#0D1B2E',
    bg:          '#F4F6FA',
    comingSoon:  true,
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      <Icon name={icon} size={15} color={C.text3} />
      <span style={{ fontSize: 12, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: C.text3, background: '#F1F5F9', padding: '1px 7px', borderRadius: 100 }}>
          {count}
        </span>
      )}
    </div>
  )
}

function ComingSoonBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
      background: '#F1F5F9', color: C.text3, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      Yakında
    </span>
  )
}

function BuiltinCard({ service }) {
  return (
    <div style={{
      border: '1.5px solid #D1FAE5', borderRadius: 12, padding: 18,
      background: '#F0FDF4', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11, flexShrink: 0,
        background: service.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 20,
        border: `1.5px solid rgba(201,168,76,0.25)`,
      }}>
        {service.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: C.navy }}>{service.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
            background: '#D1FAE5', color: '#065F46', letterSpacing: '0.05em',
          }}>AKTİF</span>
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{service.description}</div>
      </div>
    </div>
  )
}

function ApiKeyCard({ service, setting, onSave, onClear, saving }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const isSet = setting?.is_set

  return (
    <div style={{
      border: `1.5px solid ${isSet ? '#D1FAE5' : C.border}`,
      borderRadius: 12, padding: 18,
      background: isSet ? '#F0FDF4' : 'white',
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: service.bg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18,
        }}>
          {service.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{service.name}</span>
            <span style={{ fontSize: 11, color: C.text3 }}>{service.subtitle}</span>
            {isSet && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: '#D1FAE5', color: '#065F46', letterSpacing: '0.04em',
              }}>
                AKTİF
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{service.description}</div>
        </div>
        <a
          href={service.docs}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: C.text3, textDecoration: 'none', flexShrink: 0, marginTop: 2 }}
        >
          Docs ↗
        </a>
      </div>

      {/* Key display / edit */}
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F8FAFC',
            border: `1px solid ${C.border}`, fontFamily: 'var(--mono)', fontSize: 12, color: C.text2,
          }}>
            {isSet ? setting.value_masked : '— API key girilmemiş —'}
          </div>
          <Btn
            variant="ghost"
            style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }}
            onClick={() => { setEditing(true); setVal('') }}
          >
            <Icon name="key" size={13} color={C.navy} />
            {isSet ? 'Güncelle' : 'Ekle'}
          </Btn>
          {isSet && (
            <Btn
              variant="danger"
              style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
              onClick={() => { if (window.confirm(`${service.name} API key silinsin mi?`)) onClear(service.key) }}
            >
              <Icon name="trash" size={13} color="white" />
            </Btn>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <Input
            type="password"
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder={`${service.name} API key...`}
            style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12 }}
            autoFocus
          />
          <Btn
            style={{ fontSize: 12, padding: '7px 16px', flexShrink: 0 }}
            onClick={() => { onSave(service.key, val); setEditing(false) }}
            disabled={!val || saving}
          >
            {saving ? '...' : 'Kaydet'}
          </Btn>
          <Btn
            variant="ghost"
            style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
            onClick={() => setEditing(false)}
          >
            İptal
          </Btn>
        </div>
      )}
    </div>
  )
}

function ComingSoonCard({ name, description, icon, isIconName = false }) {
  return (
    <div style={{
      border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: 18,
      background: '#FAFBFC', display: 'flex', gap: 12, alignItems: 'flex-start',
      opacity: 0.75,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isIconName ? 14 : 18, flexShrink: 0,
      }}>
        {isIconName
          ? <Icon name={icon} size={18} color={C.text3} />
          : icon
        }
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: C.text2 }}>{name}</span>
          <ComingSoonBadge />
        </div>
        <div style={{ fontSize: 12, color: C.text3 }}>{description}</div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Integrations() {
  const { t } = useLang()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 860 }}>

      {/* Page intro */}
      <div style={{
        padding: '16px 20px', borderRadius: 12,
        background: 'linear-gradient(135deg, #0D1B2E 0%, #1A2E48 100%)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'rgba(201,168,76,0.15)',
          border: '1px solid rgba(201,168,76,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="plug" size={20} color="#C9A84C" />
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
            {t.integrations || 'Entegrasyonlar'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
            {t.integrationsDesc || 'API bağlantılarını ve yapay zeka servislerini buradan yönet.'}
          </div>
        </div>
      </div>

      {/* ── AI Services ── */}
      <div>
        <SectionHeader icon="sparkles" label={t.aiServices || 'Yapay Zeka Servisleri'} count={AI_SERVICES.length} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {AI_SERVICES.map(svc =>
            svc.builtin ? (
              <BuiltinCard key={svc.key} service={svc} />
            ) : (
              <ComingSoonCard key={svc.key} name={svc.name} description={svc.description} icon={svc.icon} />
            )
          )}
        </div>
      </div>

      {/* ── Agents ── */}
      <div>
        <SectionHeader icon="bot" label={t.agents || 'Ajan Bağlantıları'} count={AGENTS.length} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {AGENTS.map(a => (
            <ComingSoonCard key={a.name} name={a.name} description={a.description} icon={a.icon} isIconName />
          ))}
        </div>
      </div>

      {/* ── Notifications ── */}
      <div>
        <SectionHeader icon="zap" label={t.notificationChannels || 'Bildirim Kanalları'} count={NOTIFICATIONS.length} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {NOTIFICATIONS.map(n => (
            <ComingSoonCard key={n.key} name={n.name} description={n.description} icon={n.icon} />
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div style={{
        padding: '12px 16px', borderRadius: 8,
        background: '#F8FAFC', border: `1px solid ${C.border}`,
        fontSize: 12, color: C.text3, lineHeight: 1.6,
      }}>
        API key'ler şifrelenmiş olarak veritabanında saklanır. Hiçbir zaman log dosyalarına yazılmaz.
        Yeni entegrasyonlar için geliştirici ekibiyle iletişime geçin.
      </div>
    </div>
  )
}
