import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Camera, Check, CircleAlert, Clapperboard, Copy, ExternalLink, KeyRound, LoaderCircle, LockKeyhole, LogIn, LogOut, RefreshCw, ShieldCheck, Sparkles, Terminal, Trash2, Video } from 'lucide-react'
import { apiJson, beginOAuthPopup, listenForOAuthCompletion, type IntegrationsStatus, type ProviderId, type SocialConnection } from '../lib/api'
import type { PageId } from './Sidebar'

type Props = { onNavigate: (page: PageId) => void }
type SessionStatus = { authenticated: boolean }
type ConnectionsResponse = { connections: SocialConnection[] }
type DeleteResponse = { success: boolean; revoked: boolean }

const PROVIDER_COPY: Record<ProviderId, { icon: 'instagram' | 'tiktok' | 'youtube'; color: string; documentation: string }> = {
  instagram: { icon: 'instagram', color: '#0a8292', documentation: 'https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login' },
  tiktok: { icon: 'tiktok', color: '#122449', documentation: 'https://developers.tiktok.com/doc/display-api-overview' },
  youtube: { icon: 'youtube', color: '#275184', documentation: 'https://developers.google.com/youtube/analytics' },
}
const FUTURE_OPTIONS = [
  { title: 'Google Agenda', description: 'A conexão externa permanece pendente; o calendário atual funciona localmente.', icon: 'calendar' },
  { title: 'Claude', description: 'Integração futura, ainda sem envio de conteúdo ou dados do painel.', icon: 'assistant' },
  { title: 'API própria · chatbot/terminal', description: 'Opção pendente. Nenhum endpoint externo é chamado por esta demonstração.', icon: 'terminal' },
] as const
const providerLabel = (id: ProviderId) => id === 'youtube' ? 'YouTube' : id === 'instagram' ? 'Instagram' : 'TikTok'
const dateTime = (value?: string | null) => {
  if (!value) return 'Ainda não sincronizada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Ainda não sincronizada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function ProviderIcon({ id }: { id: ProviderId }) {
  if (id === 'instagram') return <Camera size={20} aria-hidden="true" />
  if (id === 'youtube') return <Clapperboard size={20} aria-hidden="true" />
  return <Video size={20} aria-hidden="true" />
}

