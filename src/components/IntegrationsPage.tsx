import { useState } from 'react'
import { ArrowUpRight, ExternalLink, Camera, LockKeyhole, ShieldCheck, Clapperboard, CalendarDays, Sparkles, Terminal } from 'lucide-react'

type Platform = {
  id: string
  name: string
  description: string
  icon: 'instagram' | 'tiktok' | 'youtube' | 'calendar' | 'claude' | 'assistant'
  color: string
  status: 'not-configured' | 'pending'
  docs?: string
}

const platforms: Platform[] = [
  { id: 'meta', name: 'Meta · Instagram', description: 'Instagram profissional via Meta Graph API', icon: 'instagram', color: '#171f8a', status: 'not-configured', docs: 'https://developers.facebook.com/docs/instagram-platform/' },
  { id: 'tiktok', name: 'TikTok', description: 'Integração futura via TikTok for Developers', icon: 'tiktok', color: '#11cfe0', status: 'not-configured', docs: 'https://developers.tiktok.com/doc/' },
  { id: 'youtube', name: 'YouTube', description: 'Canal e publicações pela YouTube Data API', icon: 'youtube', color: '#8ba2c5', status: 'not-configured', docs: 'https://developers.google.com/youtube/v3' },
  { id: 'calendar', name: 'Google Calendar', description: 'Opção futura para consultar ou organizar eventos', icon: 'calendar', color: '#4285f4', status: 'pending' },
  { id: 'claude', name: 'Claude', description: 'Opção futura para integração com o assistente Claude', icon: 'claude', color: '#a65f3d', status: 'pending' },
  { id: 'assistant', name: 'Assistente próprio · API/terminal', description: 'Opção futura para um endpoint de assistente personalizado', icon: 'assistant', color: '#415779', status: 'pending' },
]

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform.icon === 'youtube') return <Clapperboard size={21} aria-hidden="true" />
  if (platform.icon === 'instagram') return <Camera size={21} aria-hidden="true" />
  if (platform.icon === 'calendar') return <CalendarDays size={21} aria-hidden="true" />
  if (platform.icon === 'claude') return <Sparkles size={21} aria-hidden="true" />
  if (platform.icon === 'assistant') return <Terminal size={21} aria-hidden="true" />
  return <span className="integrations-tiktok-mark" aria-hidden="true">♪</span>
}

