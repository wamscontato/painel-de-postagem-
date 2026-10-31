# Planejador de conteúdo — plano de integrações autorizadas

## Direção do produto e visual

Ferramenta genérica em português brasileiro, preservando a identidade já aprovada: ciano, azul-marinho, azul-claro e superfícies frias. Navegação, criador, biblioteca, calendário, rascunhos e relatórios continuam responsivos e locais. Evitar mudanças de marca, lilás e decoração sem função. Mensagens de conexão, carregamento, sucesso, erro e ausência de dados devem ser claras, acessíveis e consistentes.

## Laboratório de fotografia — área de trabalho

No `PhotoStudio`, manter o quadriculado como área de transparência ao redor de uma folha visível, proporcional à seleção Original/1:1/4:5/16:9/9:16. Encaixar a folha dentro do painel e restringir o pan ao excedente real da foto para que o conteúdo não saia da página nem desapareça. As camadas distinguem fotografia e folha fixa; ao selecionar a folha, os controles que alteram a foto (ajustes, predefinições, pan, rotação, endireitamento, espelhamento, zoom, histórico e restaurar) ficam desativados em ambas as abas, enquanto proporção e exportação permanecem disponíveis. O painel deixa claro que o quadriculado externo é apenas visual e não será exportado. Zoom de recorte com menos/mais, slider e reinício a 100%, sincronizados ao canvas e à exportação. Permitir também pequenos deslocamentos por botões direcionais e teclado, preservando a proporção, rotação, espelhamento, histórico e original.

## Escopo autorizado

A autorização atual habilita servidor, banco, login e leitura de métricas somente para Instagram, TikTok e YouTube. Só mostrar insights de uma conta que a própria pessoa autenticada conectar e autorizar; sem métricas falsas/de demonstração antes disso. Usar login Manus e escopos mínimos de leitura. Não publicar, editar ou enviar conteúdo às redes. O compositor, a mídia, rascunhos e o calendário permanecem locais; Google Agenda, Claude e API própria de chatbot/terminal continuam pendentes.

Após consentimento OAuth da rede, sincronizar automaticamente. Ao abrir Métricas, atualizar uma conexão com dados desatualizados e disponibilizar atualização manual. Atribuir cada conta e consulta ao `openId` autenticado. Nunca enviar tokens ao navegador ou gravá-los em logs. Desconectar deve revogar a autorização quando a API oferecer endpoint e apagar os tokens e instantâneos daquela conta, sem afetar outras contas.

Manter os filtros de 7 dias, 28 dias, 90 dias, 6 meses, 1 ano e datas manuais. Indicadores, comparativos, tabelas, séries e PDF usam a mesma fonte, plataforma e período selecionados. Não converter campos indisponíveis em zero, estimar valores ou apresentar contagens vitalícias como atividade do período; indicar fonte, horário, cobertura e limitações de cada rede.

## Contratos e limites verificados nas fontes oficiais

- **Instagram:** Instagram Login para contas profissionais Business/Creator, sem exigir Página do Facebook. Usar `instagram_business_basic` e `instagram_business_manage_insights`. Endpoint de insights de conta em `graph.instagram.com/v26.0/{id}/insights`; v26.0 é a versão mais recente consultada. Contas pessoais não são elegíveis. Acesso a contas externas pode exigir Advanced Access, análise do app e verificação empresarial. `follower_count` não está disponível abaixo de 100 seguidores; dados podem atrasar até 48 horas e respostas vazias não significam zero.
- **TikTok:** Login Kit + Display API com `user.info.basic`, `user.info.stats` e `video.list`. Mostrar contagens atuais de perfil e vídeos públicos; contagens por vídeo são valores atuais/lifetime, não uma série histórica diária. Tokens de acesso expiram em 24 horas, refresh costuma durar 365 dias e pode ser rotacionado. O produto, app e escopos precisam ser aprovados pelo TikTok.
- **YouTube:** YouTube Analytics `reports.query`, `ids=channel==MINE`, somente canal controlado pela pessoa autenticada e escopo atualmente indicado no topo da referência como `youtube.readonly`; sem escopos de publicação, gestão ou monetização. Consultas exigem datas e métricas válidas. O processamento pode atrasar 48–72 horas e o fim retornado pode ser anterior ao solicitado.
- Os apps OAuth, credenciais e aprovações de cada fornecedor ainda precisam ser configurados; a implementação não concede aprovação. Antes de liberar OAuth, fornecer uma identificação do controlador e um contato público em `PUBLIC_DATA_CONTROLLER_CONTACT`; o valor aparece na página de privacidade e funciona como bloqueio de segurança se estiver ausente. Redirect URIs permanentes: `https://studio-9vopelhq.manus.space/api/oauth/instagram/callback`, `https://studio-9vopelhq.manus.space/api/oauth/tiktok/callback` e `https://studio-9vopelhq.manus.space/api/oauth/youtube/callback`.

