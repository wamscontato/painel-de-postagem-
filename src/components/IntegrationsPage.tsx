import { useState } from 'react'
import { ArrowUpRight, Check, ExternalLink, Camera, LockKeyhole, Settings2, ShieldCheck, Clapperboard } from 'lucide-react'

type Platform = {
  id: string
  name: string
  short: string
  description: string
  icon: 'instagram' | 'tiktok' | 'youtube'
  color: string
  scopes: string[]
  docs: string
}

const platforms: Platform[] = [
  { id: 'meta', name: 'Meta · Instagram', short: 'META', description: 'Instagram profissional via Meta Graph API', icon: 'instagram', color: '#171f8a', scopes: ['Perfil básico', 'Publicação de conteúdo', 'Insights'], docs: 'https://developers.facebook.com/docs/instagram-platform/' },
  { id: 'tiktok', name: 'TikTok', short: 'TIKTOK', description: 'Publicação e leitura de perfil via TikTok for Developers', icon: 'tiktok', color: '#11cfe0', scopes: ['Informações do usuário', 'Publicação de vídeos'], docs: 'https://developers.tiktok.com/doc/' },
  { id: 'youtube', name: 'YouTube', short: 'YT', description: 'Canal e publicações pela YouTube Data API', icon: 'youtube', color: '#8ba2c5', scopes: ['Visualizar canal', 'Gerenciar vídeos'], docs: 'https://developers.google.com/youtube/v3' },
]

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform.icon === 'youtube') return <Clapperboard size={21} />
  if (platform.icon === 'instagram') return <Camera size={21} />
  return <span className="integrations-tiktok-mark" aria-hidden="true">♪</span>
}

