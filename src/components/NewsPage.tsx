import { useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, BookOpen, MapPin, Newspaper, Play, Radio, Search } from 'lucide-react'
import './NewsPage.css'

export type ProgramIdea = { title: string; caption: string; format?: string; hashtags?: string[] }
type NewsPageProps = { onUseModel: (idea: ProgramIdea) => void }

const portalLinks = [
  { label: 'Notícias', detail: 'Acompanhe os acontecimentos da região', href: 'https://entreversotv.com.br/noticias', icon: Newspaper, className: 'entreverso-link--news' },
  { label: 'Episódios', detail: 'Reportagens, conversas e programas', href: 'https://entreversotv.com.br/episodios', icon: Play, className: 'entreverso-link--episodes' },
  { label: 'Entreverso TV', detail: 'Conheça o portal e sua programação', href: 'https://entreversotv.com.br/', icon: Radio, className: 'entreverso-link--home' },
]

const series = [
  { title: 'EntreversoPod', detail: 'Conversas e episódios em formato de podcast', href: 'https://www.youtube.com/playlist?list=PL2DjdMElJJcp8PBZx-JIlg-aYujzdlOgS' },
  { title: 'Entreverso Política', detail: 'Temas públicos e política em debate', href: 'https://www.youtube.com/playlist?list=PL2DjdMElJJcqZt6MlHGpqbus13hwsUZoV' },
  { title: 'Entreverso Cultural', detail: 'Cultura, histórias e expressões da região', href: 'https://www.youtube.com/playlist?list=PL2DjdMElJJcqqHao4dOSmxrABf1yy0sBq' },
  { title: 'Criações Entreverso', detail: 'Documentários, podcasts e memórias', href: 'https://www.youtube.com/playlist?list=PL2DjdMElJJcpGJiOs1Ol2h5HvhVNGwtAb' },
]

const ideas: ProgramIdea[] = [
  { title: 'Resumo em 60 segundos', format: 'Vídeo curto', caption: 'O que aconteceu hoje em Princesa Isabel e região? Em 60 segundos, reunimos os principais fatos. Confira e compartilhe.', hashtags: ['#PrincesaIsabel', '#Paraíba', '#Notícias'] },
  { title: 'Entrevista de 3 perguntas', format: 'Entrevista', caption: 'Três perguntas, uma conversa direta: conheça a história e as ideias de [nome/convidado] sobre [tema local].', hashtags: ['#Entrevista', '#VozesDaRegião'] },
  { title: 'Bastidores da reportagem', format: 'Bastidores', caption: 'Antes da matéria ir ao ar, nossa equipe esteve em [local] para ouvir quem vive essa história. Veja um pouco dos bastidores.', hashtags: ['#Bastidores', '#JornalismoLocal'] },
  { title: 'Serviço da semana', format: 'Utilidade pública', caption: 'Anote na agenda: [serviço ou evento], em [local], no dia [data]. Veja as informações e orientações para participar.', hashtags: ['#Serviço', '#PrincesaIsabel'] },
  { title: 'Memória e arquivo', format: 'Memória', caption: 'Memória da região: você reconhece este lugar ou momento? Relembramos [história/local] e queremos saber suas lembranças.', hashtags: ['#Memória', '#NossaRegião'] },
]

