import { useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Download, Eye, Heart, Camera, Users, Play, Video } from 'lucide-react'

type Platform = 'Instagram' | 'TikTok' | 'YouTube'
type Post = { title: string; platform: Platform; views: number; interactions: number; date: string }
type PeriodPreset = '7' | '28' | '90' | '6m' | '1y' | 'custom'
const localISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDays = (iso: string, amount: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + amount); return localISO(d) }
const shiftMonths = (iso: string, amount: number) => { const [year, month, day] = iso.split('-').map(Number); const target = new Date(year, month - 1 + amount, 1); const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate(); target.setDate(Math.min(day, lastDay)); return localISO(target) }
const displayDate = (iso: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '—'

type FlowMetric = 'views' | 'reach' | 'interactions'
type DemoPlatform = {
  views: number
  reach: number
  interactions: number
  followers: number
  growth: Record<FlowMetric, number>
  followerGrowth: number
  color: string
}
type MetricTotals = Pick<DemoPlatform, 'views' | 'reach' | 'interactions' | 'followers'>
const platformData: Record<Platform, DemoPlatform> = {
  Instagram: { views: 24800, reach: 15300, interactions: 1840, followers: 6240, growth: { views: .0015, reach: .0012, interactions: .0017 }, followerGrowth: .0008, color: '#171f8a' },
  TikTok: { views: 37100, reach: 26800, interactions: 3260, followers: 4830, growth: { views: .0028, reach: .0024, interactions: .0030 }, followerGrowth: .0012, color: '#11cfe0' },
  YouTube: { views: 18900, reach: 12800, interactions: 970, followers: 8920, growth: { views: .0010, reach: .0009, interactions: .0014 }, followerGrowth: .0007, color: '#8ba2c5' },
}
const allPosts: Post[] = [
  { title: 'Bastidores: um dia criando', platform: 'TikTok', views: 12800, interactions: 1240, date: '2026-10-18' },
  { title: '3 ideias para sua próxima semana', platform: 'Instagram', views: 9400, interactions: 860, date: '2026-10-16' },
  { title: 'Como montamos este cenário', platform: 'YouTube', views: 7200, interactions: 490, date: '2026-10-13' },
  { title: 'Antes e depois: nosso processo', platform: 'Instagram', views: 6800, interactions: 610, date: '2026-10-10' },
]
const chartValues = [28, 40, 35, 52, 46, 62, 55, 73, 66, 84, 76, 95]
const compact = (n: number) => n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n)
const format = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const utcDay = (iso: string) => { const [year, month, day] = iso.split('-').map(Number); return Date.UTC(year, month - 1, day) / 86400000 }
const daysBetween = (start: string, end: string) => Math.round(utcDay(end) - utcDay(start))
const emptyTotals = (): MetricTotals => ({ views: 0, reach: 0, interactions: 0, followers: 0 })
const aggregateMetrics = (channels: readonly DemoPlatform[], start: string, end: string, today: string): MetricTotals => {
  if (!start || !end || start > end) return emptyTotals()
  const days = daysBetween(start, end) + 1
  const averageAge = (daysBetween(start, today) + daysBetween(end, today)) / 2
  const baselineAge = 13.5 // o fixture-base representa os 28 dias recentes
  return channels.reduce((sum, item) => {
    const flow = (key: FlowMetric) => Math.round(item[key] * days / 28 * Math.max(.35, 1 + (baselineAge - averageAge) * item.growth[key]))
    const ageAtEnd = Math.max(0, daysBetween(end, today))
    return {
      views: sum.views + flow('views'),
      reach: sum.reach + flow('reach'),
      interactions: sum.interactions + flow('interactions'),
      followers: sum.followers + Math.round(item.followers * Math.max(.35, 1 - ageAtEnd * item.followerGrowth)),
    }
  }, emptyTotals())
}
const percentChange = (current: number, previous: number) => {
  if (previous <= 0) return '—'
  const change = ((current - previous) / previous) * 100
  const rounded = Math.abs(change) < .05 ? 0 : change
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function InsightsPage() {
  const today = localISO(new Date())
  const [period, setPeriod] = useState<PeriodPreset>('28')
  const [customStart, setCustomStart] = useState(() => shiftDays(localISO(new Date()), -27))
  const [customEnd, setCustomEnd] = useState(() => localISO(new Date()))
  const [platform, setPlatform] = useState<'Todas' | Platform>('Todas')
  const range = useMemo(() => {
    const end = period === 'custom' ? customEnd : today
    const start = period === 'custom' ? customStart : period === '7' ? shiftDays(end, -6) : period === '28' ? shiftDays(end, -27) : period === '90' ? shiftDays(end, -89) : period === '6m' ? shiftMonths(end, -6) : shiftMonths(end, -12)
    const valid = Boolean(start && end && start <= end)
    const count = valid ? Math.max(1, daysBetween(start, end) + 1) : 1
    const label = period === 'custom' ? `De ${displayDate(start)} a ${displayDate(end)}` : period === '6m' ? 'Últimos 6 meses' : period === '1y' ? 'Último ano' : `Últimos ${period} dias`
    return { start, end, valid, days: count, label }
  }, [period, customStart, customEnd, today])
  const days = range.days
  const periodLabel = range.label
  const selected = useMemo(() => platform === 'Todas' ? Object.values(platformData) : [platformData[platform]], [platform])
  const totals = useMemo(() => range.valid ? aggregateMetrics(selected, range.start, range.end, today) : emptyTotals(), [range.valid, range.start, range.end, selected, today])
  const previousEnd = range.valid ? shiftDays(range.start, -1) : ''
  const previousStart = range.valid ? shiftDays(previousEnd, -(days - 1)) : ''
  const previousTotals = useMemo(() => range.valid ? aggregateMetrics(selected, previousStart, previousEnd, today) : null, [range.valid, previousStart, previousEnd, selected, today])
  const metricChanges = {
    views: previousTotals ? percentChange(totals.views, previousTotals.views) : '—',
    reach: previousTotals ? percentChange(totals.reach, previousTotals.reach) : '—',
    interactions: previousTotals ? percentChange(totals.interactions, previousTotals.interactions) : '—',
    followers: previousTotals ? percentChange(totals.followers, previousTotals.followers) : '—',
  }
  const metrics = [
    { label: 'Visualizações', value: compact(totals.views), icon: Eye, change: metricChanges.views, color: 'cyan' },
    { label: 'Alcance', value: compact(totals.reach), icon: Activity, change: metricChanges.reach, color: 'blue' },
    { label: 'Interações', value: compact(totals.interactions), icon: Heart, change: metricChanges.interactions, color: 'navy' },
    { label: 'Seguidores', value: format(totals.followers), icon: Users, change: metricChanges.followers, color: 'coral' },
  ]
  const filteredChannels = useMemo(() => {
    const names: Platform[] = platform === 'Todas' ? ['Instagram', 'TikTok', 'YouTube'] : [platform]
    return names.map((name) => {
      const source = platformData[name]
      const periodValues = range.valid ? aggregateMetrics([source], range.start, range.end, today) : emptyTotals()
      return [name, { ...periodValues, color: source.color }] as const
    })
  }, [platform, range.valid, range.start, range.end, today])
  const maxPlatformViews = Math.max(1, ...filteredChannels.map(([, values]) => values.views))
  const posts = useMemo(() => range.valid ? allPosts.filter(post => (platform === 'Todas' || post.platform === platform) && post.date >= range.start && post.date <= range.end) : [], [platform, range.start, range.end, range.valid])
  const trendValues = chartValues.map(value => Math.round(totals.views * value / 100))
  const trendMax = Math.max(1, ...trendValues)
  const pointString = trendValues.map((value, index) => `${(index / (trendValues.length - 1)) * 100},${100 - value / trendMax * 100}`).join(' ')

  const downloadReport = async () => {
    if (!range.valid) return
    const { downloadFullInsightsReport } = await import('../lib/fullInsightsReport')
    await downloadFullInsightsReport({
      title: 'Relatório de desempenho',
      account: 'Perfil demonstrativo',
      range: period === 'custom' ? range.label : `${range.label} · ${displayDate(range.start)}–${displayDate(range.end)}`,
      reportDate: localISO(new Date()),
      filters: { platform: platform === 'Todas' ? 'Todas as plataformas' : platform },
      metrics: {
        views: totals.views,
        reach: totals.reach,
        interactions: totals.interactions,
        followers: totals.followers,
        comparisons: metricChanges,
      },
      platforms: filteredChannels.map(([name, values]) => ({ name, views: values.views, reach: values.reach, interactions: values.interactions, followers: values.followers })),
      posts: posts.map((post) => ({ title: post.title, platform: post.platform, views: post.views, interactions: post.interactions, date: displayDate(post.date) })),
      series: trendValues.map((value, index) => ({ label: `Ponto ${String(index + 1).padStart(2, '0')}`, value })),
    })
  }

  return <main className="insights-page">
    <style>{`
      .insights-page{--i-ink:#151c39;--i-muted:#727c94;--i-line:#dce4f0;--i-paper:#f2f5fb;--i-card:#fff;--i-navy:#171f8a;--i-cyan:#11cfe0;color:var(--i-ink);max-width:1500px;margin:0 auto;padding:35px clamp(18px,3vw,46px) 58px;font-family:inherit}
      .insights-page *{box-sizing:border-box}.insights-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.insights-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:23px}.insights-head h1{margin:8px 0 7px;font-size:clamp(27px,3vw,38px);line-height:1.1;letter-spacing:-.045em}.insights-head p{margin:0;color:var(--i-muted);font-size:13px;line-height:1.6}.insights-kicker{font-size:10px;color:var(--i-navy);font-weight:650}.insights-download{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:0 16px;border-radius:10px;background:var(--i-navy);color:#fff;font-weight:600;font-size:12px;box-shadow:0 7px 18px #171f8a25}.insights-download:hover{background:#222fa8}.insights-filters{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;padding:13px 15px;border:1px solid var(--i-line);border-radius:14px;background:var(--i-card);margin-bottom:13px}.insights-filter-group{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.insights-filter-label{font-size:10px;font-weight:600;color:var(--i-muted);margin-right:2px}.insights-chip{display:inline-flex;align-items:center;gap:6px;min-height:31px;padding:0 11px;border:1px solid transparent;border-radius:8px;color:var(--i-muted);background:transparent;font-size:11px}.insights-chip:hover{background:#f2f5fb}.insights-chip[aria-pressed=true]{color:var(--i-navy);border-color:#cdd7f1;background:#f1f4fc;font-weight:600}.insights-select{height:33px;padding:0 27px 0 10px;border:1px solid var(--i-line);border-radius:8px;color:var(--i-ink);background:#fff;font-size:11px}.insights-disclaimer{display:flex;align-items:center;gap:9px;margin:0 0 18px;padding:11px 14px;border:1px solid #a9e8ed;border-radius:10px;color:#14545d;background:#e7f9fa;font-size:11px;line-height:1.5}.insights-disclaimer strong{font-weight:700}.insights-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.insights-kpi{position:relative;min-height:127px;padding:17px;border:1px solid var(--i-line);border-radius:14px;background:var(--i-card)}.insights-kpi-icon{display:grid;place-items:center;width:31px;height:31px;margin-bottom:11px;border-radius:9px;background:#eef2fb;color:var(--i-navy)}.insights-kpi--cyan .insights-kpi-icon{background:#e5f9fb;color:#008994}.insights-kpi--navy .insights-kpi-icon{background:#e8fafa;color:#171f8a}.insights-kpi--coral .insights-kpi-icon{background:#eaf0f8;color:#52658a}.insights-kpi-label{display:block;color:var(--i-muted);font-size:10px}.insights-kpi-value{display:flex;align-items:baseline;justify-content:space-between;gap:7px;margin-top:4px}.insights-kpi-value strong{font-size:25px;letter-spacing:-.045em}.insights-kpi-value small{display:inline-flex;align-items:center;color:#088c82;font-size:9px;font-weight:600}.insights-kpi-value small.is-negative{color:#b54747}.insights-comparison-note{margin:-5px 0 14px;color:var(--i-muted);font-size:9px;line-height:1.4}.insights-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:13px;margin-bottom:14px}.insights-panel{min-width:0;padding:20px;border:1px solid var(--i-line);border-radius:14px;background:var(--i-card)}.insights-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}.insights-panel-heading h2{margin:0;font-size:15px;letter-spacing:-.02em}.insights-panel-heading p{margin:5px 0 0;color:var(--i-muted);font-size:10px}.insights-legend{display:flex;gap:13px;color:var(--i-muted);font-size:9px}.insights-legend span{display:inline-flex;align-items:center;gap:5px}.insights-legend i{width:7px;height:7px;border-radius:50%;background:var(--i-cyan)}.insights-chart{width:100%;height:204px;display:block;overflow:visible}.insights-chart text{font-family:inherit;fill:#8993a8;font-size:9px}.insights-platform-row{display:grid;grid-template-columns:minmax(78px,1fr) 1.4fr auto;align-items:center;gap:10px;padding:11px 0;border-top:1px solid #edf0f5;font-size:10px}.insights-platform-name{display:flex;align-items:center;gap:7px;font-weight:600}.insights-platform-name i{width:8px;height:8px;border-radius:50%;background:var(--platform-color)}.insights-progress{height:6px;overflow:hidden;border-radius:9px;background:#edf0f6}.insights-progress span{display:block;height:100%;border-radius:9px;background:var(--platform-color)}.insights-platform-value{color:var(--i-muted);text-align:right}.insights-table-wrap{overflow:auto}.insights-table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}.insights-table th{padding:9px 12px;color:var(--i-muted);background:#f7f9fc;font-size:9px;font-weight:600}.insights-table td{padding:12px;border-bottom:1px solid #edf0f5;font-size:10px}.insights-table tr:last-child td{border-bottom:0}.insights-post-title{font-weight:600}.insights-post-meta{display:block;margin-top:4px;color:var(--i-muted);font-size:9px}.insights-platform-tag{display:inline-flex;padding:4px 7px;border-radius:6px;color:#39448d;background:#eef1fa;font-size:9px}.insights-report{margin-top:14px}.insights-report-fields{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px}.insights-field{display:flex;flex-direction:column;gap:6px;color:var(--i-muted);font-size:9px;font-weight:600}.insights-field input,.insights-field select{width:100%;height:36px;padding:0 10px;border:1px solid var(--i-line);border-radius:8px;background:#fff;color:var(--i-ink);font:inherit;font-size:11px}.insights-field input:focus-visible,.insights-field select:focus-visible,.insights-chip:focus-visible,.insights-download:focus-visible{outline:2px solid var(--i-cyan);outline-offset:2px}.insights-empty{padding:20px;color:var(--i-muted);font-size:11px;text-align:center}@media(max-width:800px){.insights-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.insights-layout{grid-template-columns:1fr}.insights-head{align-items:flex-start;flex-direction:column}.insights-report-fields{grid-template-columns:1fr 1fr}.insights-field:first-child{grid-column:1/-1}}@media(max-width:520px){.insights-filters{align-items:flex-start}.insights-filter-group{width:100%}.insights-filter-label{width:100%}.insights-kpis{gap:8px}.insights-kpi{padding:13px;min-height:119px}.insights-kpi-value strong{font-size:21px}.insights-panel{padding:15px}.insights-chart{height:170px}.insights-report-fields{grid-template-columns:1fr}.insights-field:first-child{grid-column:auto}.insights-download{width:100%}}
    `}</style>
    <header className="insights-head">
      <div><span className="insights-kicker">INSIGHTS / VISÃO GERAL</span><h1>O que está movimentando seu conteúdo?</h1><p>Acompanhe uma leitura demonstrativa do desempenho por canal e período.</p></div>
      <button type="button" className="insights-download" onClick={downloadReport} disabled={!range.valid}><Download size={16} aria-hidden="true" />Baixar relatório PDF</button>
    </header>
    <section className="insights-filters" aria-label="Filtros do relatório">
      <div className="insights-filter-group" role="group" aria-label="Período">
        <span className="insights-filter-label"><CalendarDays size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Período</span>
        {([{ id: '7', label: '7 dias' }, { id: '28', label: '28 dias' }, { id: '90', label: '90 dias' }, { id: '6m', label: '6 meses' }, { id: '1y', label: '1 ano' }] as const).map(({ id, label }) => <button key={id} type="button" className="insights-chip" aria-pressed={period === id} onClick={() => setPeriod(id)}>{label}</button>)}<button type="button" className="insights-chip" aria-pressed={period === 'custom'} onClick={() => setPeriod('custom')}><CalendarDays size={12} />Personalizado</button>
      </div>
      <div className="insights-filter-group" role="group" aria-label="Filtrar plataforma">
        <span className="insights-filter-label">Plataforma</span>
        {(['Todas', 'Instagram', 'TikTok', 'YouTube'] as const).map(value => <button key={value} type="button" className="insights-chip" aria-pressed={platform === value} onClick={() => setPlatform(value)}>{value === 'Instagram' ? <Camera size={13} /> : value === 'TikTok' ? <Video size={13} /> : value === 'YouTube' ? <Play size={13} /> : null}{value}</button>)}
      </div>
    </section>
    {period === 'custom' && <section className="insights-custom-range" aria-label="Escolher intervalo personalizado"><label>Data inicial<input type="date" value={customStart} max={customEnd || today} onChange={event => setCustomStart(event.target.value)} /></label><span className="insights-range-separator">até</span><label>Data final<input type="date" value={customEnd} min={customStart} max={today} onChange={event => setCustomEnd(event.target.value)} /></label>{!range.valid && <span className="insights-range-error" role="alert">A data inicial precisa ser anterior ou igual à data final.</span>}<span className="insights-range-summary">{range.valid ? `${days} dias no intervalo · ${periodLabel}` : 'Ajuste o intervalo para atualizar os indicadores.'}</span></section>}
    <p className="insights-disclaimer" role="note"><BarChart3 size={16} aria-hidden="true" /><span><strong>Dados demonstrativos.</strong> Estes números são apenas exemplos visuais; nenhuma conta está conectada e nenhum dado real de plataforma é exibido.</span></p>
    <section className="insights-kpis" aria-label={`Indicadores: ${periodLabel}`}>
      {metrics.map(({ label, value, icon: Icon, change, color }) => { const ChangeIcon = change.startsWith('-') ? ArrowDownRight : ArrowUpRight; return <article className={`insights-kpi insights-kpi--${color}`} key={label}><div className="insights-kpi-icon"><Icon size={16} aria-hidden="true" /></div><span className="insights-kpi-label">{label}</span><div className="insights-kpi-value"><strong>{value}</strong><small className={change.startsWith('-') ? 'is-negative' : ''}><ChangeIcon size={12} />{change}</small></div></article> })}
    </section>
    <p className="insights-comparison-note">Variação demonstrativa frente ao período anterior de igual duração. Seguidores mostram a contagem ilustrativa na data final do intervalo.</p>
    <div className="insights-layout">
      <section className="insights-panel" aria-labelledby="insights-trend-title">
        <div className="insights-panel-heading"><div><h2 id="insights-trend-title">Ritmo de visualizações</h2><p>Tendência demonstrativa no intervalo selecionado</p></div><span className="insights-legend"><span><i />Visualizações</span></span></div>
        <svg className="insights-chart" viewBox="0 0 600 180" role="img" aria-labelledby="insights-chart-title insights-chart-desc" preserveAspectRatio="none">
          <title id="insights-chart-title">Tendência demonstrativa de visualizações</title><desc id="insights-chart-desc">Gráfico de linha com doze pontos mostrando uma tendência de exemplo crescente e variável.</desc>
          {[20, 60, 100, 140].map(y => <g key={y}><line x1="42" y1={y} x2="590" y2={y} stroke="#e8edf5" strokeWidth="1" /><text x="4" y={y + 3}>{compact(Math.round(trendMax * Math.max(0, 1 - (y - 18) / 122)))}</text></g>)}
          <polygon points={`42,148 ${pointString.split(' ').map(pair => { const [x, y] = pair.split(',').map(Number); return `${42 + x * 5.48},${18 + y * 1.22}` }).join(' ')} 590,148`} fill="#11cfe0" opacity=".10" />
          <polyline points={pointString.split(' ').map(pair => { const [x, y] = pair.split(',').map(Number); return `${42 + x * 5.48},${18 + y * 1.22}` }).join(' ')} fill="none" stroke="#11aebb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[0, 3, 6, 9, 11].map(i => { const x = 42 + i * 548 / 11; const y = 18 + (100 - trendValues[i] / trendMax * 100) * 1.22; return <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke="#11aebb" strokeWidth="2" /> })}
          <text x="42" y="169">{displayDate(range.start)}</text><text x="590" y="169" textAnchor="end">{displayDate(range.end)}</text>
        </svg>
      </section>
      <section className="insights-panel" aria-labelledby="insights-channels-title">
        <div className="insights-panel-heading"><div><h2 id="insights-channels-title">Resumo por plataforma</h2><p>O filtro acima é aplicado a este resumo e ao PDF</p></div></div>
        {filteredChannels.map(([name, data]) => <div className="insights-platform-row" key={name}><span className="insights-platform-name" style={{ '--platform-color': data.color } as React.CSSProperties}><i />{name}</span><span className="insights-progress" aria-label={`${name}: visualizações demonstrativas neste intervalo`}><span style={{ width: `${Math.max(5, Math.round(data.views / maxPlatformViews * 100))}%`, '--platform-color': data.color } as React.CSSProperties} /></span><span className="insights-platform-value">{compact(data.views)}</span></div>)}
      </section>
    </div>
    <section className="insights-panel" aria-labelledby="insights-posts-title">
      <div className="insights-panel-heading"><div><h2 id="insights-posts-title">Conteúdos em destaque</h2><p>Publicações de exemplo com melhor desempenho</p></div><span className="insights-kicker">{posts.length} itens</span></div>
      <div className="insights-table-wrap"><table className="insights-table"><thead><tr><th scope="col">Conteúdo</th><th scope="col">Canal</th><th scope="col">Visualizações</th><th scope="col">Interações</th><th scope="col">Publicado</th></tr></thead><tbody>{posts.map(post => <tr key={post.title}><td><span className="insights-post-title">{post.title}</span><span className="insights-post-meta">Post demonstrativo</span></td><td><span className="insights-platform-tag">{post.platform}</span></td><td>{format(post.views)}</td><td>{format(post.interactions)}</td><td>{displayDate(post.date)}</td></tr>)}</tbody></table>{!posts.length && <div className="insights-empty">Nenhum conteúdo demonstrativo neste período e plataforma.</div>}</div>
    </section>

  </main>
}

// Mantém o rótulo visualmente oculto sem depender de estilos globais.
