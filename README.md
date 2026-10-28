# Planejador de conteúdo

Ferramenta genérica em português brasileiro para planejar conteúdo, organizar mídia, criar capas e consultar métricas somente leitura das contas sociais que a própria pessoa conectou. A interface preserva a identidade já aprovada em ciano, azul-marinho e azuis claros.

## Fronteira de dados

Rascunhos, arquivos de mídia, modelos e tarefas do calendário continuam guardados neste navegador. O sistema não publica, agenda, edita nem exclui conteúdo nas redes, não lê mensagens ou legendas e não transfere esses dados locais.

A aba **Métricas** não mostra números de exemplo. Depois de entrar com uma sessão Manus e autorizar uma rede, o servidor sincroniza os dados disponíveis automaticamente. Cada chamada e consulta é vinculada à conta Manus autenticada. Tokens sociais ficam cifrados no banco gerenciado e nunca são retornados ao navegador. Instagram Login atende apenas contas profissionais elegíveis; TikTok mostra contagens acumuladas atuais, não desempenho diário; YouTube pode retornar dados atrasados ou cobertura incompleta. Campos ausentes aparecem como indisponíveis.

Google Agenda, Claude e API própria de chatbot/terminal continuam identificados como opções pendentes. O estado de integrações externas não altera as funções locais do criador.

## Desenvolvimento

O projeto usa React, TypeScript e Vite na porta 3000, com API Express local encaminhada pelo Vite para a porta 3001. No ambiente Webdev, as variáveis protegidas e o banco são fornecidos pela plataforma.

```bash
npm ci
npm run dev
npm run check:server
npm test
npm run build
```

O container de produção e o processo de desenvolvimento usam Node.js 22.13.0 e npm 10.9.2. A API publica o endpoint de saúde não autenticado em `/api/health`.

## OAuth de produção

Cada fornecedor exige cadastro e, conforme o caso, revisão/aprovação do aplicativo. Cadastre exatamente estes endereços HTTPS como callbacks antes de preencher as credenciais no formulário seguro de segredos do Webdev:

- Instagram: `https://studio-9vopelhq.manus.space/api/oauth/instagram/callback`
- TikTok: `https://studio-9vopelhq.manus.space/api/oauth/tiktok/callback`
- YouTube: `https://studio-9vopelhq.manus.space/api/oauth/youtube/callback`

São solicitados apenas escopos de leitura. Não informe senhas sociais, códigos de acesso ou segredos em arquivos do projeto nem em conversas.

O formulário protegido do Webdev recebe `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, além de `SOCIAL_TOKEN_ENCRYPTION_KEY` (Base64 canônico que decodifica para 32 bytes aleatórios) e `PUBLIC_DATA_CONTROLLER_CONTACT` (identificação do controlador e contato público, exibidos na política de privacidade). O OAuth social permanece bloqueado sem o contato público, as credenciais do app e a chave de cifragem. Para o domínio permanente, configure os valores no ambiente de produção; a aprovação do aplicativo ainda depende de cada fornecedor.

## Áreas

- **Dashboard, calendário, agendadas e rascunhos:** planejamento local editável por dia, semana, mês e ano. Os menus de contexto são flutuantes e oferecem as ações disponíveis em cada estado.
- **Criar publicação:** imagem única, carrossel, Story e Reel; seleção de Instagram, TikTok e YouTube; proporções e dimensões padrão, legenda, hashtags e prévia. O envio às redes não faz parte do produto.
- **Conteúdo visual e laboratório de fotografia:** edição não destrutiva, reenquadramento social, controles de luz/cor, reposicionamento, zoom, rotação e exportação local.
- **Modelos de publicações e editor de capas:** tamanhos predefinidos ou personalizados, imagem/PNG, marca-d'água, texto, formas, fontes, camadas, réguas, guias e timeline de transições; exporta PNG.
- **Métricas e relatórios:** filtros de 7/28/90 dias, 6 meses, 1 ano e intervalo manual; indicadores, comparações, cobertura de cada API, publicações disponíveis e PDF multipágina derivado somente dos dados sincronizados.
- **Conectar contas:** login Manus, estado/configuração do OAuth, escopos, contas conectadas, sincronização e desconexão de Instagram, TikTok e YouTube.
- **Modo local:** informa onde ficam os rascunhos, a mídia e as tarefas; permanece como o último item da navegação.
- **Notícias Entreverso TV:** portal, canais e playlists do YouTube, Google Trends Brasil e modelos editoriais.

## Transparência e requisitos de ativação

As páginas `/privacidade` e `/termos` descrevem a finalidade de leitura, a retenção de até 400 dias dos instantâneos, a desconexão e as limitações dos fornecedores. Antes de abrir conexões sociais a usuários, o operador precisa completar a identificação do controlador e um contato válido nas informações de privacidade, revisar a política e obter as credenciais/aprovações oficiais dos três fornecedores.
