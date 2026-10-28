import { jsPDF } from 'jspdf'
import type { MetricComparison } from './api'

type ReportAccount = {
  provider: string
  accountName?: string
  handle?: string
  status: 'ready' | 'error'
  summary: Record<string, number>
  comparison?: MetricComparison
  coverage?: { start: string; end: string; through?: string; partial?: boolean }
  fetchedAt?: string
  stale?: boolean
  limitations?: string[]
  error?: string
}
type ReportPost = { title: string; account: string; platform: string; date: string; views?: number; interactions?: number }
type ReportPoint = { label: string; value: number }
export type InsightsReportData = {
  title: string
  range: string
  reportDate?: string
  generatedAt?: string
  filters: { platform: string; account: string; startDate: string; endDate: string }
  accounts: ReportAccount[]
  posts: ReportPost[]
  series: ReportPoint[]
  seriesMetric?: string
  notes?: string[]
}

const C = {
  navy: [18, 49, 76] as [number, number, number],
  cyan: [9, 132, 148] as [number, number, number],
  pale: [230, 247, 248] as [number, number, number],
  ink: [22, 35, 55] as [number, number, number],
  muted: [90, 108, 129] as [number, number, number],
  line: [219, 230, 237] as [number, number, number],
  blue: [63, 105, 143] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}
const METRIC_LABELS: Record<string, string> = {
  views: 'Visualizações', reach: 'Alcance', interactions: 'Interações', followers: 'Seguidores/inscritos atuais',
  estimatedMinutesWatched: 'Minutos assistidos', subscribersGained: 'Inscritos ganhos', subscribersLost: 'Inscritos perdidos',
}
const fmt = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value) : 'Indisponível'
const safe = (value?: string | null, fallback = '—') => typeof value === 'string' && value.trim() ? value.trim() : fallback
const datePt = (value?: string) => {
  if (!value) return '—'
  const d = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR')
}
const dateTimePt = (value?: string) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}
const accountTitle = (account: ReportAccount) => `${safe(account.provider)}${account.handle ? ` · @${account.handle}` : account.accountName ? ` · ${account.accountName}` : ''}`

