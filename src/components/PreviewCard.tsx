import { useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Send, Bookmark, Play, Link2, BarChart3 } from 'lucide-react'
import type { MediaItem } from './MediaManager'

export function PreviewCard({ format, platform = 'Instagram', aspectRatio = '4:5', media, caption, location, profileName, profileHandle, hashtags, showPoll, showLink }: { format: string; platform?: string; aspectRatio?: string; media: MediaItem[]; caption: string; location: string; profileName: string; profileHandle: string; hashtags: string[]; showPoll?: boolean; showLink?: boolean }) {
  const [active, setActive] = useState(0)
  const current = media[active % Math.max(1, media.length)]
  const isVertical = format === 'story' || format === 'reel'
  return <section className={`preview-stage ${isVertical ? 'preview-stage--vertical' : ''}`} aria-label="Pré-visualização da publicação">
    <div className="preview-stage-heading"><div><span className="eyebrow">03 / prévia ao vivo</span><h2>Como fica no {platform}</h2></div><span className="live-pill"><span className="status-dot" /> local</span></div>
    <div className="phone-frame">
      <div className="phone-topbar"><span className="phone-notch" /><span className="phone-time">9:41</span><span className="phone-signal">● ● ●</span></div>
      {isVertical ? <div className="story-preview"><img src={current?.src} alt="Prévia da mídia" /><div className="story-progress"><i /><i /><i /></div><div className="story-head"><div className="profile-avatar">{profileName.slice(0, 1)}</div><strong>{profileHandle}</strong><span>8h</span><MoreHorizontal size={16} /></div>{showLink && <div className="story-link-sticker"><Link2 size={15} /> Conferir agora</div>}{showPoll && <div className="story-poll"><span>Qual combina mais com você?</span><button>Manhã</button><button>Noite</button></div>}{format === 'reel' && <div className="reel-play"><Play size={28} fill="white" /></div>}<div className="story-reply">Enviar mensagem <Send size={14} /></div></div> : <div className="feed-preview"><div className="feed-head"><div className="profile-avatar">{profileName.slice(0, 1)}</div><div><strong>{profileHandle}</strong><span>{location || 'Estúdio Social'}</span></div><MoreHorizontal size={17} /></div><div className="feed-media" style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}><img src={current?.src} alt="Prévia da mídia" />{media.length > 1 && <><button className="preview-arrow preview-arrow--left" onClick={() => setActive((value) => (value - 1 + media.length) % media.length)} aria-label="Imagem anterior"><ChevronLeft size={16} /></button><button className="preview-arrow preview-arrow--right" onClick={() => setActive((value) => (value + 1) % media.length)} aria-label="Próxima imagem"><ChevronRight size={16} /></button><span className="carousel-counter">{active + 1}/{media.length}</span></>}</div><div className="feed-actions"><div><Heart size={18} /><MessageCircle size={18} /><Send size={18} /></div><Bookmark size={18} /></div><div className="likes-line">142 curtidas</div><p className="caption-line"><strong>{profileHandle}</strong> {caption || 'Sua legenda aparece aqui com todo o contexto da publicação.'}</p>{hashtags.length > 0 && <p className="hashtag-line">{hashtags.map((tag) => `#${tag}`).join(' ')}</p>}<span className="caption-time">agora · visualização local</span></div>}
      <div className="phone-home" />
    </div>
    <div className="preview-footnote"><BarChart3 size={15} /> Preview ilustrativo. Nada é enviado para o Instagram.</div>
  </section>
}
