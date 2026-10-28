import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

function PolicyLayout({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <main className="policy-page">
    <style>{`
      .policy-page{min-height:100vh;background:#f4f8fc;color:#172039;padding:clamp(24px,6vw,76px) 18px;font-family:inherit}
      .policy-shell{max-width:820px;margin:0 auto;background:#fff;border:1px solid #dfe8f2;border-radius:24px;padding:clamp(24px,5vw,54px);box-shadow:0 24px 60px #102f5010}
      .policy-back{display:inline-flex;align-items:center;gap:8px;color:#145b79;text-decoration:none;font-size:13px;font-weight:700}
      .policy-eyebrow{display:block;margin-top:30px;color:#087f91;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
      .policy-page h1{margin:10px 0 12px;font-size:clamp(30px,5vw,44px);line-height:1.08;letter-spacing:-.045em}
      .policy-intro,.policy-page p,.policy-page li{color:#53627a;font-size:14px;line-height:1.75}
      .policy-page h2{margin:28px 0 8px;font-size:18px;letter-spacing:-.02em}
      .policy-page ul{padding-left:20px}.policy-warning{margin:22px 0;padding:15px 16px;border:1px solid #b8e5ea;border-radius:13px;background:#effbfc;color:#24515a;font-size:13px;line-height:1.65}
      .policy-footer{display:flex;align-items:center;gap:8px;margin-top:28px;padding-top:18px;border-top:1px solid #e9eef5;color:#68768b;font-size:12px}
      .policy-footer svg{color:#078d98;flex:none}.policy-page a:focus-visible{outline:3px solid #12bfd0;outline-offset:3px;border-radius:4px}
    `}</style>
    <article className="policy-shell">
      <a className="policy-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao Planejador de conteúdo</a>
      <span className="policy-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children}
      <div className="policy-footer"><ShieldCheck size={16} aria-hidden="true" /> Planejador de conteúdo · Atualizado em 28 de outubro de 2026</div>
    </article>
  </main>
}

export function PrivacyPage() {
  const [dataControllerContact, setDataControllerContact] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void apiJson<{ dataControllerContact?: string | null }>('/api/integrations/status')
      .then((status) => { if (active) setDataControllerContact(status.dataControllerContact || null) })
      .catch(() => { if (active) setDataControllerContact(null) })
    return () => { active = false }
  }, [])
  return <PolicyLayout title="Privacidade e dados" eyebrow="Transparência de dados">
    <p className="policy-intro">Esta ferramenta organiza conteúdo local e, quando você conecta uma conta social por consentimento, consulta somente métricas autorizadas para exibi-las no painel e no relatório.</p>
    <div className="policy-warning">{dataControllerContact ? <><strong>Controlador e canal público de contato:</strong> {dataControllerContact}</> : <><strong>Informação pendente antes do uso real:</strong> o operador deste site deve identificar o controlador dos dados e incluir um canal de contato válido para solicitações de privacidade. Conexões sociais permanecem bloqueadas até isso ser informado.</>} Este texto é uma descrição do funcionamento técnico atual, não substitui a revisão jurídica nem determina a base legal aplicável.</div>
    <h2>O que fica neste dispositivo</h2>
    <p>Publicações em rascunho, tarefas de calendário, arquivos de mídia e modelos são guardados apenas no armazenamento local do navegador. Eles não são enviados ao servidor por este aplicativo.</p>
    <h2>O que é tratado quando você conecta uma rede</h2>
    <ul>
      <li>O login Manus identifica a conta pelo identificador interno necessário para separar os dados de cada pessoa.</li>
      <li>O servidor guarda o identificador da conta social, nome/usuário público, escopos concedidos, datas de sincronização e métricas retornadas.</li>
      <li>Tokens de acesso e renovação são cifrados no banco e usados no servidor para consultar somente os endpoints oficiais de leitura de Instagram, TikTok ou YouTube. Eles não são enviados ao navegador nem gravados em relatórios.</li>
      <li>O sistema não publica conteúdo, não edita perfis, não lê mensagens privadas, não baixa fotos/vídeos e não solicita legendas.</li>
      <li>O login usa um cookie de sessão HTTP-only; o token de sessão normal é opaco e apenas seu hash é armazenado.</li>
    </ul>
    <h2>Fontes, atraso e cobertura</h2>
    <p>As consultas são enviadas à rede que você conectou, conforme as permissões exibidas no consentimento oficial. Instagram e YouTube podem atrasar os dados; TikTok fornece contagens atuais/acumuladas para vídeos e não uma série histórica diária. Campos ausentes são apresentados como indisponíveis, não como zero.</p>
    <h2>Armazenamento e retenção</h2>
    <p>Tokens permanecem enquanto a conexão estiver ativa. Instantâneos de métricas são mantidos por até 400 dias para viabilizar os relatórios de um ano e depois removidos automaticamente. Sessões de login expiram após 30 dias. Desconectar uma rede elimina os tokens e instantâneos associados àquela conta.</p>
    <h2>Desconectar e solicitar exclusão</h2>
    <p>Você pode remover uma conta na aba “Conectar contas”; a remoção local dos tokens e métricas ocorre mesmo quando o fornecedor não oferece revogação automática. Também recomendamos revogar o acesso na página oficial de aplicativos conectados da rede. O controlador do site ainda precisa informar o canal de contato para solicitações previstas na LGPD.</p>
    <h2>Fornecedores e infraestrutura</h2>
    <p>Os dados autorizados trafegam entre o navegador, o servidor gerenciado deste site e as APIs oficiais Meta/Instagram, TikTok e Google/YouTube. Cada fornecedor também aplica seus próprios termos e avisos de privacidade.</p>
  </PolicyLayout>
}

