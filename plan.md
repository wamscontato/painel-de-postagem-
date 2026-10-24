# Estúdio Social — plano de implementação

## Direção visual

A interface usa as cores da imagem enviada, omitindo o tom lilás: ciano `#11CFE0`, azul-marinho `#171F8A`, azul-claro `#D9E2F3`, papel frio `#F2F5FB` e branco `#FFFFFF`. O ciano destaca ações e estados; o marinho organiza navegação e áreas de foco; os azuis muito claros preservam a leitura.

Poppins local define a hierarquia editorial. A navegação fica em marinho; a área de trabalho usa superfícies claras e painéis limpos. O criador mantém configurações à esquerda e prévia à direita, com movimento curto e foco visível. Estados de planejamento são sempre apresentados como locais e demonstrativos.

## Arquitetura

`src/App.tsx` compõe navegação SPA, dashboard, páginas de trabalho e criador. `src/components/Sidebar.tsx` cuida da navegação e do tema; `MediaManager.tsx` trata upload e ordenação acessível; `PreviewCard.tsx` representa formatos de conteúdo; `src/lib/storage.ts` armazena rascunhos em IndexedDB com fallback localStorage; `src/styles.css` define tokens, responsividade e estados de acessibilidade.

## Escopo

Front-end local, sem API, backend ou integração com redes sociais. Inclui dashboard, criador, calendário e superfícies demonstrativas para rascunhos, agendamentos, biblioteca, modelos e configurações. O material de exemplo e todos os textos são genéricos.
