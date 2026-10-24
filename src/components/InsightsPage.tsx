import { useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Download, Eye, Heart, Camera, Share2, Users, Play, Video } from 'lucide-react'

type Platform = 'Instagram' | 'TikTok' | 'YouTube'
type Post = { title: string; platform: Platform; views: number; interactions: number; date: string }
type PeriodPreset = '7' | '28' | '90' | '6m' | '1y' | 'custom'
const localISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDays = (iso: string, amount: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + amount); return localISO(d) }
const shiftMonths = (iso: string, amount: number) => { const [year, month, day] = iso.split('-').map(Number); const target = new Date(year, month - 1 + amount, 1); const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate(); target.setDate(Math.min(day, lastDay)); return localISO(target) }
const displayDate = (iso: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '—'

const platformData: Record<Platform, { views: number; reach: number; interactions: number; followers: number; color: string }> = {
  Instagram: { views: 24800, reach: 15300, interactions: 1840, followers: 6240, color: '#171f8a' },
  TikTok: { views: 37100, reach: 26800, interactions: 3260, followers: 4830, color: '#11cfe0' },
  YouTube: { views: 18900, reach: 12800, interactions: 970, followers: 8920, color: '#8ba2c5' },
}
const allPosts: Post[] = [
  { title: 'Bastidores: um dia criando', platform: 'TikTok', views: 12800, interactions: 1240, date: '18 out' },
  { title: '3 ideias para sua próxima semana', platform: 'Instagram', views: 9400, interactions: 860, date: '16 out' },
  { title: 'Como montamos este cenário', platform: 'YouTube', views: 7200, interactions: 490, date: '13 out' },
  { title: 'Antes e depois: nosso processo', platform: 'Instagram', views: 6800, interactions: 610, date: '10 out' },
]
const chartValues = [28, 40, 35, 52, 46, 62, 55, 73, 66, 84, 76, 95]
const compact = (n: number) => n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n)
const format = (n: number) => new Intl.NumberFormat('pt-BR').format(n)