export default function IntegrationsPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [clientIds, setClientIds] = useState<Record<string, string>>({})
  const [callbacks, setCallbacks] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const configure = (platform: Platform) => {
    setSelected(selected === platform.id ? null : platform.id)
    setFeedback((current) => ({ ...current, [platform.id]: 'Configuração demonstrativa aberta. Nada será enviado ou salvo.' }))
  }

  const saveSettings = (platform: Platform) => {
    setFeedback((current) => ({ ...current, [platform.id]: 'Valores mantidos apenas nesta sessão; configure o backend seguro antes de usar OAuth.' }))
  }

  return <main className="integrations-page">
    <style>{`
      .integrations-page{--ip-ink:#172039;--ip-muted:#727b91;--ip-line:#e2e7f0;--ip-bg:#f5f7fb;color:var(--ip-ink);max-width:1180px;margin:0 auto;padding:clamp(24px,4vw,54px);font-family:inherit}
      .integrations-page *{box-sizing:border-box}.integrations-hero{position:relative;overflow:hidden;padding:clamp(25px,4vw,44px);border-radius:24px;color:#fff;background:linear-gradient(120deg,#171f55,#29367f 65%,#4564a8);box-shadow:0 18px 44px #1c28501a}
      .integrations-hero:after{content:"";position:absolute;width:290px;height:290px;right:-80px;top:-120px;border:1px solid #ffffff2b;border-radius:50%;box-shadow:0 0 0 35px #ffffff0c,0 0 0 70px #ffffff08}
      .integrations-eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#b9d7ff;font-weight:700}.integrations-hero h1{font-size:clamp(30px,4vw,46px);line-height:1.02;letter-spacing:-.05em;margin:14px 0 12px;max-width:650px}.integrations-hero p{max-width:680px;margin:0;color:#d4dced;font-size:13px;line-height:1.7}.integrations-secure-note{display:flex;align-items:flex-start;gap:10px;max-width:800px;margin-top:24px;padding:13px 15px;border:1px solid #ffffff25;border-radius:13px;background:#ffffff0c;color:#e7efff;font-size:11px;line-height:1.55}.integrations-secure-note svg{flex:none;color:#9cf0da;margin-top:1px}
      .integrations-section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin:32px 2px 16px}.integrations-section-heading h2{margin:0;font-size:20px;letter-spacing:-.035em}.integrations-section-heading p{margin:5px 0 0;color:var(--ip-muted);font-size:11px}.integrations-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.integrations-card{min-width:0;overflow:hidden;border:1px solid var(--ip-line);border-radius:18px;background:#fff;box-shadow:0 8px 22px #1c285009}.integrations-card-top{padding:20px 20px 17px}.integrations-platform-row{display:flex;align-items:center;gap:12px}.integrations-platform-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:#fff}.integrations-platform-icon svg{stroke-width:2}.integrations-tiktok-mark{font-size:26px;line-height:1;font-weight:800}.integrations-card h3{margin:0;font-size:15px;letter-spacing:-.025em}.integrations-card .integrations-description{margin:4px 0 0;color:var(--ip-muted);font-size:10px;line-height:1.45}.integrations-status{display:inline-flex;align-items:center;gap:7px;margin-top:19px;padding:6px 9px;border-radius:99px;background:#f1f3f7;color:#657087;font-size:9px;font-weight:700}.integrations-status i{width:7px;height:7px;border-radius:50%;background:#9aa4b4}.integrations-card-bottom{padding:15px 20px 18px;border-top:1px solid #edf0f5}.integrations-label{display:block;margin-bottom:8px;color:#758096;font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}.integrations-scopes{display:flex;flex-wrap:wrap;gap:6px;min-height:39px}.integrations-scope{padding:5px 7px;border:1px solid #e8ebf1;border-radius:7px;color:#556078;background:#fafbfc;font-size:9px}.integrations-actions{display:flex;gap:8px;margin-top:18px}.integrations-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 12px;border:1px solid #dfe4ed;border-radius:10px;background:#fff;color:#37415a;font:inherit;font-size:10px;font-weight:700;cursor:pointer;transition:.16s}.integrations-button:hover{transform:translateY(-1px);border-color:#9aa9c5}.integrations-button--primary{flex:1;border-color:#25346f;background:#25346f;color:#fff}.integrations-button--primary:hover{background:#34478f}.integrations-inline-feedback{margin:12px 0 0;color:#516182;font-size:10px;line-height:1.45}.integrations-config{padding:17px 20px 20px;border-top:1px solid var(--ip-line);background:#fbfcfe}.integrations-config-heading{display:flex;align-items:center;gap:7px;margin:0 0 13px;font-size:11px;font-weight:700}.integrations-field{display:block;margin:0 0 11px}.integrations-field span{display:block;margin-bottom:5px;color:#59647b;font-size:9px;font-weight:700}.integrations-field input{width:100%;height:36px;padding:0 10px;border:1px solid #dfe4ed;border-radius:8px;background:#fff;color:#1c2743;font:inherit;font-size:10px}.integrations-field input::placeholder{color:#a0a8b7}.integrations-save{width:100%;margin-top:2px}.integrations-config-hint{display:block;margin-top:9px;color:#8992a3;font-size:9px;line-height:1.5}.integrations-doc-link{display:inline-flex;align-items:center;gap:5px;margin-top:13px;color:#465c9f;text-decoration:none;font-size:9px;font-weight:700}.integrations-doc-link:hover{text-decoration:underline}.integrations-footer-note{display:flex;align-items:flex-start;gap:10px;margin-top:20px;padding:14px 16px;border:1px solid #e6eaf1;border-radius:13px;background:#fff;color:#68748a;font-size:10px;line-height:1.55}.integrations-footer-note svg{flex:none;color:#8492ae}
      @media(max-width:850px){.integrations-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:580px){.integrations-page{padding:20px 15px}.integrations-grid{grid-template-columns:1fr}.integrations-section-heading{align-items:flex-start;flex-direction:column}.integrations-hero{border-radius:18px}}
    `}</style>
    <header className="integrations-hero">
      <span className="integrations-eyebrow">Canais sociais · integrações</span>
      <h1>Conecte seus canais, com segurança.</h1>
      <p>Prepare as configurações de Meta/Instagram, TikTok e YouTube. Esta tela é apenas uma interface demonstrativa: nenhuma conta será conectada por aqui.</p>
      <div className="integrations-secure-note"><LockKeyhole size={17} /><span>Uma conexão real exige implementação de OAuth em backend seguro e credenciais válidas de um app de desenvolvedor. Não informe senhas, tokens ou segredos nesta tela.</span></div>
    </header>

    <div className="integrations-section-heading"><div><h2>Seus canais</h2><p>Revise os escopos e prepare os dados públicos do aplicativo.</p></div></div>
    <section className="integrations-grid" aria-label="Plataformas sociais">
      {platforms.map((platform) => <article className="integrations-card" key={platform.id}>
        <div className="integrations-card-top">
          <div className="integrations-platform-row">
            <div className="integrations-platform-icon" style={{ background: platform.color }}><PlatformIcon platform={platform} /></div>
            <div><h3>{platform.name}</h3><p className="integrations-description">{platform.description}</p></div>
          </div>
          <span className="integrations-status"><i /> Desconectado</span>
        </div>
        <div className="integrations-card-bottom">
          <span className="integrations-label">Escopos previstos · resumo</span>
          <div className="integrations-scopes">{platform.scopes.map((scope) => <span className="integrations-scope" key={scope}>{scope}</span>)}</div>
          <div className="integrations-actions">
            <button type="button" className="integrations-button" onClick={() => configure(platform)}><Settings2 size={14} /> Configurar</button>
            <button type="button" className="integrations-button integrations-button--primary" onClick={() => setFeedback((current) => ({ ...current, [platform.id]: 'Conexão pendente: configure o OAuth seguro no backend antes de conectar.' }))}>Conectar <ArrowUpRight size={14} /></button>
          </div>
          {feedback[platform.id] && <p className="integrations-inline-feedback" role="status">{feedback[platform.id]}</p>}
          <a className="integrations-doc-link" href={platform.docs} target="_blank" rel="noopener noreferrer">Documentação oficial <ExternalLink size={12} /></a>
        </div>
        {selected === platform.id && <div className="integrations-config">
          <p className="integrations-config-heading"><Settings2 size={14} /> Configuração do aplicativo</p>
          <label className="integrations-field"><span>Client/App ID</span><input value={clientIds[platform.id] ?? ''} onChange={(event) => setClientIds((current) => ({ ...current, [platform.id]: event.target.value }))} placeholder="ID público do app" autoComplete="off" /></label>
          <label className="integrations-field"><span>URL de callback / redirect URI</span><input value={callbacks[platform.id] ?? ''} onChange={(event) => setCallbacks((current) => ({ ...current, [platform.id]: event.target.value }))} placeholder="https://seu-dominio.com/oauth/callback" autoComplete="off" /></label>
          <button type="button" className="integrations-button integrations-button--primary integrations-save" onClick={() => saveSettings(platform)}><Check size={14} /> Aplicar nesta sessão</button>
          <small className="integrations-config-hint">Client ID e callback ficam somente na memória desta sessão e não são enviados nem gravados. Cadastre o callback também no painel oficial do desenvolvedor. Nunca use client_secret no navegador.</small>
        </div>}
      </article>)}
    </section>
    <div className="integrations-footer-note"><ShieldCheck size={16} /><span>Os escopos exibidos são um resumo ilustrativo; permissões e revisão variam por plataforma e tipo de app. Esta demonstração não solicita nem armazena tokens, credenciais secretas ou dados de conta.</span></div>
  </main>
}
