import { jsPDF } from 'jspdf'

export type InsightsPlatform = 'Instagram' | 'TikTok' | 'YouTube' | string

export type InsightsReportData = {
  title: string
  account: string
  /** Ex.: "Últimos 28 dias" ou "De 01/10/2026 a 28/10/2026". */
  range: string
  /** Data de emissão opcional, em YYYY-MM-DD. */
  reportDate?: string
  /** Filtros efetivamente aplicados; não se infere estado da interface. */
  filters: { platform: string }
  metrics: {
    views: number
    reach: number
    interactions: number
    followers: number
    /** Texto tal como apresentado na interface, ex. "+12,4%". */
    comparisons?: Partial<Record<'views' | 'reach' | 'interactions' | 'followers', string>>
  }
  /** Valores exibidos por plataforma, incluindo apenas as colunas que o chamador possui. */
  platforms: Array<{
    name: InsightsPlatform
    views: number
    reach?: number
    interactions?: number
    followers?: number
  }>
  /** Ordem de exibição fornecida pelo chamador (por exemplo, classificação de destaque). */
  posts: Array<{
    title: string
    platform: InsightsPlatform
    views: number
    interactions: number
    date: string
  }>
  /** Pontos já calculados para o intervalo selecionado; não representam coleta diária. */
  series: Array<{ label: string; value: number }>
}

const C = {
  navy: [23, 31, 138] as [number, number, number],
  cyan: [17, 174, 187] as [number, number, number],
  pale: [231, 249, 250] as [number, number, number],
  ink: [21, 28, 57] as [number, number, number],
  muted: [103, 112, 137] as [number, number, number],
  line: [220, 228, 240] as [number, number, number],
  cool: [139, 162, 197] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}
const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const safe = (s: string | undefined | null, fallback = '—') => s?.trim() || fallback
const datePt = (s?: string) => {
  if (!s) return new Date().toLocaleDateString('pt-BR')
  const d = new Date(`${s}T12:00:00`)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR')
}