export function TermsPage() {
  return <PolicyLayout title="Termos de uso" eyebrow="Uso responsável">
    <p className="policy-intro">Use o Planejador de conteúdo para rascunhar, organizar calendários e visualizar métricas somente leitura das contas sociais que você controla ou está autorizado a administrar.</p>
    <div className="policy-warning"><strong>Conexões reais dependem de configuração.</strong> Cada fornecedor exige cadastro, consentimento e pode exigir revisão/aprovação do aplicativo. A disponibilidade não é garantida pelo site. O responsável ainda deve completar a identificação e o contato nas informações de privacidade.</div>
    <h2>Permissões e limites</h2>
    <ul>
      <li>Conecte somente suas próprias contas ou aquelas para as quais você tenha autorização.</li>
      <li>As conexões deste produto são apenas de leitura. Este site não publica, agenda, edita nem exclui conteúdo de Instagram, TikTok ou YouTube.</li>
      <li>Escopos, dados e períodos dependem dos endpoints aprovados pelo fornecedor. Métricas indisponíveis, atrasadas ou com definição distinta podem ficar vazias ou não ser agregadas.</li>
      <li>O TikTok informa contagens atuais/lifetime por vídeo; elas não representam visualizações/interações ocorridas dentro do intervalo filtrado.</li>
      <li>A criação de publicações, os rascunhos, a mídia e as tarefas de calendário são locais ao navegador e não são enviados por este aplicativo.</li>
    </ul>
    <h2>Segurança e credenciais</h2>
    <p>Não informe senhas das redes sociais neste site. A autenticação é feita nas páginas oficiais de consentimento; o servidor recebe códigos OAuth e protege os tokens. Não compartilhe links de sessão nem dispositivos desbloqueados.</p>
    <h2>Desconexão e disponibilidade</h2>
    <p>Você pode desconectar uma conta pelo painel. A disponibilidade das APIs, aprovações, métricas e relatórios depende dos fornecedores e pode mudar. A plataforma não garante continuidade ou completude dos dados fornecidos por terceiros.</p>
    <h2>Revisão</h2>
    <p>Estes termos descrevem a funcionalidade técnica deste projeto. O operador deve revisá-los, identificar o responsável pelo serviço e providenciar canal de suporte e privacidade antes de disponibilizar conexões reais ao público.</p>
  </PolicyLayout>
}

export function PublicPageRouter() {
  if (window.location.pathname === '/privacidade') return <PrivacyPage />
  if (window.location.pathname === '/termos') return <TermsPage />
  return null
}