export default function NewsPage({ onUseModel }: NewsPageProps) {
  const [topic, setTopic] = useState('')
  const openExplore = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = topic.trim()
    if (!value) return
    window.open(`https://trends.google.com/trends/explore?geo=BR&q=${encodeURIComponent(value)}`, '_blank', 'noopener,noreferrer')
  }

  return <main className="entreverso-page">
    <header className="entreverso-masthead">
      <div className="entreverso-brand"><span className="entreverso-brand-mark"><Radio size={19} /></span><span className="entreverso-brand-copy"><strong>ENTREVERSO TV</strong><span>Jornalismo · Paraíba</span></span></div>
      <span className="entreverso-live-tag"><i /> Informação da nossa região</span>
    </header>

    <section className="entreverso-hero" aria-labelledby="entreverso-title">
      <div className="entreverso-hero-copy">
        <span className="entreverso-kicker"><Newspaper size={14} /> Notícias que aproximam</span>
        <h1 id="entreverso-title">A Paraíba em <em>perspectiva.</em></h1>
        <p>Um ponto de partida para acompanhar as notícias locais, os episódios e a cobertura do Entreverso TV. Com olhar para Paraíba e atenção especial a Princesa Isabel.</p>
        <a className="entreverso-hero-cta" href="https://entreversotv.com.br/noticias" target="_blank" rel="noopener noreferrer">Abrir notícias <ArrowUpRight size={16} /></a>
      </div>
      <div className="entreverso-hero-art" aria-hidden="true"><span className="entreverso-orbit" /><span className="entreverso-orbit entreverso-orbit--second" /><div className="entreverso-broadcast-card"><Radio size={31} /><strong>ENTREVERSO</strong><span>Olhar local</span></div></div>
    </section>

    <section className="entreverso-context" aria-label="Contexto editorial">
      <article className="entreverso-context-card"><span className="entreverso-context-icon"><BookOpen size={18} /></span><div><h2>Jornalismo de proximidade</h2><p>Notícias da Paraíba e da região de Princesa Isabel, valorizando histórias, serviços e iniciativas que fazem parte do cotidiano local.</p><span className="entreverso-place"><MapPin size={12} /> Princesa Isabel · Paraíba</span></div></article>
      <article className="entreverso-context-card"><span className="entreverso-context-icon"><ArrowDownRight size={18} /></span><div><h2>Explore o portal</h2><p>Acesse diretamente as páginas oficiais do Entreverso TV para ler notícias e acompanhar os episódios.</p></div></article>
    </section>

    <section className="entreverso-links-section" aria-labelledby="entreverso-explore-title">
      <div className="entreverso-section-head"><div><h2 id="entreverso-explore-title">Explore Entreverso TV</h2><p>Atalhos para as páginas oficiais do portal.</p></div></div>
      <div className="entreverso-link-grid">{portalLinks.map(({ label, detail, href, icon: Icon, className }) => <a className={`entreverso-link-card ${className}`} href={href} key={label} target="_blank" rel="noopener noreferrer"><span className="entreverso-link-icon"><Icon size={17} /></span><strong>{label}</strong><span>{detail}</span><ArrowUpRight className="entreverso-link-arrow" size={15} /></a>)}</div>
      <p className="entreverso-disclaimer">Entreverso TV é uma fonte externa e independente deste aplicativo. <a className="entreverso-bottom-link" href="https://entreversotv.com.br/" target="_blank" rel="noopener noreferrer">Visitar o site oficial <ArrowUpRight size={12} /></a></p>
    </section>

    <section className="entreverso-links-section" aria-labelledby="channel-title">
      <div className="entreverso-section-head"><div><h2 id="channel-title">Canal e séries no YouTube</h2><p>Acesse o canal oficial e suas playlists temáticas.</p></div></div>
      <a className="entreverso-channel" href="https://www.youtube.com/@entreversotv" target="_blank" rel="noopener noreferrer"><span className="entreverso-link-icon"><Play size={19} /></span><span><strong>Canal oficial: @entreversotv</strong><small>Notícias, cultura e política de Princesa Isabel e do sertão da Paraíba e Pernambuco.</small></span><ArrowUpRight size={16} /></a>
      <div className="entreverso-series-grid">{series.map(item => <a className="entreverso-series-card" key={item.title} href={item.href} target="_blank" rel="noopener noreferrer"><strong>{item.title}</strong><span>{item.detail}</span><span className="entreverso-series-link">Ver playlist <ArrowUpRight size={13} /></span></a>)}</div>
    </section>

    <section className="entreverso-trends" aria-labelledby="trends-title">
      <div className="entreverso-section-head"><div><span className="entreverso-kicker trends-kicker">PAUTA E CONTEXTO</span><h2 id="trends-title">Tendências no Google</h2><p>Consulte os assuntos em alta diretamente na fonte oficial.</p></div></div>
      <div className="entreverso-trends-panel"><div><strong>Explore um tema</strong><p>Pesquise um tópico no Google Trends Brasil.</p></div><form className="entreverso-search" onSubmit={openExplore}><label htmlFor="trend-topic">Tema para explorar</label><div><input id="trend-topic" value={topic} onChange={event => setTopic(event.target.value)} placeholder="Ex.: cultura, chuva, futebol" /><button type="submit" disabled={!topic.trim()}><Search size={16} /> Explorar</button></div></form><a className="entreverso-official-link" href="https://trends.google.com/trending?geo=BR" target="_blank" rel="noopener noreferrer">Abrir tendências ao vivo no Google <ArrowUpRight size={15} /></a></div>
      <p className="entreverso-disclaimer">Os dados ao vivo são exibidos na página oficial do Google Trends. Esta página não coleta nem reproduz tendências.</p>
    </section>

    <section className="entreverso-links-section" aria-labelledby="ideas-title">
      <div className="entreverso-section-head"><div><h2 id="ideas-title">Modelos de programa</h2><p>Ideias editoriais adaptáveis para uma cobertura local — não são tendências ao vivo.</p></div></div>
      <div className="entreverso-ideas-grid">{ideas.map(idea => <article className="entreverso-idea-card" key={idea.title}><span className="entreverso-idea-format">{idea.format}</span><h3>{idea.title}</h3><p>{idea.caption}</p><div className="entreverso-hashtags">{idea.hashtags?.map(tag => <span key={tag}>{tag}</span>)}</div><button type="button" className="entreverso-use-button" onClick={() => onUseModel(idea)}>Usar modelo <ArrowDownRight size={15} /></button></article>)}</div>
    </section>
  </main>
}