## Arquitetura, segurança e projeto

Preservar React, TypeScript e Vite. `src/App.tsx` carrega autenticação sem bloquear funções locais. `IntegrationsPage.tsx` apresenta login, elegibilidade, estado da configuração, contas ativas, permissões, sincronização e desconexão. `InsightsPage.tsx` troca fixtures por estados autenticados vazio/carregando/parcial/erro e por métricas recebidas da API. `src/lib/api.ts` concentra chamadas tipadas; `src/lib/fullInsightsReport.ts` conserva o PDF multipágina com proveniência, cobertura e limitações reais.

Adicionar `server/` em Node/Express com autenticação Manus, callbacks sociais com state de uso único, adaptadores separados, refresh/expiração, autorização por usuário e endpoints de login, conexões, métricas, sincronização e health. O login normal usa o cookie `webdev_app_session` com token opaco aleatório de alta entropia; persistir somente o hash da sessão no MySQL. No Preview, aceitar a sessão injetada pela plataforma apenas após verificar seu JWT HS256 com `MANUS_JWT_SECRET`, validar `appId` e obter `openId`; ambos os caminhos usam as mesmas regras de propriedade dos dados. Cookies da sessão: `HttpOnly; Secure; SameSite=None` para o Preview HTTPS incorporado. Nome, e-mail e tokens Manus não precisam ser persistidos.

Usar MySQL gerenciado (`DATABASE_URL`) para sessões, conexões sociais e instantâneos de métricas por dono/conta/período; toda leitura, atualização e remoção aplica `openId`. Criar migração aditiva versionada e não semear métricas artificiais. Cifrar tokens sociais com AES-256-GCM e segredo separado `SOCIAL_TOKEN_ENCRYPTION_KEY` obtido pelo formulário seguro; usar também o formulário protegido para `PUBLIC_DATA_CONTROLLER_CONTACT`, exibido como texto na política pública. Nunca usar o filesystem efêmero para dados duráveis.

Manter Vite no Preview pela porta 3000 e encaminhar `/api/*` ao Express. Para produção, usar compilação estática `npm ci && npm run build` em `dist` e um Dockerfile Node que atende as rotas API na porta `PORT` (padrão 3000). Configurar `/api/*` como `server` e `/*` como `static` com fallback SPA; o health `/api/health` é público, barato e sem autenticação. `public/manus-routes.json` lista páginas da interface (incluindo `/privacidade` e `/termos`), nunca endpoints API.

## Organização dos componentes

- `src/components/IntegrationsPage.tsx`: sessão Manus, conexões sociais reais, permissões e estados de configuração.
- `src/components/InsightsPage.tsx` + `src/lib/fullInsightsReport.ts`: filtros de datas/plataformas, resultados reais, limitações e PDF coerente.
- `src/lib/api.ts` e `src/App.tsx`: transporte autenticado, estado de sessão e navegação.
- `server/index.js`, `server/auth.js`, `server/db.js`, `server/providers/`, `server/migrations/`: servidor, sessões/identidade, persistência/migrações e adaptadores por fornecedor.
- `/privacidade` e `/termos`: páginas públicas com finalidade, dados usados, retenção, segurança, terceiros, desconexão e exclusão, com links visíveis no fluxo de integração.
- `vite.config.ts`, `Dockerfile`, `package.json`/lockfile, `app.config.ts` e config Webdev: desenvolvimento, compilação, metadados genéricos e deploy híbrido.
