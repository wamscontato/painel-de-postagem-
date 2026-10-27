# Planejador de conteúdo — plano de implementação

## Direção visual

A interface conserva as cores da imagem enviada, omitindo o tom lilás: ciano `#11CFE0`, azul-marinho `#171F8A`, azul-claro `#D9E2F3`, papel frio `#F2F5FB` e branco `#FFFFFF`. O ciano destaca ações e estados; o marinho organiza navegação e áreas de foco; os azuis claros favorecem leitura. Poppins local, superfícies claras e controles acessíveis mantêm a linguagem já aprovada.

O workspace compacto elimina nomes redundantes no cabeçalho lateral; a seta de 44 px permanece disponível em telas estreitas e abre uma gaveta com rótulos que se fecha após a navegação. A alternância dia/noite fica como botão-sol/lua no topo do conteúdo. O estado de operação local sai da linha de status e recebe destino próprio no final da navegação.

## Arquitetura

`src/App.tsx` continua compondo navegação SPA, estado do criador e páginas. `Sidebar.tsx` define o rótulo final do modo local e o novo atalho de conexões; o tema é alternado no cabeçalho. `InsightsPage.tsx` aplica o mesmo período e a mesma plataforma a indicadores, tendência, resumo por plataforma, conteúdos e PDF; o relatório multipágina conserva as definições dos dados demonstrativos.

`CalendarPage.tsx` separa o calendário da página principal. Guarda tarefas/notas locais em IndexedDB com fallback em `localStorage`, escolhendo a cópia mais recente; após erro ao persistir, conserva editor e dados e apresenta o erro dentro do diálogo. Permite criar, editar e excluir itens com título, data, hora, cor e anotação, usa entrada de hora nativa e oferece visões dia, semana, mês e ano. Google Agenda mostra configuração pendente até existir OAuth aprovado.

`IntegrationsPage.tsx` centraliza a preparação de contas sociais, Google Agenda e assistentes. Credenciais não ficam no navegador. A página final informa como o workspace opera localmente e que nenhum dado é transmitido.

## Escopo e limites

Conservar a ferramenta genérica, responsiva e em português brasileiro. Identidade genérica, sem marca preexistente nem tom lilás. Relatórios imprimem todos os indicadores e tabelas que a interface oferece, mas continuam rotulados demonstrativos: não representam acesso aos insights reais das redes.

Por escolha explícita do usuário nesta rodada, manter a aplicação local no navegador e não habilitar servidor/banco. Calendário, tarefas e anotações ficam no dispositivo. Google Agenda, Claude e API própria/terminal permanecem claramente pendentes; não abrir fluxos de credenciais, simular OAuth, alegar conexão ou transferir dados do dashboard a terceiros. Integrações reais poderão ser reavaliadas apenas após nova autorização, credenciais/escopos e configuração segura.

## Organização dos componentes

- `src/components/CalendarPage.tsx` e `CalendarPage.css`: calendário local CRUD com controles de navegação e quatro escalas de tempo.
- `src/components/InsightsPage.tsx` e `src/lib/fullInsightsReport.ts`: filtros e relatório PDF multipágina derivado de todas as seções visíveis.
- `src/components/Sidebar.tsx` e `src/App.tsx`: navegação, tema no cabeçalho e separação da aba final de modo local.
- `src/components/IntegrationsPage.tsx`: cartões de conectar/preparar contas com estado pendente, sem campos para segredos.
- `src/lib/storage.ts`: reusa IndexedDB existente; não cria storage remoto.