export function InsightsPage() {
  const today = localISO(new Date())
  const [period, setPeriod] = useState<PeriodPreset>('28')
  const [customStart, setCustomStart] = useState(() => shiftDays(localISO(new Date()), -27))
  const [customEnd, setCustomEnd] = useState(() => localISO(new Date()))
  const [platform, setPlatform] = useState<'Todas' | Platform>('Todas')
  const [channel, setChannel] = useState<'Todas' | Platform>('Todas')
  const [reportTitle, setReportTitle] = useState('Resumo de desempenho')
  const [account, setAccount] = useState('@seu_perfil')
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10))
  const range = useMemo(() => {
    const end = period === 'custom' ? customEnd : today
    const start = period === 'custom' ? customStart : period === '7' ? shiftDays(end, -6) : period === '28' ? shiftDays(end, -27) : period === '90' ? shiftDays(end, -89) : period === '6m' ? shiftMonths(end, -6) : shiftMonths(end, -12)
    const valid = Boolean(start && end && start <= end)
    const count = valid ? Math.max(1, Math.floor((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1) : 1
    const label = period === 'custom' ? `De ${displayDate(start)} a ${displayDate(end)}` : period === '6m' ? 'Últimos 6 meses' : period === '1y' ? 'Último ano' : `Últimos ${period} dias`
    return { start, end, valid, days: count, label }
  }, [period, customStart, customEnd, today])
  const days = range.days
  const periodLabel = range.label
  const selected = useMemo(() => platform === 'Todas' ? Object.values(platformData) : [platformData[platform]], [platform])
  const totals = useMemo(() => {
    const scale = days / 28
    return {
      views: Math.round(selected.reduce((sum, item) => sum + item.views, 0) * scale),
      reach: Math.round(selected.reduce((sum, item) => sum + item.reach, 0) * scale),
      interactions: Math.round(selected.reduce((sum, item) => sum + item.interactions, 0) * scale),
      followers: selected.reduce((sum, item) => sum + item.followers, 0),
    }
  }, [days, selected])
  const posts = useMemo(() => allPosts.filter(post => platform === 'Todas' || post.platform === platform).slice(0, 4), [platform])
  const filteredChannels = channel === 'Todas' ? Object.entries(platformData) as [Platform, typeof platformData[Platform]][] : [[channel, platformData[channel]] as [Platform, typeof platformData[Platform]]]

  const downloadReport = async () => {
    if (!range.valid) return
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const navy: [number, number, number] = [23, 31, 138]
    const cyan: [number, number, number] = [17, 207, 224]
    const ink: [number, number, number] = [21, 28, 57]
    const muted: [number, number, number] = [103, 112, 137]
    const w = 210
    const dateLabel = new Date(`${reportDate}T12:00:00`).toLocaleDateString('pt-BR')
    const periodLabel = range.label
    const selectedLabel = platform === 'Todas' ? 'Todas as plataformas' : platform
    const card = (x: number, y: number, label: string, value: string, accent: [number, number, number]) => {
      pdf.setDrawColor(221, 228, 240); pdf.setFillColor(255, 255, 255); pdf.roundedRect(x, y, 39, 30, 3, 3, 'FD')
      pdf.setFillColor(...accent); pdf.roundedRect(x, y, 2, 30, 1, 1, 'F')
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text(label, x + 5, y + 9)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...ink); pdf.text(value, x + 5, y + 21)
    }
    // Page 1: editorial cover and key indicators.
    pdf.setFillColor(...navy); pdf.rect(0, 0, w, 91, 'F')
    pdf.setFillColor(...cyan); pdf.circle(184, 19, 2.5, 'F'); pdf.setDrawColor(74, 98, 193); pdf.setLineWidth(.35); pdf.circle(184, 19, 11); pdf.circle(184, 19, 19)
    pdf.setTextColor(177, 225, 236); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('ESTÚDIO SOCIAL  /  RELATÓRIO DEMONSTRATIVO', 19, 21)
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(27); pdf.text(pdf.splitTextToSize(reportTitle || 'Resumo de desempenho', 160), 19, 43)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.setTextColor(215, 224, 249); pdf.text(account || 'Conta não informada', 19, 65)
    pdf.setFontSize(9); pdf.text(`${periodLabel}   •   ${selectedLabel}`, 19, 74); pdf.text(`Emitido em ${dateLabel}`, 19, 82)
    pdf.setFillColor(225, 248, 249); pdf.roundedRect(18, 101, 174, 13, 3, 3, 'F'); pdf.setTextColor(...navy); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('DADOS DEMONSTRATIVOS — números de exemplo, não representam resultados reais.', 23, 109)
    pdf.setTextColor(...ink); pdf.setFontSize(15); pdf.text('Indicadores do período', 19, 130)
    card(19, 139, 'Visualizações', compact(totals.views), cyan); card(62, 139, 'Alcance', compact(totals.reach), navy); card(105, 139, 'Interações', compact(totals.interactions), [23, 31, 138]); card(148, 139, 'Seguidores', format(totals.followers), [139, 162, 197])
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text('Variação ilustrativa vs. período anterior', 19, 178)
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...cyan); pdf.text('+12,4%', 191, 178, { align: 'right' })
    pdf.setDrawColor(226, 232, 243); pdf.line(19, 184, 191, 184)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text('As métricas acima são dados fictícios para demonstração da interface.', 19, 194)
    pdf.setTextColor(...navy); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('VISÃO GERAL', 19, 266)
    pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text('Relatório de exemplo • Social Studio', 19, 273); pdf.text('01 / 02', 191, 273, { align: 'right' })

    // Page 2: native vector chart, platform mix, and sample content.
    pdf.addPage(); pdf.setFillColor(...navy); pdf.rect(0, 0, w, 22, 'F')
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text('DESEMPENHO  /  DETALHAMENTO', 19, 14)
    pdf.setTextColor(...ink); pdf.setFontSize(15); pdf.text('Tendência de visualizações', 19, 39)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text(`Série ilustrativa • ${periodLabel}`, 19, 46)
    const left = 24, top = 57, chartW = 160, chartH = 65
    pdf.setDrawColor(226, 232, 243); pdf.setLineWidth(.25)
    for (let i = 0; i < 4; i++) { const y = top + i * chartH / 3; pdf.line(left, y, left + chartW, y); pdf.setFontSize(7); pdf.setTextColor(...muted); pdf.text(`${100 - i * 30}`, 19, y + 1) }
    pdf.setDrawColor(...cyan); pdf.setLineWidth(1.2)
    const pts = chartValues.map((value, i) => [left + i * chartW / (chartValues.length - 1), top + chartH - value * chartH / 100] as [number, number])
    for (let i = 1; i < pts.length; i++) pdf.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
    pdf.setFillColor(...navy); pts.forEach(([x, y]) => pdf.circle(x, y, 1.1, 'F'))
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...muted); pdf.text('Início do período', left, 130); pdf.text('Fim do período', left + chartW, 130, { align: 'right' })
    pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text('Resumo por plataforma', 19, 148)
    let rowY = 158
    filteredChannels.forEach(([name, data]) => {
      const scale = days / 28; const isFiltered = platform !== 'Todas'
      const valueViews = Math.round((isFiltered ? totals.views : data.views * scale))
      pdf.setFillColor(246, 248, 252); pdf.roundedRect(19, rowY - 6, 172, 15, 2, 2, 'F')
      pdf.setFillColor(...(name === 'Instagram' ? [23, 31, 138] : name === 'TikTok' ? [17, 207, 224] : [139, 162, 197]) as [number, number, number]); pdf.circle(25, rowY + 1, 1.8, 'F')
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...ink); pdf.text(name, 31, rowY + 2)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text(`${compact(valueViews)} visualizações   ·   ${format(data.followers)} seguidores`, 188, rowY + 2, { align: 'right' })
      rowY += 19
    })
    const tableTop = Math.max(rowY + 10, 210)
    pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text('Conteúdos em destaque', 19, tableTop)
    const headerY = tableTop + 10
    pdf.setFillColor(...navy); pdf.roundedRect(19, headerY - 5, 172, 10, 2, 2, 'F')
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.text('CONTEÚDO', 23, headerY + 1); pdf.text('CANAL', 130, headerY + 1); pdf.text('VIEWS', 164, headerY + 1, { align: 'right' }); pdf.text('INTERAÇÕES', 187, headerY + 1, { align: 'right' })
    let postY = headerY + 12
    posts.slice(0, 3).forEach((post, index) => {
      pdf.setDrawColor(232, 236, 244); pdf.line(19, postY + 4, 191, postY + 4)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...ink); pdf.text(pdf.splitTextToSize(post.title, 86)[0], 23, postY)
      pdf.setTextColor(...muted); pdf.text(post.platform, 130, postY); pdf.text(format(post.views), 164, postY, { align: 'right' }); pdf.text(format(post.interactions), 187, postY, { align: 'right' })
      postY += 12
    })
    const noteY = Math.min(postY + 8, 263)
    pdf.setFillColor(225, 248, 249); pdf.roundedRect(19, noteY - 5, 172, 17, 2, 2, 'F')
    pdf.setTextColor(...navy); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.text('Fonte e notas', 23, noteY + 1)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.text('Dados fictícios gerados localmente para fins de demonstração. Nenhuma conta foi conectada.', 23, noteY + 7)
    pdf.setTextColor(...muted); pdf.setFontSize(8); pdf.text('02 / 02', 191, 281, { align: 'right' })
    pdf.save('relatorio-demonstrativo-social-studio.pdf')
  }

  const metrics = [
    { label: 'Visualizações', value: compact(totals.views), icon: Eye, change: '+12,4%', color: 'cyan' },
    { label: 'Alcance', value: compact(totals.reach), icon: Activity, change: '+8,2%', color: 'blue' },
    { label: 'Interações', value: compact(totals.interactions), icon: Heart, change: '+6,7%', color: 'violet' },
    { label: 'Seguidores', value: format(totals.followers), icon: Users, change: '+3,1%', color: 'coral' },
  ]
  const pointString = chartValues.map((value, index) => `${(index / (chartValues.length - 1)) * 100},${100 - value}`).join(' ')

  return <main className="insights-page">
    <style>{`
      .insights-page{--i-ink:#151c39;--i-muted:#727c94;--i-line:#dce4f0;--i-paper:#f2f5fb;--i-card:#fff;--i-navy:#171f8a;--i-cyan:#11cfe0;color:var(--i-ink);max-width:1500px;margin:0 auto;padding:35px clamp(18px,3vw,46px) 58px;font-family:inherit}
      .insights-page *{box-sizing:border-box}.insights-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.insights-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:23px}.insights-head h1{margin:8px 0 7px;font-size:clamp(27px,3vw,38px);line-height:1.1;letter-spacing:-.045em}.insights-head p{margin:0;color:var(--i-muted);font-size:13px;line-height:1.6}.insights-kicker{font-size:10px;color:var(--i-navy);font-weight:650}.insights-download{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:0 16px;border-radius:10px;background:var(--i-navy);color:#fff;font-weight:600;font-size:12px;box-shadow:0 7px 18px #171f8a25}.insights-download:hover{background:#222fa8}.insights-filters{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;padding:13px 15px;border:1px solid var(--i-line);border-radius:14px;background:var(--i-card);margin-bottom:13px}.insights-filter-group{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.insights-filter-label{font-size:10px;font-weight:600;color:var(--i-muted);margin-right:2px}.insights-chip{display:inline-flex;align-items:center;gap:6px;min-height:31px;padding:0 11px;border:1px solid transparent;border-radius:8px;color:var(--i-muted);background:transparent;font-size:11px}.insights-chip:hover{background:#f2f5fb}.insights-chip[aria-pressed=true]{color:var(--i-navy);border-color:#cdd7f1;background:#f1f4fc;font-weight:600}.insights-select{height:33px;padding:0 27px 0 10px;border:1px solid var(--i-line);border-radius:8px;color:var(--i-ink);background:#fff;font-size:11px}.insights-disclaimer{display:flex;align-items:center;gap:9px;margin:0 0 18px;padding:11px 14px;border:1px solid #a9e8ed;border-radius:10px;color:#14545d;background:#e7f9fa;font-size:11px;line-height:1.5}.insights-disclaimer strong{font-weight:700}.insights-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.insights-kpi{position:relative;min-height:127px;padding:17px;border:1px solid var(--i-line);border-radius:14px;background:var(--i-card)}.insights-kpi-icon{display:grid;place-items:center;width:31px;height:31px;margin-bottom:11px;border-radius:9px;background:#eef2fb;color:var(--i-navy)}.insights-kpi--cyan .insights-kpi-icon{background:#e5f9fb;color:#008994}.insights-kpi--violet .insights-kpi-icon{background:#e8fafa;color:#171f8a}.insights-kpi--coral .insights-kpi-icon{background:#eaf0f8;color:#52658a}.insights-kpi-label{display:block;color:var(--i-muted);font-size:10px}.insights-kpi-value{display:flex;align-items:baseline;justify-content:space-between;gap:7px;margin-top:4px}.insights-kpi-value strong{font-size:25px;letter-spacing:-.045em}.insights-kpi-value small{display:inline-flex;align-items:center;color:#088c82;font-size:9px;font-weight:600}.insights-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:13px;margin-bottom:14px}.insights-panel{min-width:0;padding:20px;border:1px solid var(--i-line);border-radius:14px;background:var(--i-card)}.insights-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}.insights-panel-heading h2{margin:0;font-size:15px;letter-spacing:-.02em}.insights-panel-heading p{margin:5px 0 0;color:var(--i-muted);font-size:10px}.insights-legend{display:flex;gap:13px;color:var(--i-muted);font-size:9px}.insights-legend span{display:inline-flex;align-items:center;gap:5px}.insights-legend i{width:7px;height:7px;border-radius:50%;background:var(--i-cyan)}.insights-chart{width:100%;height:204px;display:block;overflow:visible}.insights-chart text{font-family:inherit;fill:#8993a8;font-size:9px}.insights-platform-row{display:grid;grid-template-columns:minmax(78px,1fr) 1.4fr auto;align-items:center;gap:10px;padding:11px 0;border-top:1px solid #edf0f5;font-size:10px}.insights-platform-name{display:flex;align-items:center;gap:7px;font-weight:600}.insights-platform-name i{width:8px;height:8px;border-radius:50%;background:var(--platform-color)}.insights-progress{height:6px;overflow:hidden;border-radius:9px;background:#edf0f6}.insights-progress span{display:block;height:100%;border-radius:9px;background:var(--platform-color)}.insights-platform-value{color:var(--i-muted);text-align:right}.insights-table-wrap{overflow:auto}.insights-table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}.insights-table th{padding:9px 12px;color:var(--i-muted);background:#f7f9fc;font-size:9px;font-weight:600}.insights-table td{padding:12px;border-bottom:1px solid #edf0f5;font-size:10px}.insights-table tr:last-child td{border-bottom:0}.insights-post-title{font-weight:600}.insights-post-meta{display:block;margin-top:4px;color:var(--i-muted);font-size:9px}.insights-platform-tag{display:inline-flex;padding:4px 7px;border-radius:6px;color:#39448d;background:#eef1fa;font-size:9px}.insights-report{margin-top:14px}.insights-report-fields{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px}.insights-field{display:flex;flex-direction:column;gap:6px;color:var(--i-muted);font-size:9px;font-weight:600}.insights-field input,.insights-field select{width:100%;height:36px;padding:0 10px;border:1px solid var(--i-line);border-radius:8px;background:#fff;color:var(--i-ink);font:inherit;font-size:11px}.insights-field input:focus-visible,.insights-field select:focus-visible,.insights-chip:focus-visible,.insights-download:focus-visible{outline:2px solid var(--i-cyan);outline-offset:2px}.insights-empty{padding:20px;color:var(--i-muted);font-size:11px;text-align:center}@media(max-width:800px){.insights-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.insights-layout{grid-template-columns:1fr}.insights-head{align-items:flex-start;flex-direction:column}.insights-report-fields{grid-template-columns:1fr 1fr}.insights-field:first-child{grid-column:1/-1}}@media(max-width:520px){.insights-filters{align-items:flex-start}.insights-filter-group{width:100%}.insights-filter-label{width:100%}.insights-kpis{gap:8px}.insights-kpi{padding:13px;min-height:119px}.insights-kpi-value strong{font-size:21px}.insights-panel{padding:15px}.insights-chart{height:170px}.insights-report-fields{grid-template-columns:1fr}.insights-field:first-child{grid-column:auto}.insights-download{width:100%}}
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
      {metrics.map(({ label, value, icon: Icon, change, color }) => <article className={`insights-kpi insights-kpi--${color}`} key={label}><div className="insights-kpi-icon"><Icon size={16} aria-hidden="true" /></div><span className="insights-kpi-label">{label}</span><div className="insights-kpi-value"><strong>{value}</strong><small><ArrowUpRight size={12} />{change}</small></div></article>)}
    </section>
    <div className="insights-layout">
      <section className="insights-panel" aria-labelledby="insights-trend-title">
        <div className="insights-panel-heading"><div><h2 id="insights-trend-title">Ritmo de visualizações</h2><p>Uma tendência ilustrativa ao longo do período</p></div><span className="insights-legend"><span><i />Visualizações</span></span></div>
        <svg className="insights-chart" viewBox="0 0 600 180" role="img" aria-labelledby="insights-chart-title insights-chart-desc" preserveAspectRatio="none">
          <title id="insights-chart-title">Tendência demonstrativa de visualizações</title><desc id="insights-chart-desc">Gráfico de linha com doze pontos mostrando uma tendência de exemplo crescente e variável.</desc>
          {[20, 60, 100, 140].map(y => <g key={y}><line x1="42" y1={y} x2="590" y2={y} stroke="#e8edf5" strokeWidth="1" /><text x="4" y={y + 3}>{140 - y}</text></g>)}
          <polygon points={`42,148 ${pointString.split(' ').map(pair => { const [x, y] = pair.split(',').map(Number); return `${42 + x * 5.48},${18 + y * 1.22}` }).join(' ')} 590,148`} fill="#11cfe0" opacity=".10" />
          <polyline points={pointString.split(' ').map(pair => { const [x, y] = pair.split(',').map(Number); return `${42 + x * 5.48},${18 + y * 1.22}` }).join(' ')} fill="none" stroke="#11aebb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[0, 3, 6, 9, 11].map(i => { const x = 42 + i * 548 / 11; const y = 18 + (100 - chartValues[i]) * 1.22; return <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke="#11aebb" strokeWidth="2" /> })}
          <text x="42" y="169">Início do período</text><text x="590" y="169" textAnchor="end">Hoje</text>
        </svg>
      </section>
      <section className="insights-panel" aria-labelledby="insights-channels-title">
        <div className="insights-panel-heading"><div><h2 id="insights-channels-title">Resumo por canal</h2><p>Valores de exemplo por plataforma</p></div><label className="insights-sr-only" htmlFor="insights-channel">Selecionar canal</label><select id="insights-channel" className="insights-select" value={channel} onChange={event => setChannel(event.target.value as 'Todas' | Platform)}><option>Todas</option><option>Instagram</option><option>TikTok</option><option>YouTube</option></select></div>
        {filteredChannels.map(([name, data]) => <div className="insights-platform-row" key={name}><span className="insights-platform-name" style={{ '--platform-color': data.color } as React.CSSProperties}><i />{name}</span><span className="insights-progress" aria-label={`${name}: participação ilustrativa`}><span style={{ width: `${Math.max(18, Math.round(data.views / 371))}%`, '--platform-color': data.color } as React.CSSProperties} /></span><span className="insights-platform-value">{compact(Math.round(data.views * days / 28))}</span></div>)}
      </section>
    </div>
    <section className="insights-panel" aria-labelledby="insights-posts-title">
      <div className="insights-panel-heading"><div><h2 id="insights-posts-title">Conteúdos em destaque</h2><p>Publicações de exemplo com melhor desempenho</p></div><span className="insights-kicker">{posts.length} itens</span></div>
      <div className="insights-table-wrap"><table className="insights-table"><thead><tr><th scope="col">Conteúdo</th><th scope="col">Canal</th><th scope="col">Visualizações</th><th scope="col">Interações</th><th scope="col">Publicado</th></tr></thead><tbody>{posts.map(post => <tr key={post.title}><td><span className="insights-post-title">{post.title}</span><span className="insights-post-meta">Post demonstrativo</span></td><td><span className="insights-platform-tag">{post.platform}</span></td><td>{format(post.views)}</td><td>{format(post.interactions)}</td><td>{post.date}</td></tr>)}</tbody></table>{!posts.length && <div className="insights-empty">Nenhum conteúdo de exemplo para esta plataforma.</div>}</div>
    </section>
    <section className="insights-panel insights-report" aria-labelledby="insights-report-title"><div className="insights-panel-heading"><div><h2 id="insights-report-title">Personalize seu relatório</h2><p>Edite os campos que aparecem no arquivo PDF.</p></div><Share2 size={17} color="#171f8a" aria-hidden="true" /></div><div className="insights-report-fields"><label className="insights-field">Título do relatório<input value={reportTitle} onChange={event => setReportTitle(event.target.value)} maxLength={70} /></label><label className="insights-field">Conta / perfil<input value={account} onChange={event => setAccount(event.target.value)} maxLength={50} /></label><label className="insights-field">Data do relatório<input type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} /></label></div></section>
  </main>
}

// Mantém o rótulo visualmente oculto sem depender de estilos globais.
