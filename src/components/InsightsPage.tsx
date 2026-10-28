import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Camera, Download, Eye, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, UsersRound, Video, Watch } from 'lucide-react'
import { apiJson, type AccountMetrics, type IntegrationsStatus, type MetricsSyncResponse, type ProviderFilter, type ProviderId, type SocialConnection } from '../lib/api'
import type { PageId } from './Sidebar'

type Props = { onNavigate: (page: PageId) => void }
type Period = '7' | '28' | '90' | '6m' | '1y' | 'custom'
type Range = { startDate: string; endDate: string; valid: boolean }
type SessionResponse = { authenticated: boolean }
type ConnectionResponse = { connections: SocialConnection[] }

const PROVIDERS: ProviderId[] = ['instagram', 'tiktok', 'youtube']
const LABELS: Record<ProviderId, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }
const COLORS: Record<ProviderId, string> = { instagram: '#087f91', tiktok: '#153457', youtube: '#4c6d98' }
const METRICS: Record<ProviderId, Array<{ key: string; label: string; icon: typeof Eye; suffix?: string }>> = {
  instagram: [
    { key: 'views', label: 'Visualizações da conta', icon: Eye },
    { key: 'reach', label: 'Alcance', icon: UsersRound },
    { key: 'interactions', label: 'Interações', icon: Activity },
    { key: 'followers', label: 'Seguidores atuais', icon: UsersRound },
  ],
  tiktok: [
    { key: 'views', label: 'Visualizações acumuladas dos vídeos', icon: Eye },
    { key: 'interactions', label: 'Interações acumuladas dos vídeos', icon: Activity },
    { key: 'followers', label: 'Seguidores atuais', icon: UsersRound },
  ],
  youtube: [
    { key: 'views', label: 'Visualizações no intervalo', icon: Eye },
    { key: 'estimatedMinutesWatched', label: 'Minutos assistidos', icon: Watch, suffix: ' min' },
    { key: 'interactions', label: 'Interações no intervalo', icon: Activity },
    { key: 'followers', label: 'Inscritos atuais', icon: UsersRound },
    { key: 'subscribersGained', label: 'Inscritos ganhos', icon: UsersRound },
    { key: 'subscribersLost', label: 'Inscritos perdidos', icon: UsersRound },
  ],
}
const DAILY_LABELS: Record<string, string> = { views: 'Visualizações', reach: 'Alcance', interactions: 'Interações', estimatedMinutesWatched: 'Minutos assistidos' }
const PERIOD_OPTIONS: Array<{ id: Period; label: string }> = [
  { id: '7', label: '7 dias' }, { id: '28', label: '28 dias' }, { id: '90', label: '90 dias' },
  { id: '6m', label: '6 meses' }, { id: '1y', label: '1 ano' }, { id: 'custom', label: 'Personalizado' },
]
const DAY_MS = 86_400_000
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const dateFromIso = (value: string) => new Date(`${value}T00:00:00.000Z`)
const shiftDays = (value: string, amount: number) => { const date = dateFromIso(value); date.setUTCDate(date.getUTCDate() + amount); return isoDate(date) }
function shiftMonths(value: string, amount: number) {
  const current = dateFromIso(value)
  const day = current.getUTCDate()
  const first = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(day, last))
  return isoDate(first)
}
function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
function formatDateTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
function formatNumber(value?: number, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${suffix}` : '—'
}
function rangeLength(range: Pick<Range, 'startDate' | 'endDate'>) {
  return Math.floor((dateFromIso(range.endDate).getTime() - dateFromIso(range.startDate).getTime()) / DAY_MS) + 1
}
function validRange(range: Pick<Range, 'startDate' | 'endDate'>, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate)) return false
  const start = dateFromIso(range.startDate), end = dateFromIso(range.endDate)
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && isoDate(start) === range.startDate && isoDate(end) === range.endDate && range.startDate <= range.endDate && range.endDate <= today && rangeLength(range) <= 366
}
function accountLabel(account: SocialConnection | AccountMetrics['account']) {
  const provider = LABELS[account.provider]
  const identity = account.handle ? `@${account.handle}` : account.displayName
  return identity ? `${provider} · ${identity}` : `${provider} · conta autorizada`
}
function coverageLabel(item: AccountMetrics) {
  if (item.status !== 'ready') return item.error || 'Dados indisponíveis'
  const start = formatDate(item.coverage?.start), end = formatDate(item.coverage?.end)
  const text = item.account.provider === 'tiktok'
    ? `${start} — ${end} · janela de publicação; contagens vitalícias atuais`
    : item.coverage?.through
      ? `${formatDate(item.coverage.start)} — ${formatDate(item.coverage.through)} · datas retornadas`
      : `${start} — ${end} · intervalo consultado; sem cobertura diária informada`
  return `${text}${item.coverage?.partial ? ' · cobertura parcial' : ''}`
}
function comparisonLabel(current?: number, previous?: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'Comparação indisponível'
  if (previous === 0) return current === 0 ? 'Sem variação' : 'Sem base anterior'
  const pct = ((current! - previous!) / Math.abs(previous!)) * 100
  const Icon = pct < 0 ? ArrowDownRight : ArrowUpRight
  const label = `${pct > 0 ? '+' : ''}${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(pct)}%`
  return <span className={pct < 0 ? 'insights-delta insights-delta--negative' : 'insights-delta'}><Icon size={12} />{label}</span>
}
function safePermalink(provider: ProviderId, value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    const allowed = provider === 'instagram' ? ['instagram.com'] : provider === 'tiktok' ? ['tiktok.com'] : ['youtube.com', 'youtu.be']
    return url.protocol === 'https:' && allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.toString() : undefined
  } catch { return undefined }
}
function SummaryCard({ account, metric, value, comparison }: { account: string; metric: { key: string; label: string; icon: typeof Eye; suffix?: string }; value?: number; comparison?: number }) {
  const Icon = metric.icon
  return <article className="insights-kpi"><div className="insights-kpi-icon"><Icon size={16} aria-hidden="true" /></div><span className="insights-kpi-label">{metric.label}</span><div className="insights-kpi-value"><strong>{formatNumber(value, metric.suffix)}</strong>{metric.key !== 'followers' && <small>{comparisonLabel(value, comparison)}</small>}</div><span className="insights-kpi-account">{account}</span></article>
}

export function InsightsPage({ onNavigate }: Props) {
  const today = useMemo(() => isoDate(new Date()), [])
  const [period, setPeriod] = useState<Period>('28')
  const defaultRange = useMemo(() => ({ startDate: shiftDays(today, -27), endDate: today }), [today])
  const [customStart, setCustomStart] = useState(defaultRange.startDate)
  const [customEnd, setCustomEnd] = useState(defaultRange.endDate)
  const [appliedCustom, setAppliedCustom] = useState(defaultRange)
  const [platform, setPlatform] = useState<ProviderFilter>('Todas')
  const [accountId, setAccountId] = useState('all')
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationsStatus | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [response, setResponse] = useState<MetricsSyncResponse | null>(null)
  const [error, setError] = useState('')
  const [forceRevision, setForceRevision] = useState(0)
  const [chosenTrend, setChosenTrend] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const requestId = useRef(0)

  const range = useMemo<Range>(() => {
    let startDate = defaultRange.startDate, endDate = defaultRange.endDate
    if (period === '7' || period === '28' || period === '90') startDate = shiftDays(today, -Number(period) + 1)
    else if (period === '6m') startDate = shiftMonths(today, -6)
    else if (period === '1y') startDate = shiftMonths(today, -12)
    else { startDate = appliedCustom.startDate; endDate = appliedCustom.endDate }
    const candidate = { startDate, endDate }
    return { ...candidate, valid: validRange(candidate, today) }
  }, [appliedCustom, defaultRange.endDate, defaultRange.startDate, period, today])
  const periodLabel = period === 'custom' ? 'Intervalo personalizado' : PERIOD_OPTIONS.find((item) => item.id === period)?.label || 'Período selecionado'

  useEffect(() => {
    let active = true
    const checkSession = async () => {
      setInitialLoading(true); setError('')
      try {
        const [session, status] = await Promise.all([
          apiJson<SessionResponse>('/api/auth/me'),
          apiJson<IntegrationsStatus>('/api/integrations/status'),
        ])
        if (!active) return
        setAuthenticated(session.authenticated)
        setIntegrationStatus(status)
        if (session.authenticated) {
          const result = await apiJson<ConnectionResponse>('/api/connections')
          if (active) setConnections(result.connections)
        } else setConnections([])
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível consultar as conexões.')
      } finally { if (active) setInitialLoading(false) }
    }
    void checkSession()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (initialLoading || authenticated !== true) return
    const currentRequest = ++requestId.current
    setResponse(null); setError('')
    if (!range.valid) { setSyncing(false); setError('O intervalo deve ser válido, terminar até hoje e conter no máximo 366 dias.'); return }
    const matches = connections.filter((item) => (platform === 'Todas' || item.provider === platform) && (accountId === 'all' || item.id === accountId))
    if (!matches.length) { setSyncing(false); setResponse({ status: 'empty', range: { startDate: range.startDate, endDate: range.endDate }, generatedAt: new Date().toISOString(), platforms: [] }); return }
    let active = true
    setSyncing(true)
    apiJson<MetricsSyncResponse>('/api/metrics/sync', {
      method: 'POST',
      json: { startDate: range.startDate, endDate: range.endDate, platform: platform === 'Todas' ? undefined : platform, accountId: accountId === 'all' ? undefined : accountId, force: forceRevision > 0 },
    }).then((data) => {
      if (active && currentRequest === requestId.current) setResponse(data)
    }).catch((reason) => {
      if (active && currentRequest === requestId.current) setError(reason instanceof Error ? reason.message : 'Não foi possível sincronizar as métricas.')
    }).finally(() => {
      if (active && currentRequest === requestId.current) setSyncing(false)
    })
    return () => { active = false }
  }, [accountId, authenticated, connections, forceRevision, initialLoading, platform, range])

  const visibleResults = useMemo(() => (response?.platforms || []).filter((item) =>
    (platform === 'Todas' || item.account.provider === platform) && (accountId === 'all' || item.account.id === accountId)), [accountId, platform, response])
  const readyResults = visibleResults.filter((item) => item.status === 'ready')
  const availableDailyMetrics = useMemo(() => {
    if (readyResults.length !== 1) return []
    const keys = new Set(readyResults[0].daily.flatMap((point) => Object.keys(point).filter((key) => key !== 'date' && typeof point[key] === 'number' && Number.isFinite(point[key]))))
    return ['views', 'reach', 'interactions', 'estimatedMinutesWatched'].filter((key) => keys.has(key)).map((key) => ({ key, label: DAILY_LABELS[key] }))
  }, [readyResults])
  const trendMetric = availableDailyMetrics.some((item) => item.key === chosenTrend) ? chosenTrend : availableDailyMetrics[0]?.key || ''
  const chartData = useMemo(() => {
    if (!trendMetric || readyResults.length !== 1) return []
    return readyResults[0].daily.flatMap((item) => typeof item[trendMetric] === 'number' && Number.isFinite(item[trendMetric]) ? [{ date: item.date, value: item[trendMetric] as number }] : [])
  }, [readyResults, trendMetric])
  const posts = useMemo(() => visibleResults.filter((item) => item.status === 'ready').flatMap((item) => item.posts.map((post) => ({ ...post, provider: item.account.provider, accountLabel: accountLabel(item.account) }))).sort((a, b) => (b.views ?? -1) - (a.views ?? -1)), [visibleResults])
  const hasExportData = range.valid && readyResults.length > 0

  const choosePeriod = (next: Period) => {
    if (next === 'custom') {
      setCustomStart(range.startDate); setCustomEnd(range.endDate)
      setAppliedCustom({ startDate: range.startDate, endDate: range.endDate })
    }
    setPeriod(next)
  }
  const refreshNow = () => setForceRevision((value) => value + 1)
  const generateReport = async () => {
    if (!hasExportData || !response) return
    setPdfBusy(true); setError('')
    try {
      const { downloadFullInsightsReport } = await import('../lib/fullInsightsReport')
      await downloadFullInsightsReport({
        title: 'Relatório de métricas sociais',
        range: `${formatDate(range.startDate)} a ${formatDate(range.endDate)} · ${rangeLength(range)} dias`,
        reportDate: today,
        generatedAt: response.generatedAt,
        filters: { platform, account: accountId === 'all' ? 'Todas as contas correspondentes' : accountLabel(connections.find((item) => item.id === accountId) || readyResults[0].account), startDate: range.startDate, endDate: range.endDate },
        accounts: visibleResults.map((item) => ({
          provider: LABELS[item.account.provider], accountName: item.account.displayName || '', handle: item.account.handle || '', status: item.status,
          summary: item.summary, comparison: item.comparison, coverage: item.coverage, fetchedAt: item.fetchedAt,
          stale: item.stale, limitations: item.limitations, error: item.error,
        })),
        posts: posts.map((post) => ({ title: post.title || `${LABELS[post.provider]} · ${post.id}`, account: post.accountLabel, platform: LABELS[post.provider], date: post.publishedAt || '', views: post.views, interactions: post.interactions })),
        series: chartData.map((point) => ({ label: formatDate(point.date), value: point.value })),
        seriesMetric: trendMetric ? DAILY_LABELS[trendMetric] : undefined,
        notes: visibleResults.flatMap((item) => item.status === 'error' && item.error ? [`${LABELS[item.account.provider]}: ${item.error}`] : []),
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o relatório PDF.') }
    finally { setPdfBusy(false) }
  }

  return <main className="insights-page">
    <style>{`
      .insights-page{--i-ink:#172039;--i-muted:#718097;--i-line:#dce6ef;--i-card:#fff;--i-cyan:#0da4b2;--i-navy:#143353;color:var(--i-ink);max-width:1500px;margin:0 auto;padding:clamp(22px,3vw,42px) clamp(16px,3vw,42px) 55px;font-family:inherit}.insights-page *{box-sizing:border-box}.insights-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:20px}.insights-head h1{margin:8px 0 7px;font-size:clamp(26px,3vw,36px);line-height:1.1;letter-spacing:-.04em}.insights-head p{margin:0;color:var(--i-muted);font-size:12px;line-height:1.65}.insights-kicker{font-size:9px;color:#087f91;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.insights-actions{display:flex;align-items:center;gap:8px}.insights-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 13px;border:1px solid var(--i-line);border-radius:9px;background:#fff;color:#34455f;font:inherit;font-size:10px;font-weight:700;cursor:pointer}.insights-button:hover:not(:disabled){border-color:#82c6cf;background:#f5fbfc}.insights-button:focus-visible,.insights-chip:focus-visible,.insights-select:focus-visible,.insights-date:focus-visible{outline:3px solid #35c3cc;outline-offset:2px}.insights-button:disabled{opacity:.5;cursor:not-allowed}.insights-button--primary{border-color:var(--i-navy);background:var(--i-navy);color:#fff}.insights-button--primary:hover:not(:disabled){background:#205278}.insights-filters{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--i-line);border-radius:13px;background:var(--i-card);margin-bottom:12px}.insights-filter-group{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.insights-filter-label{font-size:10px;font-weight:700;color:var(--i-muted);margin-right:3px}.insights-chip{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 10px;border:1px solid transparent;border-radius:8px;color:var(--i-muted);background:transparent;font:inherit;font-size:10px;cursor:pointer}.insights-chip:hover{background:#f1f6fa}.insights-chip[aria-pressed=true]{color:#0b6173;border-color:#b9e3e7;background:#eefafb;font-weight:700}.insights-select,.insights-date{height:34px;padding:0 9px;border:1px solid var(--i-line);border-radius:8px;color:var(--i-ink);background:#fff;font:inherit;font-size:10px}.insights-custom-range{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;padding:12px 14px;border:1px solid #c9e9eb;border-radius:12px;background:#f5fcfc;margin-bottom:12px}.insights-custom-range label{display:flex;flex-direction:column;gap:5px;color:var(--i-muted);font-size:9px;font-weight:700}.insights-range-note{color:var(--i-muted);font-size:9px}.insights-feedback{display:flex;align-items:flex-start;gap:9px;margin:12px 0;padding:11px 13px;border:1px solid #bfe7e8;border-radius:10px;background:#effbfb;color:#285967;font-size:10px;line-height:1.55}.insights-feedback--error{border-color:#f0cccc;background:#fff6f6;color:#8b3636}.insights-feedback svg{flex:none;margin-top:1px}.insights-alert-link{border:0;background:transparent;color:inherit;text-decoration:underline;font:inherit;font-weight:700;cursor:pointer}.insights-disclaimer{display:flex;align-items:flex-start;gap:9px;margin:0 0 14px;padding:10px 13px;border:1px solid #bde8e7;border-radius:10px;color:#285965;background:#effafa;font-size:10px;line-height:1.55}.insights-disclaimer svg{flex:none;margin-top:1px;color:#087f91}.insights-loading,.insights-empty{padding:30px 18px;border:1px dashed var(--i-line);border-radius:13px;color:var(--i-muted);font-size:11px;line-height:1.6;text-align:center;background:#fff}.insights-loading svg{vertical-align:-3px;margin-right:6px}.insights-spinner{animation:insights-spin 1s linear infinite}@keyframes insights-spin{to{transform:rotate(360deg)}}.insights-account{margin-bottom:14px;padding:18px;border:1px solid var(--i-line);border-radius:14px;background:#fff}.insights-account-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:13px}.insights-account-title{display:flex;align-items:center;gap:9px;min-width:0}.insights-account-mark{display:grid;place-items:center;width:34px;height:34px;flex:none;border-radius:10px;background:var(--account-bg);color:#fff}.insights-account-title h2{margin:0;overflow-wrap:anywhere;font-size:13px}.insights-account-title p{margin:4px 0 0;color:var(--i-muted);font-size:9px;line-height:1.5}.insights-badge{display:inline-flex;align-items:center;gap:5px;flex:none;padding:5px 8px;border-radius:30px;background:#e9f8f2;color:#28775f;font-size:9px;font-weight:700}.insights-badge--stale{background:#fff7e9;color:#7c5b2b}.insights-badge--error{background:#fff0f0;color:#8c3c3c}.insights-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.insights-kpi{min-width:0;padding:12px;border:1px solid #e6edf3;border-radius:11px;background:#fcfdfe}.insights-kpi-icon{display:grid;place-items:center;width:27px;height:27px;margin-bottom:8px;border-radius:8px;background:#eaf7f8;color:#0b8291}.insights-kpi-label{display:block;min-height:25px;color:var(--i-muted);font-size:9px;line-height:1.4}.insights-kpi-value{display:flex;align-items:baseline;justify-content:space-between;gap:5px;margin-top:2px}.insights-kpi-value strong{font-size:19px;letter-spacing:-.035em;overflow-wrap:anywhere}.insights-kpi-value small{color:#648093;font-size:8px;text-align:right}.insights-kpi-account{display:block;margin-top:5px;color:#8290a1;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.insights-delta{display:inline-flex;align-items:center;gap:2px;color:#15745c!important;font-weight:700}.insights-delta--negative{color:#a44646!important}.insights-meta{display:flex;gap:7px 15px;flex-wrap:wrap;margin-top:12px;color:var(--i-muted);font-size:9px;line-height:1.5}.insights-limitations{margin:11px 0 0;padding:10px 12px;border-radius:9px;background:#f4f8fb;color:#4e627a;font-size:9px;line-height:1.6}.insights-limitations ul{margin:5px 0 0;padding-left:17px}.insights-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(240px,.7fr);gap:12px;margin-bottom:14px}.insights-panel{min-width:0;padding:17px;border:1px solid var(--i-line);border-radius:13px;background:#fff}.insights-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:13px}.insights-panel-heading h2{margin:0;font-size:13px;letter-spacing:-.02em}.insights-panel-heading p{margin:4px 0 0;color:var(--i-muted);font-size:9px;line-height:1.5}.insights-chart{display:block;width:100%;height:190px}.insights-chart text{font-family:inherit;fill:#7d8a9d;font-size:9px}.insights-table-wrap{overflow:auto}.insights-table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}.insights-table th{padding:9px 10px;color:#617188;background:#f3f7fa;font-size:9px;font-weight:700}.insights-table td{padding:10px;border-bottom:1px solid #edf1f5;font-size:9px}.insights-table tr:last-child td{border-bottom:0}.insights-post-title{font-weight:700;white-space:normal;min-width:160px;max-width:310px}.insights-post-meta{display:block;margin-top:3px;color:var(--i-muted);font-size:8px}.insights-platform-tag{display:inline-flex;padding:4px 7px;border-radius:6px;color:#285673;background:#edf6fa;font-size:8px}.insights-empty-inline{padding:17px;color:var(--i-muted);font-size:10px;line-height:1.55;text-align:center}.insights-footnote{margin:10px 2px 0;color:var(--i-muted);font-size:9px;line-height:1.55}.insights-footer-links{display:flex;gap:14px;margin-top:16px;font-size:9px}.insights-footer-links button{border:0;background:none;color:#126f83;text-decoration:underline;font:inherit;cursor:pointer}.insights-footer-links a{color:#126f83}@media(max-width:900px){.insights-layout{grid-template-columns:1fr}.insights-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.insights-head{align-items:flex-start;flex-direction:column}.insights-actions{width:100%}.insights-actions .insights-button{flex:1}}@media(max-width:560px){.insights-page{padding:20px 14px 38px}.insights-filters{align-items:flex-start}.insights-filter-group{width:100%}.insights-filter-label{width:100%}.insights-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.insights-kpi{padding:10px}.insights-kpi-value strong{font-size:17px}.insights-account{padding:13px}.insights-account-heading{align-items:flex-start;flex-direction:column}.insights-table{min-width:640px}.insights-custom-range label{width:100%}.insights-custom-range .insights-date{width:100%}.insights-actions{align-items:stretch;flex-direction:column}.insights-actions .insights-button{min-height:42px}.insights-panel{padding:13px}}
      @media(prefers-reduced-motion:reduce){.insights-page *, .insights-page *:before, .insights-page *:after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
    `}</style>
    <header className="insights-head"><div><span className="insights-kicker">Métricas · dados autorizados</span><h1>Desempenho das suas contas</h1><p>Números somente após consentimento. Cada rede mantém sua definição, cobertura e período de atualização.</p></div><div className="insights-actions"><button type="button" className="insights-button" onClick={refreshNow} disabled={initialLoading || syncing || authenticated !== true || !range.valid || readyResults.length === 0}><RefreshCw size={14} className={syncing ? 'insights-spinner' : ''} /> Atualizar agora</button><button type="button" className="insights-button insights-button--primary" onClick={() => void generateReport()} disabled={!hasExportData || pdfBusy}><Download size={14} />{pdfBusy ? 'Gerando PDF…' : 'Baixar relatório PDF'}</button></div></header>

    <section className="insights-filters" aria-label="Filtros de métricas">
      <div className="insights-filter-group" role="group" aria-label="Período do relatório"><span className="insights-filter-label"><CalendarDays size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Período</span>{PERIOD_OPTIONS.map((option) => <button type="button" key={option.id} className="insights-chip" aria-pressed={period === option.id} onClick={() => choosePeriod(option.id)}>{option.label}</button>)}</div>
      <div className="insights-filter-group" role="group" aria-label="Filtrar por plataforma"><label className="insights-filter-label" htmlFor="insights-platform">Plataforma</label><select id="insights-platform" className="insights-select" value={platform} onChange={(event) => { setPlatform(event.target.value as ProviderFilter); setAccountId('all') }}><option value="Todas">Todas as redes</option>{PROVIDERS.map((id) => <option value={id} key={id}>{LABELS[id]}</option>)}</select>
        {connections.filter((item) => platform === 'Todas' || item.provider === platform).length > 1 && <><label className="insights-filter-label" htmlFor="insights-account">Conta</label><select id="insights-account" className="insights-select" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="all">Todas as contas</option>{connections.filter((item) => platform === 'Todas' || item.provider === platform).map((item) => <option key={item.id} value={item.id}>{accountLabel(item)}</option>)}</select></>}
      </div>
    </section>
    {period === 'custom' && <section className="insights-custom-range" aria-label="Escolher datas do intervalo"><label>Data inicial<input className="insights-date" type="date" value={customStart} max={customEnd || today} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Data final<input className="insights-date" type="date" value={customEnd} min={customStart} max={today} onChange={(event) => setCustomEnd(event.target.value)} /></label><button type="button" className="insights-button insights-button--primary" disabled={!validRange({ startDate: customStart, endDate: customEnd }, today)} onClick={() => setAppliedCustom({ startDate: customStart, endDate: customEnd })}>Aplicar intervalo</button><span className="insights-range-note">Máximo de 366 dias; a data final não pode ultrapassar hoje.</span></section>}

    <p className="insights-disclaimer" role="note"><ShieldCheck size={15} aria-hidden="true" /><span><strong>Sem dados de demonstração.</strong> A sincronização é somente leitura. Nenhum conteúdo do criador, rascunho, arquivo de mídia ou tarefa local é enviado para as redes.</span></p>
    {error && <div className="insights-feedback insights-feedback--error" role="alert"><AlertTriangle size={15} /><span>{error} {authenticated === false && <button className="insights-alert-link" type="button" onClick={() => onNavigate('settings')}>Entrar e conectar contas</button>}</span></div>}
    {initialLoading && <div className="insights-loading" role="status"><LoaderCircle size={15} className="insights-spinner" /> Verificando sessão e contas…</div>}
    {!initialLoading && authenticated === false && <div className="insights-empty"><ShieldCheck size={18} /><br />Entre com sua conta Manus e autorize as redes para consultar métricas reais.<br /><button type="button" className="insights-button insights-button--primary" style={{ marginTop: 12 }} onClick={() => onNavigate('settings')}>Abrir Conectar contas</button></div>}
    {!initialLoading && authenticated === true && connections.length === 0 && <div className="insights-empty"><BarChart3 size={18} /><br />Nenhuma rede foi autorizada. Os indicadores aparecerão aqui depois que você conectar uma conta e o fornecedor disponibilizar dados.<br /><button type="button" className="insights-button insights-button--primary" style={{ marginTop: 12 }} onClick={() => onNavigate('settings')}>Conectar contas</button></div>}
    {!initialLoading && authenticated === true && connections.length > 0 && !range.valid && <div className="insights-feedback insights-feedback--error" role="alert">Confira as datas. O intervalo precisa terminar até hoje e conter no máximo 366 dias.</div>}
    {!initialLoading && authenticated === true && connections.length > 0 && range.valid && syncing && !response && <div className="insights-loading" role="status"><LoaderCircle size={15} className="insights-spinner" /> Sincronizando as contas selecionadas…</div>}
    {!initialLoading && authenticated === true && range.valid && !syncing && response?.status === 'empty' && <div className="insights-empty">Não há conta conectada para os filtros escolhidos. Ajuste a plataforma/conta ou <button type="button" className="insights-alert-link" onClick={() => onNavigate('settings')}>conecte uma rede</button>.</div>}
    {!initialLoading && authenticated === true && range.valid && response && visibleResults.length > 0 && <>
      {response.notice && <p className="insights-feedback" role="status"><ShieldCheck size={15} />{response.notice}</p>}
      {syncing && <p className="insights-feedback" role="status"><LoaderCircle size={14} className="insights-spinner" />Atualizando o intervalo selecionado…</p>}
      <section aria-label="Indicadores por conta">
        {visibleResults.map((item) => {
          const id = item.account.provider
          const metrics = METRICS[id]
          const color = COLORS[id]
          return <article className="insights-account" key={item.account.id}>
            <div className="insights-account-heading"><div className="insights-account-title"><span className="insights-account-mark" style={{ '--account-bg': color } as React.CSSProperties}>{id === 'instagram' ? <Camera size={16} /> : id === 'youtube' ? <ExternalLink size={16} /> : <Video size={16} />}</span><div><h2>{accountLabel(item.account)}</h2><p>{item.status === 'ready' ? `Cobertura solicitada: ${formatDate(range.startDate)} a ${formatDate(range.endDate)}` : 'A leitura da conta não foi concluída.'}</p></div></div><span className={`insights-badge${item.status === 'error' ? ' insights-badge--error' : item.stale ? ' insights-badge--stale' : ''}`}>{item.status === 'error' ? 'Falha na sincronização' : item.stale ? 'Cache · atualização recente' : 'Dados disponíveis'}</span></div>
            {item.status === 'ready' ? <>
              <div className="insights-kpis">{metrics.map((metric) => <SummaryCard key={metric.key} account={LABELS[id]} metric={metric} value={item.summary[metric.key]} comparison={item.comparison?.status === 'ready' ? item.comparison.summary?.[metric.key] : undefined} />)}</div>
              <div className="insights-meta"><span>Última consulta: {formatDateTime(item.fetchedAt)}</span><span>Período solicitado: {formatDate(range.startDate)} a {formatDate(range.endDate)}</span>{item.coverage?.through && <span>Última data efetivamente retornada: {formatDate(item.coverage.through)}</span>}{item.comparison?.status === 'ready' && item.comparison.range && <span>Comparativo: {formatDate(item.comparison.range.startDate)} a {formatDate(item.comparison.range.endDate)}</span>}{item.comparison?.status === 'unavailable' && <span>Comparativo: indisponível nesta fonte/intervalo</span>}{item.comparison?.status === 'not_applicable' && <span>Comparativo: {item.comparison.error}</span>}</div>
              {item.limitations.length > 0 && <div className="insights-limitations"><strong>Limitações informadas pela API</strong><ul>{item.limitations.map((note, index) => <li key={`${id}-${index}`}>{note}</li>)}</ul></div>}
            </> : <div className="insights-feedback insights-feedback--error" role="alert"><AlertTriangle size={15} /><span>{item.error || 'Não foi possível sincronizar esta conta.'} <button type="button" className="insights-alert-link" onClick={() => onNavigate('settings')}>Ver conexão</button></span></div>}
          </article>
        })}
      </section>

      <div className="insights-layout">
        <section className="insights-panel" aria-labelledby="insights-trend-title"><div className="insights-panel-heading"><div><h2 id="insights-trend-title">Série diária retornada pela API</h2><p>{trendMetric ? `${DAILY_LABELS[trendMetric]} · ${visibleResults.length === 1 ? LABELS[readyResults[0]?.account.provider] : 'conta selecionada'}` : 'Não agregamos tendências de contas/rede com definições distintas.'}</p></div>{availableDailyMetrics.length > 0 && <label className="insights-kicker">Métrica <select className="insights-select" value={trendMetric} onChange={(event) => setChosenTrend(event.target.value)} aria-label="Escolher métrica diária">{availableDailyMetrics.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>}</div>
          {chartData.length > 0 ? <DailyChart points={chartData} metricLabel={DAILY_LABELS[trendMetric] || ''} /> : <div className="insights-empty-inline">{readyResults.length === 1 ? 'Esta fonte não forneceu uma série diária para o intervalo e a métrica escolhidos; nenhum ponto foi estimado.' : 'Selecione uma conta específica para ver somente uma série diária compatível.'}</div>}
        </section>
        <section className="insights-panel" aria-labelledby="insights-coverage-title"><div className="insights-panel-heading"><div><h2 id="insights-coverage-title">Cobertura por fonte</h2><p>Falhas e ausências não são tratadas como zero.</p></div></div>
          {visibleResults.map((item) => <div className="insights-coverage-row" key={item.account.id}><strong>{accountLabel(item.account)}</strong><span>{coverageLabel(item)}</span></div>)}
          {!visibleResults.length && <div className="insights-empty-inline">Nenhuma fonte corresponde aos filtros.</div>}
        </section>
      </div>

      <section className="insights-panel" aria-labelledby="insights-posts-title"><div className="insights-panel-heading"><div><h2 id="insights-posts-title">Conteúdos retornados pelas APIs</h2><p>O período e a plataforma selecionados são enviados ao servidor para a consulta.</p></div><span className="insights-kicker">{posts.length} itens disponíveis</span></div>
        <div className="insights-table-wrap"><table className="insights-table"><thead><tr><th scope="col">Conteúdo</th><th scope="col">Rede/conta</th><th scope="col">Visualizações</th><th scope="col">Interações</th><th scope="col">Publicado</th></tr></thead><tbody>{posts.map((post) => { const url = safePermalink(post.provider, post.permalink); const title = post.title || `${LABELS[post.provider]} · ${post.id.slice(-10)}`; return <tr key={`${post.provider}-${post.id}`}><td><div className="insights-post-title">{url ? <a href={url} target="_blank" rel="noopener noreferrer">{title} <ExternalLink size={11} aria-hidden="true" /></a> : title}</div><span className="insights-post-meta">{post.id}</span></td><td><span className="insights-platform-tag">{post.accountLabel}</span></td><td>{formatNumber(post.views)}</td><td>{formatNumber(post.interactions)}</td><td>{formatDate(post.publishedAt)}</td></tr>})}</tbody></table>{posts.length === 0 && <div className="insights-empty-inline">A API não retornou publicações elegíveis para estes filtros. Isso não significa que a contagem seja zero.</div>}</div>
      </section>
      <p className="insights-footnote">Os campos disponíveis variam por rede. TikTok pode fornecer contagens acumuladas do vídeo, Instagram insights pode sofrer atraso e o YouTube Analytics também apresenta atraso de processamento. Consulte as limitações de cada conta acima.</p>
    </>}
    <div className="insights-footer-links"><button type="button" onClick={() => onNavigate('settings')}>Gerenciar conexões</button><a href="/privacidade">Privacidade</a><a href="/termos">Termos</a></div>
  </main>
}

function DailyChart({ points, metricLabel }: { points: Array<{ date: string; value: number }>; metricLabel: string }) {
  const width = 600, height = 180, left = 46, right = 590, top = 14, bottom = 145
  const max = Math.max(1, ...points.map((point) => point.value))
  const first = dateFromIso(points[0].date).getTime(), last = dateFromIso(points[points.length - 1].date).getTime()
  const span = Math.max(1, last - first)
  const xy = points.map((point) => ({ ...point, x: left + ((dateFromIso(point.date).getTime() - first) / span) * (right - left), y: bottom - (point.value / max) * (bottom - top) }))
  const line = xy.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  return <svg className="insights-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Série real de ${metricLabel} retornada pela API`}>
    {[0, 1, 2, 3].map((step) => { const y = top + ((bottom - top) * step) / 3; return <g key={step}><line x1={left} y1={y} x2={right} y2={y} stroke="#e5edf2" /><text x="3" y={y + 3}>{formatNumber(max * (1 - step / 3))}</text></g>})}
    {xy.length > 1 && <polyline points={line} fill="none" stroke="#0da4b2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    {xy.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="2.8" fill="#fff" stroke="#0b7183" strokeWidth="1.6"><title>{formatDate(point.date)} · {formatNumber(point.value)}</title></circle>)}
    <text x={left} y={height - 10}>{formatDate(points[0].date)}</text><text x={right} y={height - 10} textAnchor="end">{formatDate(points[points.length - 1].date)}</text>
  </svg>
}