export async function downloadFullInsightsReport(data: InsightsReportData): Promise<void> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, L = 18, R = 192, CONTENT_BOTTOM = 270
  let y = 0
  const totalPages = () => pdf.getNumberOfPages()
  const setFont = (bold = false, size = 9) => { pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size) }
  const text = (value: string, x: number, yy: number, opts?: Parameters<typeof pdf.text>[3]) => pdf.text(value, x, yy, opts)
  const wrapped = (value: string, width: number, size = 9, bold = false) => {
    setFont(bold, size)
    return pdf.splitTextToSize(String(value ?? ''), width) as string[]
  }
  const header = (section: string) => {
    pdf.setFillColor(...C.navy); pdf.rect(0, 0, W, 21, 'F')
    setFont(true, 9); pdf.setTextColor(...C.white); text('PLANEJADOR DE CONTEÚDO  /  RELATÓRIO DEMONSTRATIVO', L, 9)
    setFont(false, 8); pdf.setTextColor(205, 224, 245); text(section, L, 16)
    y = 31
  }
  const footerAll = () => {
    const pages = totalPages()
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p); pdf.setDrawColor(...C.line); pdf.setLineWidth(.25); pdf.line(L, 279, R, 279)
      setFont(false, 7.5); pdf.setTextColor(...C.muted)
      text('Dados demonstrativos • Relatório de exemplo', L, 285)
      text(`${String(p).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`, R, 285, { align: 'right' })
    }
  }
  const newPage = (section: string) => { pdf.addPage(); header(section) }
  const ensure = (height: number, section: string) => { if (y + height > CONTENT_BOTTOM) newPage(section) }
  const sectionTitle = (title: string, section: string) => {
    ensure(13, section); setFont(true, 14); pdf.setTextColor(...C.ink); text(title, L, y); y += 8
    pdf.setDrawColor(...C.cyan); pdf.setLineWidth(.8); pdf.line(L, y, L + 17, y); y += 7
  }
  const paragraph = (value: string, width = R - L, size = 9, color = C.muted, section = 'DETALHAMENTO') => {
    const lines = wrapped(value, width, size); const lineH = size * .48 + 1.2
    for (const line of lines) { ensure(lineH, section); setFont(false, size); pdf.setTextColor(...color); text(line, L, y); y += lineH }
  }
  const card = (x: number, label: string, value: number, comparison?: string) => {
    pdf.setDrawColor(...C.line); pdf.setFillColor(...C.white); pdf.roundedRect(x, y, 41, 31, 2.5, 2.5, 'FD')
    pdf.setFillColor(...C.cyan); pdf.rect(x, y + 2, 1.2, 27, 'F')
    setFont(false, 7.5); pdf.setTextColor(...C.muted); text(label, x + 4, y + 8)
    setFont(true, 13); pdf.setTextColor(...C.ink); text(fmt(value), x + 4, y + 18)
    if (comparison) { setFont(true, 7); pdf.setTextColor(...C.navy); text(comparison, x + 4, y + 25) }
  }
  const date = datePt(data.reportDate)
  const filterText = safe(data.filters?.platform, 'Todas as plataformas')

  // Abertura e sumário dos quatro indicadores.
  pdf.setFillColor(...C.navy); pdf.rect(0, 0, W, 91, 'F')
  pdf.setDrawColor(82, 107, 196); pdf.setLineWidth(.35); pdf.circle(181, 24, 10); pdf.circle(181, 24, 18)
  pdf.setFillColor(...C.cyan); pdf.circle(181, 24, 2.4, 'F')
  setFont(true, 9); pdf.setTextColor(185, 230, 239); text('PLANEJADOR DE CONTEÚDO  /  MÉTRICAS', L, 20)
  setFont(true, 24); pdf.setTextColor(...C.white)
  const titleLines = wrapped(safe(data.title, 'Relatório de desempenho'), 155, 24, true)
  let titleY = 42
  titleLines.slice(0, 2).forEach(line => { text(line, L, titleY); titleY += 10 })
  setFont(false, 11); pdf.setTextColor(220, 231, 251); text(safe(data.account, 'Conta não informada'), L, 66)
  setFont(false, 9); text(`${safe(data.range)}  •  ${filterText}`, L, 75)
  text(`Emitido em ${date}`, L, 83)
  pdf.setFillColor(...C.pale); pdf.roundedRect(L, 100, R - L, 19, 2.5, 2.5, 'F')
  setFont(true, 9); pdf.setTextColor(...C.navy); text('ATENÇÃO — DADOS DEMONSTRATIVOS', L + 5, 107)
  setFont(false, 8); pdf.setTextColor(...C.ink)
  const disclaimer = wrapped('Números de exemplo para demonstração da interface. Nenhuma conta está conectada e nenhum dado real de plataforma é exibido.', R - L - 10, 8)
  disclaimer.slice(0, 2).forEach((line, i) => text(line, L + 5, 113 + i * 4))
  y = 133; sectionTitle('Indicadores do período', 'VISÃO GERAL')
  const metricLabels = [['Visualizações', data.metrics.views, data.metrics.comparisons?.views], ['Alcance', data.metrics.reach, data.metrics.comparisons?.reach], ['Interações', data.metrics.interactions, data.metrics.comparisons?.interactions], ['Seguidores', data.metrics.followers, data.metrics.comparisons?.followers]] as const
  metricLabels.forEach((m, i) => card(L + i * 43.5, m[0], m[1], m[2]))
  y += 39
  paragraph('As variações comparam o intervalo selecionado com o período anterior de igual duração, usando somente os dados demonstrativos recebidos. Elas não representam medições externas.', R - L, 8, C.muted, 'VISÃO GERAL')
  y += 6
  sectionTitle('Como interpretar', 'VISÃO GERAL')
  paragraph('Este documento reúne os valores e os rótulos de intervalo recebidos pela função de exportação. A série temporal é ilustrativa e seus pontos não devem ser interpretados como medições diárias ou dados provenientes de APIs.', R - L, 9, C.ink, 'VISÃO GERAL')

  // Tendência vetorial e plataformas.
  newPage('DESEMPENHO  /  TENDÊNCIA E PLATAFORMAS')
  sectionTitle('Ritmo de visualizações', 'DESEMPENHO')
  paragraph(`Tendência demonstrativa no intervalo: ${safe(data.range)}. Os pontos seguem exatamente a série recebida.`, R - L, 8, C.muted, 'DESEMPENHO')
  const chartX = L + 10, chartY = y + 5, chartW = R - L - 18, chartH = 57
  const vals = data.series.map(p => Number.isFinite(p.value) ? p.value : 0)
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals), span = Math.max(1, max - min)
  pdf.setDrawColor(...C.line); pdf.setLineWidth(.25)
  for (let g = 0; g < 4; g++) { const gy = chartY + g * chartH / 3; pdf.line(chartX, gy, chartX + chartW, gy); setFont(false, 7); pdf.setTextColor(...C.muted); text(fmt(Math.round(max - g * max / 3)), L, gy + 1) }
  if (data.series.length === 1) {
    const py = chartY + chartH - ((vals[0] - min) / span) * chartH
    pdf.setFillColor(...C.navy); pdf.circle(chartX + chartW / 2, py, 1.5, 'F')
  } else if (data.series.length > 1) {
    const pts = vals.map((v, i) => [chartX + i * chartW / (vals.length - 1), chartY + chartH - ((v - min) / span) * chartH] as [number, number])
    pdf.setDrawColor(...C.cyan); pdf.setLineWidth(1.15)
    for (let i = 1; i < pts.length; i++) pdf.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
    pdf.setFillColor(...C.navy); pts.forEach(([x, py]) => pdf.circle(x, py, .9, 'F'))
  }
  setFont(false, 7); pdf.setTextColor(...C.muted)
  if (data.series.length) { text(safe(data.series[0].label, 'Início'), chartX, chartY + chartH + 6); text(safe(data.series[data.series.length - 1].label, 'Fim'), chartX + chartW, chartY + chartH + 6, { align: 'right' }) }
  else text('Sem pontos de série fornecidos', chartX, chartY + chartH + 6)
  y = chartY + chartH + 17
  sectionTitle('Resumo por plataforma', 'DESEMPENHO')
  if (!data.platforms.length) paragraph('Nenhum dado de plataforma foi fornecido.', R - L, 8, C.muted, 'DESEMPENHO')
  for (const p of data.platforms) {
    const valsText = [`Visualizações ${fmt(p.views)}`, p.reach == null ? '' : `Alcance ${fmt(p.reach)}`, p.interactions == null ? '' : `Interações ${fmt(p.interactions)}`, p.followers == null ? '' : `Seguidores ${fmt(p.followers)}`].filter(Boolean).join('  ·  ')
    const nameLines = wrapped(safe(p.name), 39, 8, true), detailLines = wrapped(valsText, 125, 7.5)
    const rowH = Math.max(nameLines.length, detailLines.length) * 4.5 + 5
    ensure(rowH, 'DESEMPENHO  /  PLATAFORMAS')
    pdf.setFillColor(246, 248, 252); pdf.roundedRect(L, y - 3, R - L, rowH, 1.5, 1.5, 'F')
    const platformColor = p.name === 'TikTok' ? C.cyan : p.name === 'YouTube' ? C.cool : C.navy
    pdf.setFillColor(...platformColor); pdf.circle(L + 4, y + 1, 1.2, 'F')
    setFont(true, 8); pdf.setTextColor(...C.ink); nameLines.forEach((line, i) => text(line, L + 8, y + i * 4.5))
    setFont(false, 7.5); pdf.setTextColor(...C.muted); detailLines.forEach((line, i) => text(line, L + 49, y + i * 4.5))
    y += rowH + 2
  }

  // Tabela com quebra por linha e repetição de cabeçalho nas novas páginas.
  newPage('CONTEÚDO  /  MÉTODOS E DEFINIÇÕES')
  sectionTitle('Conteúdos em destaque', 'CONTEÚDOS')
  const drawTableHeader = () => {
    pdf.setFillColor(...C.navy); pdf.roundedRect(L, y - 4, R - L, 9, 1.5, 1.5, 'F')
    setFont(true, 7); pdf.setTextColor(...C.white)
    text('CONTEÚDO', L + 3, y + 1); text('PLATAFORMA', 111, y + 1); text('PUBLICADO', 139, y + 1); text('VIEWS', 165, y + 1, { align: 'right' }); text('INTERAÇÕES', R - 3, y + 1, { align: 'right' }); y += 9
  }
  drawTableHeader()
  if (!data.posts.length) paragraph('Nenhum conteúdo foi fornecido.', R - L, 8, C.muted, 'CONTEÚDOS')
  data.posts.forEach((post, idx) => {
    const titleLines = wrapped(safe(post.title), 78, 8)
    const platformLines = wrapped(safe(post.platform), 25, 7)
    const dateLines = wrapped(safe(post.date), 20, 7)
    const lineCount = Math.max(titleLines.length, platformLines.length, dateLines.length)
    const rowH = Math.max(11, lineCount * 4.2 + 4)
    if (y + rowH > CONTENT_BOTTOM) { newPage('CONTEÚDO  /  CONTINUAÇÃO'); sectionTitle('Conteúdos em destaque (continuação)', 'CONTEÚDOS'); drawTableHeader() }
    if (idx % 2 === 0) { pdf.setFillColor(247, 249, 252); pdf.rect(L, y - 4, R - L, rowH, 'F') }
    setFont(false, 8); pdf.setTextColor(...C.ink); titleLines.forEach((line, i) => text(line, L + 3, y + i * 4.2))
    setFont(false, 7); pdf.setTextColor(...C.muted); platformLines.forEach((line, i) => text(line, 111, y + i * 4.2)); dateLines.forEach((line, i) => text(line, 139, y + i * 4.2))
    setFont(false, 7.5); pdf.setTextColor(...C.ink); text(fmt(post.views), 165, y, { align: 'right' }); text(fmt(post.interactions), R - 3, y, { align: 'right' })
    y += rowH
  })
  y += 8; sectionTitle('Definições e notas metodológicas', 'MÉTODOS')
  const notes: Array<[string, string]> = [
    ['Visualizações', 'Total de visualizações informado na entrada; é uma contagem, não uma estimativa de pessoas únicas.'],
    ['Alcance', 'Valor de alcance informado pelo chamador. A definição pode variar conforme plataforma; não é recalculado neste relatório.'],
    ['Interações', 'Contagem de interações fornecida pela entrada; não é derivada de visualizações ou alcance.'],
    ['Seguidores', 'Retrato demonstrativo da contagem na data final do intervalo. A comparação contrasta com a data final do período anterior e não representa crescimento líquido validado.'],
    ['Comparações', 'Percentuais calculados pelo painel para o período anterior de duração equivalente, usando dados demonstrativos. Não são resultados oficiais das plataformas.'],
    ['Série temporal', 'Gráfico vetorial que representa os valores e rótulos recebidos, em ordem. Não são interpolados nem atribuídos valores diários.'],
    ['Dados e conexão', 'Relatório de caráter demonstrativo. Não há conexão com redes sociais, chamadas de API ou validação externa dos números.'],
  ]
  for (const [label, desc] of notes) {
    const ls = wrapped(desc, R - L - 34, 8), rowH = Math.max(8, ls.length * 4.5 + 3)
    ensure(rowH, 'MÉTODOS  /  DEFINIÇÕES')
    setFont(true, 8); pdf.setTextColor(...C.navy); text(label, L, y)
    setFont(false, 8); pdf.setTextColor(...C.ink); ls.forEach((line, i) => text(line, L + 34, y + i * 4.5))
    y += rowH
  }
  footerAll()
  const file = `relatorio-insights-${(safe(data.account, 'conta').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'conta')}.pdf`
  pdf.save(file)
}
