# Estúdio Social — plano de implementação

## Direção visual

A interface usa as cores da imagem enviada, omitindo o tom lilás: ciano `#11CFE0`, azul-marinho `#171F8A`, azul-claro `#D9E2F3`, papel frio `#F2F5FB` e branco `#FFFFFF`. O ciano destaca ações e estados; o marinho organiza navegação e áreas de foco; os azuis muito claros preservam a leitura.

Poppins local define a hierarquia editorial. A navegação fica em marinho; a área de trabalho usa superfícies claras e painéis limpos. O criador mantém configurações à esquerda e prévia à direita, com movimento curto e foco visível. Os espaços de edição fotográfica usam uma mesa escura grafite, conforme o briefing anexado, e realçam controles com ciano da paleta aprovada. Nenhuma tela inclui lilás.

## Arquitetura

`src/App.tsx` compõe navegação SPA, dashboard, páginas de trabalho e criador. `src/components/Sidebar.tsx` cuida da navegação e do tema; `MediaManager.tsx` trata upload, ordenação acessível e ações nas fotos; `PreviewCard.tsx` representa formatos de conteúdo; `src/lib/storage.ts` armazena rascunhos em IndexedDB com fallback localStorage; `src/styles.css` define tokens, responsividade e estados de acessibilidade.

`PhotoStudio.tsx` é um editor modal invocado pelas ações em cada foto do carrossel. Processa pixels na tela Canvas sem alterar o original, oferece ajustes e recorte ao vivo, e só substitui a imagem da publicação depois de confirmar. Salva os parâmetros de edição e recorte junto à cópia exportada no estado local da publicação para reabertura do ajuste. O Canvas calcula a área completa para ângulos arbitrários; movimentar o recorte entra no histórico de desfazer/refazer.

`CoverComposer.tsx` será um editor de composição em camadas, com área vetorial redimensionável, propriedades, timeline e exportação PNG. As estruturas de camadas e seus dados serão persistidos localmente em IndexedDB para uso em Modelos e em Criar publicação. `NewsPage.tsx` mostrará links ao canal/playlist verificados e ao Google Trends oficial do Brasil; não fará raspagem nem afirmará ter acesso a uma API de tendências.

## Escopo

A aplicação é um front-end hospedável, sem API, backend ou integração automática com redes sociais. Agendamento, autenticação, publicação, métricas demonstrativas, trending e armazenamento remoto não devem ser representados como integrações reais. Os dados criados em rascunhos, edições e modelos permanecem locais no dispositivo.

O editor fotográfico suporta ajustes de imagem com prévia, proporções sociais, histórico e exportação sem sobrescrever o original. Ferramentas que exijam IA ou processamento não implementado serão identificadas como indisponíveis. O editor de capa suporta imagem, texto, formas, guias e camadas; visualização e exportação devem distinguir capa estática de animação/transições de timeline quando não houver exportação de vídeo.
