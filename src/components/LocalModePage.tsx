import { ArrowRight, Bot, CalendarDays, Download, LockKeyhole, RadioTower, ShieldCheck, Sparkles } from 'lucide-react'
import './LocalModePage.css'

type Props = { onConnectAccounts: () => void }

const futureConnections = [
  { title: 'Claude', description: 'Preparar um conector de leitura do painel para usar em um assistente.', icon: Bot },
  { title: 'API própria ou terminal', description: 'Definir um endpoint seguro para um chatbot consultar informações selecionadas.', icon: RadioTower },
]

export function LocalModePage({ onConnectAccounts }: Props) {
  return <main className="local-mode-page">
    <header className="local-mode-hero">
      <div className="local-mode-hero-mark"><Sparkles size={22} /></div>
      <div><span className="local-mode-eyebrow">privacidade e conexões</span><h1>Seu espaço continua local.</h1><p>As alterações ficam neste navegador. Nenhum dado é enviado a serviços externos sem uma integração configurada e autorizada.</p></div>
    </header>

    <section className="local-mode-status" aria-label="Status do espaço local">
      <div className="local-mode-status-icon"><ShieldCheck size={21} /></div>
      <div className="local-mode-status-copy"><strong>Modo local ativo</strong><span>Sem servidor, banco remoto ou tokens de conta conectados.</span></div>
      <span className="local-mode-badge"><i /> Neste dispositivo</span>
    </section>

    <section className="local-mode-grid" aria-label="Armazenamento local">
      <article className="local-mode-card"><div className="local-mode-card-icon"><CalendarDays size={18} /></div><h2>Seu trabalho permanece aqui</h2><p>Calendário, tarefas, rascunhos, biblioteca e modelos são guardados no armazenamento deste navegador.</p><span className="local-mode-card-foot">IndexedDB · com fallback local</span></article>
      <article className="local-mode-card"><div className="local-mode-card-icon"><LockKeyhole size={18} /></div><h2>Contas externas</h2><p>Instagram, TikTok, YouTube e Google Agenda estão desconectados. Esta versão não guarda chaves, senhas ou tokens.</p><button type="button" className="local-mode-link-button" onClick={onConnectAccounts}>Ver conexões disponíveis <ArrowRight size={15} /></button></article>
    </section>

    <section className="local-mode-connectors" aria-labelledby="local-mode-connectors-title">
      <div className="local-mode-section-heading"><div><span className="local-mode-eyebrow">próxima etapa</span><h2 id="local-mode-connectors-title">Assistentes e API própria</h2><p>Conexões preparadas para uma futura configuração. Continuam desativadas por escolha.</p></div><span className="local-mode-pending">Pendente</span></div>
      <div className="local-mode-connector-grid">{futureConnections.map(({ title, description, icon: Icon }) => <article className="local-mode-connector" key={title}><div className="local-mode-connector-icon"><Icon size={18} /></div><div><h3>{title}</h3><p>{description}</p><span>Sem credenciais ou transferência de dados</span></div></article>)}</div>
      <div className="local-mode-scope-note"><LockKeyhole size={16} /><p>O acesso não está ativo. Antes de conectar um chatbot, será preciso autorizar a infraestrutura, escolher exatamente quais informações ele poderá ler e configurar autenticação segura. Nesta versão, o painel não transmite dados.</p></div>
    </section>

    <footer className="local-mode-footer"><Download size={15} /><span>Relatórios, métricas e dados de rede exibidos em outras áreas são demonstrativos; não são insights obtidos de contas conectadas.</span></footer>
  </main>
}
