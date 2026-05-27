import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '../utils/api'
import { Card, Btn, Input, C } from '../components/UI'
import { Icon } from '../components/Icons'
import { useLang } from '../hooks/useLang'
import { useAuthStore } from '../store'
import toast from 'react-hot-toast'

// ── Integration catalogue ─────────────────────────────────────────────────────
const AI_SERVICES = [
  {
    key:         'GROQ_API_KEY',
    name:        'Safiron LLM',
    subtitle:    'Stratejik Analiz & Asistan',
    description: 'AI finansal analiz ve chat asistanı için gerekli bağlantı anahtarı.',
    docs:        null,
    icon:        '✦',
    color:       '#C9A84C',
    bg:          '#FBF7EE',
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
  const { t } = useLang()
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
      background: '#F1F5F9', color: C.text3, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {t.comingSoon}
    </span>
  )
}

function BuiltinCard({ service }) {
  const { t } = useLang()
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
          }}>{t.activeLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{service.description}</div>
      </div>
    </div>
  )
}

function ApiKeyCard({ service, setting, onSave, onClear, saving }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const { t } = useLang()
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
                {t.activeLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{service.description}</div>
        </div>
        {service.docs && (
          <a
            href={service.docs}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: C.text3, textDecoration: 'none', flexShrink: 0, marginTop: 2 }}
          >
            Docs ↗
          </a>
        )}
      </div>

      {/* Key display / edit */}
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F8FAFC',
            border: `1px solid ${C.border}`, fontFamily: 'var(--mono)', fontSize: 12, color: C.text2,
          }}>
            {isSet ? setting.value_masked : t.apiKeyNotSet}
          </div>
          <Btn
            variant="ghost"
            style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }}
            onClick={() => { setEditing(true); setVal('') }}
          >
            <Icon name="key" size={13} color={C.navy} />
            {isSet ? t.update : t.apiKeyAdd}
          </Btn>
          {isSet && (
            <Btn
              variant="danger"
              style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
              onClick={() => { if (window.confirm(`${service.name} — ${t.confirmDeleteApiKey}`)) onClear(service.key) }}
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
            {saving ? '...' : t.save}
          </Btn>
          <Btn
            variant="ghost"
            style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
            onClick={() => setEditing(false)}
          >
            {t.cancel}
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
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isAdmin = ['admin', 'super_admin'].includes(user?.role)

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.list().then(r => r.data),
    enabled:  isAdmin,
  })

  const saveMut = useMutation({
    mutationFn: ({ key, value }) => settingsApi.update(key, value),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success(t.apiKeySaved) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const clearMut = useMutation({
    mutationFn: (key) => settingsApi.clear(key),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success(t.apiKeyDeleted) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })

  const getSettingFor = (key) => settings.find(s => s.key === key)

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

      {!isAdmin && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: '#FFF3CD', border: '1px solid #F0C040', color: '#856404', fontSize: 13 }}>
          {t.adminOnlyApiKey}
        </div>
      )}

      {/* ── AI Services ── */}
      <div>
        <SectionHeader icon="sparkles" label={t.aiServices || 'Yapay Zeka Servisleri'} count={AI_SERVICES.length} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {AI_SERVICES.map(svc =>
            svc.comingSoon ? (
              <ComingSoonCard key={svc.key} name={svc.name} description={svc.description} icon={svc.icon} />
            ) : isAdmin ? (
              <ApiKeyCard
                key={svc.key}
                service={svc}
                setting={getSettingFor(svc.key)}
                onSave={(key, value) => saveMut.mutate({ key, value })}
                onClear={(key) => clearMut.mutate(key)}
                saving={saveMut.isPending || clearMut.isPending}
              />
            ) : (
              <BuiltinCard key={svc.key} service={svc} />
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
        {t.apiKeySecurityNote}
      </div>
    </div>
  )
}