export default function IntegrationsPage({ onNavigate }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [configuration, setConfiguration] = useState<IntegrationsStatus | null>(null)
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshState = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [session, readiness] = await Promise.all([
        apiJson<SessionStatus>('/api/auth/me'),
        apiJson<IntegrationsStatus>('/api/integrations/status'),
      ])
      setAuthenticated(session.authenticated)
      setConfiguration(readiness)
      if (session.authenticated) {
        const result = await apiJson<ConnectionsResponse>('/api/connections')
        setConnections(result.connections)
      } else {
        setConnections([])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o estado das conexões.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refreshState() }, [refreshState])
  useEffect(() => listenForOAuthCompletion((result) => {
    if (result.success) {
      setNotice(result.message || (result.type === 'planner-auth-complete' ? 'Sessão Manus iniciada.' : 'A conta foi autorizada.'))
      void refreshState()
    } else {
      setError(result.message || 'A autorização não foi concluída. Confira a aprovação e tente novamente.')
      void refreshState()
    }
  }), [refreshState])

  const publishedOrigin = Boolean(configuration?.publicOrigin && window.location.origin === configuration.publicOrigin)
  const connectedByProvider = useMemo(() => {
    const map = new Map<ProviderId, SocialConnection[]>()
    for (const connection of connections) map.set(connection.provider, [...(map.get(connection.provider) || []), connection])
    return map
  }, [connections])

  const startLogin = async () => {
    setError(''); setNotice(''); setBusy(true)
    try { await beginOAuthPopup('/api/auth/start') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o login Manus.') }
    finally { setBusy(false) }
  }
  const startProvider = async (provider: ProviderId) => {
    setError(''); setNotice(''); setBusy(true)
    try { await beginOAuthPopup(`/api/oauth/${provider}/start`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a autorização oficial.') }
    finally { setBusy(false) }
  }
  const signOut = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      await apiJson<{ success: boolean }>('/api/auth/logout', { method: 'POST', json: {} })
      setAuthenticated(false); setConnections([])
      setNotice('Sessão encerrada. As conexões sociais permanecem até você desconectá-las.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível encerrar a sessão.') }
    finally { setBusy(false) }
  }
  const disconnect = async (connection: SocialConnection) => {
    const label = connection.handle ? `@${connection.handle}` : connection.displayName || providerLabel(connection.provider)
    if (!window.confirm(`Desconectar ${label}? Os tokens e as métricas salvas dessa conta serão removidos. Esta ação não apaga os dados de outras contas.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await apiJson<DeleteResponse>(`/api/connections/${encodeURIComponent(connection.id)}`, { method: 'DELETE', json: {} })
      await refreshState()
      setNotice(result.revoked
        ? 'Conta desconectada; os tokens e instantâneos dessa conta foram removidos.'
        : 'Dados locais removidos. A rede não confirmou a revogação; revise os aplicativos autorizados na página oficial.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível desconectar a conta.') }
    finally { setBusy(false) }
  }
  const copyCallback = async (uri: string) => {
    try { await navigator.clipboard.writeText(uri); setNotice('Endereço de retorno copiado.') }
    catch { setError('Não foi possível copiar. Selecione o endereço exibido e copie-o manualmente.') }
  }

  return <main className="integrations-page">
    <style>{`
      .integrations-page{--ip-ink:#172039;--ip-muted:#69778e;--ip-line:#dfe7f1;color:var(--ip-ink);max-width:1180px;margin:0 auto;padding:clamp(22px,4vw,48px);font-family:inherit}
      .integrations-page *{box-sizing:border-box}.integrations-hero{position:relative;overflow:hidden;padding:clamp(23px,4vw,40px);border-radius:22px;color:#fff;background:linear-gradient(120deg,#102847,#174a69 62%,#087f91);box-shadow:0 18px 42px #1737571c}.integrations-hero:after{content:"";position:absolute;width:270px;height:270px;right:-85px;top:-130px;border:1px solid #ffffff2b;border-radius:50%;box-shadow:0 0 0 36px #ffffff0b,0 0 0 72px #ffffff07;pointer-events:none}.integrations-eyebrow{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#bceaf0;font-weight:750}.integrations-hero h1{font-size:clamp(28px,4vw,43px);line-height:1.05;letter-spacing:-.045em;margin:13px 0 11px;max-width:680px}.integrations-hero p{max-width:760px;margin:0;color:#d8e8f1;font-size:13px;line-height:1.7}.integrations-login-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:21px}.integrations-login-state{display:inline-flex;align-items:center;gap:7px;color:#dff8f2;font-size:11px;font-weight:650}.integrations-login-state svg{color:#8fe5d0}.integrations-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:8px 13px;border:1px solid #d8e2ec;border-radius:10px;background:#fff;color:#263652;font:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:background-color .16s,border-color .16s,transform .16s}.integrations-button:hover:not(:disabled){border-color:#85c5d1;background:#f3fbfc;transform:translateY(-1px)}.integrations-button:disabled{opacity:.55;cursor:not-allowed}.integrations-button:focus-visible{outline:3px solid #25bdcb;outline-offset:3px}.integrations-button--primary{border-color:#087f91;background:#087f91;color:#fff}.integrations-button--primary:hover:not(:disabled){background:#086d7c}.integrations-button--quiet{min-height:36px;padding:6px 10px;font-size:10px}.integrations-button--danger{border-color:#e3c5c5;color:#873d3d;background:#fff}.integrations-secure-note{display:flex;align-items:flex-start;gap:10px;max-width:900px;margin-top:17px;padding:12px 14px;border:1px solid #ffffff27;border-radius:12px;background:#ffffff0c;color:#e6f0f5;font-size:10px;line-height:1.6}.integrations-secure-note svg{flex:none;color:#9ce7d7;margin-top:1px}.integrations-section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;margin:30px 2px 14px}.integrations-section-heading h2{margin:0;font-size:19px;letter-spacing:-.03em}.integrations-section-heading p{margin:5px 0 0;color:var(--ip-muted);font-size:11px;line-height:1.5}.integrations-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.integrations-card{min-width:0;overflow:hidden;border:1px solid var(--ip-line);border-radius:16px;background:#fff;box-shadow:0 8px 22px #19385208}.integrations-card-top{padding:18px 18px 15px}.integrations-platform-row{display:flex;align-items:center;gap:11px}.integrations-platform-icon{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:13px;color:#fff}.integrations-platform-row h3{margin:0;font-size:14px;letter-spacing:-.02em}.integrations-description{margin:4px 0 0;color:var(--ip-muted);font-size:10px;line-height:1.5}.integrations-status{display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:5px 8px;border-radius:99px;background:#f0f3f7;color:#576780;font-size:9px;font-weight:700}.integrations-status i{width:7px;height:7px;border-radius:50%;background:#99a6b8}.integrations-status--ready{background:#e8f8f3;color:#1b705c}.integrations-status--ready i{background:#35a887}.integrations-status--warning{background:#fff5e6;color:#79511c}.integrations-card-bottom{padding:14px 18px 17px;border-top:1px solid #edf1f5}.integrations-card-note{margin:0;color:#596a81;font-size:10px;line-height:1.6}.integrations-scopes{margin:11px 0 0;padding:9px 10px;border-radius:9px;background:#f4f8fb;color:#52627a;font-size:9px;line-height:1.55;overflow-wrap:anywhere}.integrations-account{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:10px;border:1px solid #e5ebf2;border-radius:10px;background:#fbfcfe}.integrations-account-copy{min-width:0}.integrations-account-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.integrations-account-copy span{display:block;margin-top:3px;color:var(--ip-muted);font-size:9px}.integrations-account-actions{display:flex;align-items:center;gap:6px;flex:none}.integrations-callback{margin-top:12px;padding-top:11px;border-top:1px dashed #dce5ee;color:var(--ip-muted);font-size:9px;line-height:1.5}.integrations-callback code{display:block;margin-top:4px;overflow-wrap:anywhere;color:#3c5877;font-size:9px}.integrations-footer-note{display:flex;align-items:flex-start;gap:9px;margin-top:19px;padding:13px 15px;border:1px solid #c5e9e7;border-radius:12px;background:#f0fbfa;color:#416276;font-size:10px;line-height:1.6}.integrations-footer-note svg{flex:none;color:#087f91}.integrations-feedback{margin:14px 0 0;padding:11px 13px;border-radius:10px;background:#eef8fb;color:#274a68;font-size:11px;line-height:1.55}.integrations-feedback--error{border:1px solid #f1d1d1;background:#fff5f5;color:#8a3535}.integrations-legal{display:flex;gap:14px;flex-wrap:wrap;margin-top:18px;color:var(--ip-muted);font-size:10px}.integrations-legal a{color:#126f83;text-decoration:none}.integrations-legal a:hover{text-decoration:underline}.integrations-legal a:focus-visible{outline:3px solid #25bdcb;outline-offset:3px}.integrations-pending-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.integrations-pending{padding:14px;border:1px dashed #d7e0e9;border-radius:13px;background:#fbfcfd}.integrations-pending strong{display:flex;align-items:center;gap:7px;font-size:11px}.integrations-pending p{margin:7px 0 0;color:var(--ip-muted);font-size:10px;line-height:1.5}.integrations-spinner{animation:integrations-spin 1s linear infinite}@keyframes integrations-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.integrations-page *, .integrations-page *:before, .integrations-page *:after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}@media(max-width:850px){.integrations-page{padding:24px 20px}.integrations-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.integrations-pending-grid{grid-template-columns:1fr 1fr}}@media(max-width:580px){.integrations-page{padding:19px 14px}.integrations-hero{border-radius:17px}.integrations-grid,.integrations-pending-grid{grid-template-columns:1fr}.integrations-section-heading{align-items:flex-start;flex-direction:column}.integrations-login-row{align-items:flex-start;flex-direction:column}.integrations-account{align-items:flex-start;flex-direction:column}.integrations-account-actions{width:100%}.integrations-account-actions .integrations-button{flex:1}}
    `}</style>
    <header className="integrations-hero">
      <span className="integrations-eyebrow">Contas e serviços · somente leitura</span>
      <h1>Conectar contas</h1>
      <p>Entre com sua conta Manus e autorize, nas páginas oficiais, apenas as redes que deseja consultar. Depois da autorização, as métricas são sincronizadas automaticamente; nenhuma publicação é enviada.</p>
      <div className="integrations-login-row">
        {loading ? <span className="integrations-login-state"><LoaderCircle size={15} className="integrations-spinner" /> Verificando sessão…</span>
          : authenticated ? <><span className="integrations-login-state"><ShieldCheck size={15} /> Sessão Manus ativa</span><button type="button" className="integrations-button integrations-button--quiet" onClick={signOut} disabled={busy}><LogOut size={14} /> Encerrar sessão</button></>
            : <><span className="integrations-login-state"><LockKeyhole size={15} /> As funções locais não exigem login.</span><button type="button" className="integrations-button integrations-button--primary" onClick={startLogin} disabled={busy}><LogIn size={15} /> Entrar com Manus</button></>}
      </div>
      <div className="integrations-secure-note"><LockKeyhole size={16} aria-hidden="true" /><span>Os tokens sociais ficam cifrados no servidor e não são enviados à interface. Escopos, disponibilidade e aprovação dependem de cada fornecedor. Rascunhos, mídia e tarefas do calendário continuam neste navegador.</span></div>
    </header>

    {error && <p className="integrations-feedback integrations-feedback--error" role="alert">{error}</p>}
    {notice && <p className="integrations-feedback" role="status">{notice}</p>}

    <div className="integrations-section-heading"><div><h2>Instagram, TikTok e YouTube</h2><p>Permissões de leitura; login social oficial. Nenhuma autorização de publicação é solicitada.</p></div><button type="button" className="integrations-button integrations-button--quiet" onClick={() => void refreshState()} disabled={loading || busy}><RefreshCw size={14} /> Atualizar estado</button></div>
    <section className="integrations-grid" aria-label="Contas sociais">
      {(['instagram', 'tiktok', 'youtube'] as ProviderId[]).map((id) => {
        const provider = configuration?.providers.find((item) => item.id === id)
        const accounts = connectedByProvider.get(id) || []
        const copy = PROVIDER_COPY[id]
        const readyHere = Boolean(provider?.ready && publishedOrigin)
        const stateLabel = accounts.length ? `${accounts.length} conta${accounts.length > 1 ? 's' : ''} conectada${accounts.length > 1 ? 's' : ''}` : provider?.ready ? publishedOrigin ? 'Pronta para consentimento' : 'Conexão disponível no site publicado' : provider?.configured && !configuration?.encryptionReady ? 'Aguardando chave de cifragem' : provider?.configured && !configuration?.policyReady ? 'Aguardando contato de privacidade' : 'Aguardando credenciais do aplicativo'
        const stateClass = accounts.length ? 'integrations-status--ready' : provider?.ready ? 'integrations-status--warning' : ''
        return <article className="integrations-card" key={id}>
          <div className="integrations-card-top"><div className="integrations-platform-row"><div className="integrations-platform-icon" style={{ background: copy.color }}><ProviderIcon id={id} /></div><div><h3>{providerLabel(id)}</h3><p className="integrations-description">{provider?.eligibility || 'Estado da integração carregado do servidor.'}</p></div></div><span className={`integrations-status ${stateClass}`}><i aria-hidden="true" />{stateLabel}</span></div>
          <div className="integrations-card-bottom">
            <p className="integrations-card-note">{provider?.ready ? publishedOrigin ? 'O consentimento acontece diretamente no domínio oficial da rede.' : 'Para proteger o OAuth, inicie conexões somente no domínio permanente publicado.' : provider?.configured && !configuration?.policyReady ? 'Informe o controlador e um canal público de contato na página de privacidade antes de liberar conexões.' : provider?.configured && !configuration?.encryptionReady ? 'A chave de cifragem segura ainda não está disponível para este ambiente.' : 'As credenciais do aplicativo e a aprovação do fornecedor são necessárias antes do consentimento.'}</p>
            {provider && <div className="integrations-scopes"><strong>Escopos somente leitura:</strong> {provider.scopes.join(' · ') || 'aguardando configuração'}</div>}
            {accounts.map((account) => <div className="integrations-account" key={account.id}><div className="integrations-account-copy"><strong>{account.handle ? `@${account.handle}` : account.displayName || `${providerLabel(id)} · conta autorizada`}</strong><span>{account.status === 'connected' ? 'Sincronizada pela última vez' : 'Esta conexão pode precisar de nova autorização'} · {dateTime(account.lastSyncedAt)}</span></div><div className="integrations-account-actions"><button type="button" className="integrations-button integrations-button--quiet" onClick={() => onNavigate('insights')}><ArrowUpRight size={13} /> Ver métricas</button><button type="button" className="integrations-button integrations-button--danger integrations-button--quiet" onClick={() => void disconnect(account)} disabled={busy} aria-label={`Desconectar ${providerLabel(id)}`}><Trash2 size={13} /> Desconectar</button></div></div>)}
            {provider?.callbackUri && <div className="integrations-callback"><strong>Endereço de retorno do OAuth — cadastre exatamente no painel do fornecedor</strong><code>{provider.callbackUri}</code><button type="button" className="integrations-button integrations-button--quiet" style={{ marginTop: 7 }} onClick={() => void copyCallback(provider.callbackUri!)}><Copy size={12} /> Copiar endereço</button></div>}
            <div className="integrations-actions"><button type="button" className="integrations-button integrations-button--primary" onClick={() => void startProvider(id)} disabled={loading || busy || !authenticated || !readyHere}><ArrowUpRight size={14} />{accounts.length ? 'Conectar outra conta' : 'Conectar conta'}</button><a className="integrations-button integrations-button--quiet" href={copy.documentation} target="_blank" rel="noopener noreferrer">Documentação oficial <ExternalLink size={12} /></a></div>
          </div>
        </article>
      })}
    </section>
    <div className="integrations-footer-note"><ShieldCheck size={15} aria-hidden="true" /><span>O sistema não solicita permissões para publicar, editar perfis, ler mensagens, baixar mídias ou enviar rascunhos. Antes de liberar acesso social a outras pessoas, o responsável pelo site ainda deve completar e revisar o contato do controlador na <a href="/privacidade">página de privacidade</a>.</span></div>

    <div className="integrations-section-heading"><div><h2>Outras conexões</h2><p>Continuam pendentes, sem autenticação ou transferência de dados.</p></div></div>
    <section className="integrations-pending-grid" aria-label="Integrações futuras">
      {FUTURE_OPTIONS.map((item) => <article className="integrations-pending" key={item.title}><strong>{item.icon === 'calendar' ? <KeyRound size={14} /> : item.icon === 'assistant' ? <Sparkles size={14} /> : <Terminal size={14} />}{item.title}<span className="integrations-status"><i />Pendente</span></strong><p>{item.description}</p></article>)}
    </section>
    <div className="integrations-legal"><a href="/privacidade">Privacidade e tratamento de dados</a><a href="/termos">Termos de uso</a></div>
  </main>
}