export async function downloadFullInsightsReport(data: InsightsReportData): Promise<void> {
  if (!data.accounts.some((account) => account.status === 'ready')) throw new Error('Não há dados de uma conta autorizada para incluir no relatório.')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, L = 17, R = 193, BOTTOM = 267
  let y = 0
  const text = (value: string, x: number, yy: number, opts?: Parameters<typeof pdf.text>[3]) => pdf.text(value, x, yy, opts)
  const font = (bold = false, size = 9) => { pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size) }
  const lines = (value: string, width: number, size = 9, bold = false) => { font(bold, size); return pdf.splitTextToSize(String(value ?? ''), width) as string[] }
  const header = (section: string) => {
    pdf.setFillColor(...C.navy); pdf.rect(0, 0, W, 22, 'F')
    font(true, 8.5); pdf.setTextColor(...C.white); text('PLANEJADOR DE CONTEÚDO  /  MÉTRICAS AUTORIZADAS', L, 9)
    font(false, 8); pdf.setTextColor(204, 225, 234); text(section, L, 16)
    y = 31
  }
  const footerAll = () => {
    const pages = pdf.getNumberOfPages()
    for (let index = 1; index <= pages; index++) {
      pdf.setPage(index); pdf.setDrawColor(...C.line); pdf.setLineWidth(.25); pdf.line(L, 279, R, 279)
      font(false, 7); pdf.setTextColor(...C.muted); text('Consulta somente leitura · PDF gerado neste dispositivo · sem envio às redes', L, 285)
      text(`${String(index).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`, R, 285, { align: 'right' })
    }
  }
  const newPage = (section: string) => { pdf.addPage(); header(section) }
  const ensure = (height: number, section: string) => { if (y + height > BOTTOM) newPage(section) }
  const title = (value: string, section: string) => {
    ensure(14, section); font(true, 13); pdf.setTextColor(...C.ink); text(value, L, y); y += 7
    pdf.setDrawColor(...C.cyan); pdf.setLineWidth(.8); pdf.line(L, y, L + 17, y); y += 6
  }
  const paragraph = (value: string, section: string, size = 8.5) => {
    const row = lines(value, R - L, size), lineHeight = size * .5 + 1.3
    for (const line of row) { ensure(lineHeight, section); font(false, size); pdf.setTextColor(...C.muted); text(line, L, y); y += lineHeight }
  }
  const labelValue = (label: string, value: string, section: string) => {
    const valueLines = lines(value, R - L - 42, 8), height = Math.max(7, valueLines.length * 4.3 + 2)
    ensure(height, section); font(true, 8); pdf.setTextColor(...C.blue); text(label, L, y)
    font(false, 8); pdf.setTextColor(...C.ink); valueLines.forEach((line, index) => text(line, L + 42, y + index * 4.3)); y += height
  }
  const metricRows = (account: ReportAccount) => {
    const preferred = ['views', 'reach', 'interactions', 'followers', 'estimatedMinutesWatched', 'subscribersGained', 'subscribersLost']
    return preferred.filter((key) => Object.prototype.hasOwnProperty.call(account.summary || {}, key)).map((key) => `${METRIC_LABELS[key] || key}: ${fmt(account.summary[key])}`)
  }

  // Capa: filtros realmente aplicados e instante de sincronização.
  pdf.setFillColor(...C.navy); pdf.rect(0, 0, W, 83, 'F')
  pdf.setDrawColor(74, 139, 158); pdf.setLineWidth(.4); pdf.circle(181, 25, 10); pdf.circle(181, 25, 18); pdf.setFillColor(...C.cyan); pdf.circle(181, 25, 2.3, 'F')
  font(true, 8.5); pdf.setTextColor(183, 230, 232); text('RELATÓRIO  /  CONTAS SOCIAIS AUTORIZADAS', L, 18)
  const coverTitle = lines(safe(data.title, 'Métricas de redes sociais'), 155, 22, true)
  font(true, 22); pdf.setTextColor(...C.white); coverTitle.slice(0, 2).forEach((line, index) => text(line, L, 38 + index * 9))
  font(false, 9); pdf.setTextColor(221, 234, 242); text(safe(data.range), L, 61)
  text(`Emitido ${datePt(data.reportDate)}  ·  plataforma: ${safe(data.filters.platform)}`, L, 70)
  y = 96; title('Filtros e origem', 'VISÃO GERAL')
  labelValue('Conta(s)', safe(data.filters.account), 'VISÃO GERAL')
  labelValue('Data inicial', datePt(data.filters.startDate), 'VISÃO GERAL')
  labelValue('Data final', datePt(data.filters.endDate), 'VISÃO GERAL')
  labelValue('Última resposta', dateTimePt(data.generatedAt), 'VISÃO GERAL')
  y += 4
  paragraph('Este relatório contém somente valores retornados por APIs oficiais para contas consentidas. As definições e datas de cobertura variam entre fornecedores; uma métrica ausente permanece como indisponível e não é convertida em zero.', 'VISÃO GERAL')
  y += 5; title('Resumo por conta', 'VISÃO GERAL')
  for (const account of data.accounts) {
    const metrics = metricRows(account)
    const content = account.status === 'ready' ? metrics.length ? metrics.join('  ·  ') : 'A fonte respondeu, mas não retornou campos numéricos para o intervalo.' : `Consulta indisponível: ${safe(account.error, 'erro de sincronização')}`
    const metricLines = lines(content, R - L - 49, 7.5)
    const rowH = Math.max(16, metricLines.length * 4 + 9)
    ensure(rowH, 'VISÃO GERAL  /  CONTAS')
    pdf.setFillColor(account.status === 'ready' ? 243 : 255, account.status === 'ready' ? 248 : 246, account.status === 'ready' ? 250 : 246); pdf.roundedRect(L, y - 3, R - L, rowH, 2, 2, 'F')
    font(true, 8); pdf.setTextColor(...C.ink); lines(accountTitle(account), 46, 8, true).forEach((line, index) => text(line, L + 3, y + index * 4))
    font(false, 7.5); pdf.setTextColor(...C.muted); metricLines.forEach((line, index) => text(line, L + 51, y + index * 4))
    y += rowH + 2
  }
  y += 3; title('Tendência diária retornada', 'DESEMPENHO')
  if (data.series.length && data.seriesMetric) {
    paragraph(`${safe(data.seriesMetric)}. Cada ponto corresponde a uma observação retornada; lacunas não foram estimadas nem completadas.`, 'DESEMPENHO', 8)
    const chartX = L + 13, chartY = y + 3, chartW = R - L - 22, chartH = 48
    const max = Math.max(1, ...data.series.map((point) => point.value))
    pdf.setDrawColor(...C.line); pdf.setLineWidth(.25)
    for (let i = 0; i < 4; i++) { const yy = chartY + i * chartH / 3; pdf.line(chartX, yy, chartX + chartW, yy); font(false, 6.5); pdf.setTextColor(...C.muted); text(fmt(max * (1 - i / 3)), L, yy + 1) }
    const values = data.series.map((point, index) => [chartX + (data.series.length === 1 ? chartW / 2 : index * chartW / (data.series.length - 1)), chartY + chartH - (point.value / max) * chartH] as [number, number])
    pdf.setDrawColor(...C.cyan); pdf.setLineWidth(1)
    for (let i = 1; i < values.length; i++) pdf.line(values[i - 1][0], values[i - 1][1], values[i][0], values[i][1])
    pdf.setFillColor(...C.navy); values.forEach(([x, yy]) => pdf.circle(x, yy, 1.1, 'F'))
    y = chartY + chartH + 8
    labelValue('Primeiro ponto', `${safe(data.series[0].label)} · ${fmt(data.series[0].value)}`, 'DESEMPENHO')
    labelValue('Último ponto', `${safe(data.series[data.series.length - 1].label)} · ${fmt(data.series[data.series.length - 1].value)}`, 'DESEMPENHO')
  } else {
    paragraph('Nenhuma série diária foi fornecida para a combinação selecionada. Contagens cumulativas ou ausência de dados não foram convertidas em uma linha artificial.', 'DESEMPENHO')
  }

  newPage('DESEMPENHO  /  DETALHE POR CONTA')
  title('Cobertura, comparações e limitações', 'FONTES')
  for (const account of data.accounts) {
    ensure(25, 'FONTES  /  CONTINUAÇÃO')
    font(true, 9); pdf.setTextColor(...C.navy); text(accountTitle(account), L, y); y += 5
    labelValue('Estado', account.status === 'ready' ? 'Consulta concluída' : `Indisponível · ${safe(account.error)}`, 'FONTES')
    if (account.coverage) {
      const coverageText = account.provider === 'TikTok'
        ? `${datePt(account.coverage.start)} a ${datePt(account.coverage.end)} · janela de publicação; contagens vitalícias atuais`
        : account.coverage.through
          ? `${datePt(account.coverage.start)} a ${datePt(account.coverage.through)} · datas retornadas`
          : `${datePt(account.coverage.start)} a ${datePt(account.coverage.end)} · intervalo consultado; sem cobertura diária informada`
      labelValue('Cobertura', `${coverageText}${account.coverage.partial ? ' · cobertura parcial' : ''}`, 'FONTES')
    }
    labelValue('Obtido em', dateTimePt(account.fetchedAt), 'FONTES')
    const comparisons = account.comparison
    if (comparisons?.status === 'ready' && comparisons.summary) {
      const compareText = Object.entries(comparisons.summary).filter(([key, value]) => key !== 'followers' && typeof value === 'number' && Number.isFinite(value) && typeof account.summary[key] === 'number').map(([key, old]) => {
        const current = account.summary[key]
        const suffix = old === 0 ? current === 0 ? 'sem variação' : 'sem base anterior' : `${((current! - old) / Math.abs(old as number) * 100).toFixed(1)}%`
        return `${METRIC_LABELS[key] || key}: atual ${fmt(current)} · anterior ${fmt(old as number)} · ${suffix}`
      }).join('  |  ')
      if (compareText) paragraph(`Período anterior: ${comparisons.range ? `${datePt(comparisons.range.startDate)} a ${datePt(comparisons.range.endDate)}` : 'intervalo equivalente'}. ${compareText}`, 'FONTES', 7.5)
    } else if (comparisons?.status === 'unavailable') {
      paragraph(safe(comparisons.error, 'A API não permitiu um comparativo válido para este intervalo.'), 'FONTES', 7.5)
    } else if (comparisons?.status === 'not_applicable') {
      paragraph(safe(comparisons.error, 'A API não oferece uma comparação temporal compatível para esta métrica.'), 'FONTES', 7.5)
    }
    for (const note of account.limitations || []) paragraph(`• ${note}`, 'FONTES', 7.5)
    y += 3
  }
  if (data.notes?.length) {
    y += 2; title('Consultas com falha ou cobertura parcial', 'LIMITAÇÕES')
    for (const note of data.notes) paragraph(`• ${note}`, 'LIMITAÇÕES', 8)
  }

  newPage('CONTEÚDOS  /  RESPOSTAS DAS APIS')
  title('Publicações e vídeos retornados', 'CONTEÚDOS')
  paragraph('Os registros e contagens abaixo são exatamente os retornados para os filtros selecionados. Para algumas redes, o número por publicação é cumulativo; veja a nota metodológica da conta correspondente.', 'CONTEÚDOS', 8)
  const drawTableHead = () => {
    pdf.setFillColor(...C.navy); pdf.roundedRect(L, y - 3, R - L, 8, 1.2, 1.2, 'F')
    font(true, 6.7); pdf.setTextColor(...C.white); text('CONTEÚDO', L + 2, y + 2); text('CONTA / REDE', 98, y + 2); text('PUBLICADO', 142, y + 2); text('VISUALIZAÇÕES', 171, y + 2, { align: 'right' }); text('INTERAÇÕES', R - 2, y + 2, { align: 'right' }); y += 9
  }
  drawTableHead()
  if (!data.posts.length) paragraph('Nenhuma publicação elegível foi retornada pela API para este filtro.', 'CONTEÚDOS')
  data.posts.forEach((post, index) => {
    const titleLines = lines(safe(post.title), 77, 7)
    const accountLines = lines(`${safe(post.platform)} · ${safe(post.account)}`, 40, 6.5)
    const date = datePt(post.date)
    const rowH = Math.max(10, Math.max(titleLines.length * 3.8, accountLines.length * 3.8) + 4)
    if (y + rowH > BOTTOM) { newPage('CONTEÚDOS  /  CONTINUAÇÃO'); title('Publicações e vídeos (continuação)', 'CONTEÚDOS'); drawTableHead() }
    if (index % 2 === 0) { pdf.setFillColor(246, 249, 251); pdf.rect(L, y - 3, R - L, rowH, 'F') }
    font(false, 7); pdf.setTextColor(...C.ink); titleLines.forEach((line, i) => text(line, L + 2, y + i * 3.8))
    font(false, 6.5); pdf.setTextColor(...C.muted); accountLines.forEach((line, i) => text(line, 98, y + i * 3.8)); text(date, 142, y)
    font(false, 7); pdf.setTextColor(...C.ink); text(fmt(post.views), 171, y, { align: 'right' }); text(fmt(post.interactions), R - 2, y, { align: 'right' }); y += rowH
  })
  y += 6; title('Definições e tratamento', 'MÉTODO')
  const notes = [
    'Indicadores: apresentados separadamente por conta; não são somados entre redes com definições ou bases temporais incompatíveis.',
    'Comparação: somente exibida quando a fonte retornou o intervalo anterior. Contagem de seguidores/inscritos é um retrato atual e não recebe uma variação temporal inventada.',
    'TikTok: métricas públicas por vídeo são contagens acumuladas atuais dos vídeos publicados no intervalo escolhido; não representam atividade ocorrida apenas dentro do período.',
    'Instagram: a disponibilidade de métricas depende da elegibilidade profissional, dos escopos e do limite/atraso da API.',
    'YouTube: relatórios do canal podem ter atraso de processamento; cobertura termina na última data que a API efetivamente retornou.',
    'Dados locais: rascunhos, arquivos, calendário e conteúdo criado neste site não fazem parte das consultas nem deste relatório.',
    'Privacidade: este arquivo é gerado no navegador e baixado localmente; o PDF não é enviado para Instagram, TikTok, YouTube ou para um serviço externo pelo código do relatório.',
  ]
  for (const note of notes) paragraph(`• ${note}`, 'MÉTODO', 7.5)
  footerAll()
  const file = `relatorio-metricas-${(safe(data.filters.platform, 'redes').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'redes')}-${safe(data.reportDate, new Date().toISOString().slice(0, 10))}.pdf`
  pdf.save(file)
}