export default function IntegrationsPage() {
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const showLocalNotice = (platform: Platform) => {
    const message = platform.status === 'pending'
      ? 'Opção futura, ainda não disponível. Servidor, OAuth e credenciais não estão configurados; nenhum dado sai deste dispositivo.'
      : 'Conexão indisponível nesta demonstração. Servidor e OAuth não estão configurados; nenhum dado sai deste dispositivo.'
    setFeedback((current) => ({ ...current, [platform.id]: message }))
  }

  return <main className="integrations-page">
    <style>{`
      .integrations-page{--ip-ink:#172039;--ip-muted:#727b91;--ip-line:#e2e7f0;color:var(--ip-ink);max-width:1180px;margin:0 auto;padding:clamp(24px,4vw,54px);font-family:inherit}
      .integrations-page *{box-sizing:border-box}.integrations-hero{position:relative;overflow:hidden;padding:clamp(25px,4vw,44px);border-radius:24px;color:#fff;background:linear-gradient(120deg,#171f55,#29367f 65%,#4564a8);box-shadow:0 18px 44px #1c28501a}
      .integrations-hero:after{content:"";position:absolute;width:290px;height:290px;right:-80px;top:-120px;border:1px solid #ffffff2b;border-radius:50%;box-shadow:0 0 0 35px #ffffff0c,0 0 0 70px #ffffff08}
      .integrations-eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#b9d7ff;font-weight:700}.integrations-hero h1{font-size:clamp(30px,4vw,46px);line-height:1.02;letter-spacing:-.05em;margin:14px 0 12px;max-width:650px}.integrations-hero p{max-width:680px;margin:0;color:#d4dced;font-size:13px;line-height:1.7}.integrations-secure-note{display:flex;align-items:flex-start;gap:10px;max-width:800px;margin-top:24px;padding:13px 15px;border:1px solid #ffffff25;border-radius:13px;background:#ffffff0c;color:#e7efff;font-size:11px;line-height:1.55}.integrations-secure-note svg{flex:none;color:#9cf0da;margin-top:1px}
      .integrations-section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin:32px 2px 16px}.integrations-section-heading h2{margin:0;font-size:20px;letter-spacing:-.035em}.integrations-section-heading p{margin:5px 0 0;color:var(--ip-muted);font-size:11px}.integrations-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.integrations-card{min-width:0;overflow:hidden;border:1px solid var(--ip-line);border-radius:18px;background:#fff;box-shadow:0 8px 22px #1c285009}.integrations-card-top{padding:20px 20px 17px}.integrations-platform-row{display:flex;align-items:center;gap:12px}.integrations-platform-icon{display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:14px;color:#fff}.integrations-platform-icon svg{stroke-width:2}.integrations-tiktok-mark{font-size:26px;line-height:1;font-weight:800}.integrations-card h3{margin:0;font-size:15px;letter-spacing:-.025em}.integrations-card .integrations-description{margin:4px 0 0;color:var(--ip-muted);font-size:10px;line-height:1.45}.integrations-status{display:inline-flex;align-items:center;gap:7px;margin-top:19px;padding:6px 9px;border-radius:99px;background:#f1f3f7;color:#566178;font-size:9px;font-weight:700}.integrations-status i{width:7px;height:7px;border-radius:50%;background:#9aa4b4}.integrations-status--pending{background:#eef2f8;color:#465775}.integrations-card-bottom{padding:15px 20px 18px;border-top:1px solid #edf0f5}.integrations-card-note{min-height:32px;margin:0;color:#68748a;font-size:10px;line-height:1.5}.integrations-actions{display:flex;gap:8px;margin-top:15px}.integrations-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:7px 12px;border:1px solid #dfe4ed;border-radius:10px;background:#fff;color:#37415a;font:inherit;font-size:10px;font-weight:700;cursor:pointer;transition:background-color .16s,border-color .16s}.integrations-button:hover{border-color:#9aa9c5;background:#f7f9fc}.integrations-button:focus-visible{outline:3px solid #3d68bd;outline-offset:3px}.integrations-button--primary{flex:1;border-color:#25346f;background:#25346f;color:#fff}.integrations-button--primary:hover{background:#34478f}.integrations-inline-feedback{margin:12px 0 0;padding:10px;border-radius:9px;background:#f2f5fa;color:#394967;font-size:10px;line-height:1.5}.integrations-doc-link{display:inline-flex;align-items:center;gap:5px;margin-top:13px;color:#465c9f;text-decoration:none;font-size:9px;font-weight:700}.integrations-doc-link:hover{text-decoration:underline}.integrations-doc-link:focus-visible{outline:3px solid #3d68bd;outline-offset:3px;border-radius:3px}.integrations-footer-note{display:flex;align-items:flex-start;gap:10px;margin-top:20px;padding:14px 16px;border:1px solid #e6eaf1;border-radius:13px;background:#fff;color:#68748a;font-size:10px;line-height:1.55}.integrations-footer-note svg{flex:none;color:#8492ae}
      @media(max-width:850px){.integrations-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:580px){.integrations-page{padding:20px 15px}.integrations-grid{grid-template-columns:1fr}.integrations-section-heading{align-items:flex-start;flex-direction:column}.integrations-hero{border-radius:18px}}
    `}</style>
    <header className="integrations-hero">
      <span className="integrations-eyebrow">Contas e serviços</span>
      <h1>Conectar contas</h1>
      <p>Veja as conexões disponíveis e opções que poderão ser adicionadas no futuro. Esta demonstração é local: nenhuma conta será conectada.</p>
      <div className="integrations-secure-note"><LockKeyhole size={17} aria-hidden="true" /><span>Servidor, OAuth e credenciais não estão configurados. Não informe senhas, tokens, chaves ou endereços de API. Os botões desta página não fazem conexões nem enviam dados: nada sai deste dispositivo.</span></div>
    </header>

    <div className="integrations-section-heading"><div><h2>Contas e integrações</h2><p>As opções futuras estão identificadas como pendentes.</p></div></div>
    <section className="integrations-grid" aria-label="Contas e integrações disponíveis e futuras">
      {platforms.map((platform) => <article className="integrations-card" key={platform.id}>
        <div className="integrations-card-top">
          <div className="integrations-platform-row">
            <div className="integrations-platform-icon" style={{ background: platform.color }}><PlatformIcon platform={platform} /></div>
            <div><h3>{platform.name}</h3><p className="integrations-description">{platform.description}</p></div>
          </div>
          <span className={`integrations-status${platform.status === 'pending' ? ' integrations-status--pending' : ''}`}><i aria-hidden="true" />{platform.status === 'pending' ? 'Pendente · opção futura' : 'Não conectado'}</span>
        </div>
        <div className="integrations-card-bottom">
          <p className="integrations-card-note">{platform.status === 'pending' ? 'Ainda não implementado nesta demonstração.' : 'A conexão não está configurada nesta demonstração.'}</p>
          <div className="integrations-actions">
            <button type="button" className="integrations-button integrations-button--primary" onClick={() => showLocalNotice(platform)}>{platform.status === 'pending' ? 'Ver disponibilidade' : 'Conectar'} <ArrowUpRight size={14} aria-hidden="true" /></button>
          </div>
          {feedback[platform.id] && <p className="integrations-inline-feedback" role="status">{feedback[platform.id]}</p>}
          {platform.docs && <a className="integrations-doc-link" href={platform.docs} target="_blank" rel="noopener noreferrer">Documentação oficial <ExternalLink size={12} aria-hidden="true" /></a>}
        </div>
      </article>)}
    </section>
    <div className="integrations-footer-note"><ShieldCheck size={16} aria-hidden="true" /><span>Os cartões mostram opções possíveis, não conexões ativas. Nenhum OAuth é iniciado e esta página não solicita, armazena ou envia credenciais, tokens, endereços de API ou dados de conta.</span></div>
  </main>
}
