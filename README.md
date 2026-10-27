# Planejador de conteúdo

Ferramenta genérica e responsiva para planejar conteúdo, organizar mídia, criar capas e revisar relatórios demonstrativos. A hospedagem é estática: rascunhos, preferências, fotos, modelos e tarefas de calendário permanecem neste navegador.

Implementado em React, TypeScript e Vite. Usa Poppins local, Lucide React, Framer Motion, dnd-kit, jsPDF e IndexedDB.

## Desenvolvimento

```bash
npm ci
npm run dev
```

A aplicação é servida na porta 3000. Para validar a saída estática:

```bash
npm run build
```

## Áreas

- **Dashboard, calendário, agendadas e rascunhos:** agenda local editável por dia, semana, mês e ano, com título, data, horário, anotação e cor da tarefa. Ações em rascunhos e agendamentos abrem menus flutuantes com editar, duplicar, agendar/reagendar, mover de estado e excluir.
- **Criar publicação:** imagem única, carrossel, Story e Reel; escolha de Instagram, TikTok e YouTube; proporções e dimensões padrão, legenda, hashtags, localização e prévia. Uma capa salva pode ser aplicada à primeira imagem.
- **Conteúdo visual e laboratório de fotografia:** ações para remover, editar e reenquadrar cada foto do carrossel; edição não destrutiva com comparar, desfazer/refazer, presets, controles de luz e cor, recorte livre ou 1:1/4:5/16:9/9:16, reposicionamento, zoom, rotação, endireitamento e exportação PNG/JPEG/WebP. A foto original e seus parâmetros de edição ficam associados à cópia local do rascunho.
- **Modelos de publicações e editor de capas:** formatos sociais predefinidos ou tamanho personalizado; upload de imagem/PNG e marca-d'água; texto, fontes, formas, opacidade, preenchimento, contorno, sombra, brilho e duotone; réguas, guias, camadas reordenáveis e timeline com prévia de transições. Exporta PNG estático.
- **Métricas e relatórios:** filtros de 7/28/90 dias, seis meses, um ano e intervalo manual de data inicial/final; indicadores, resumo por canal, conteúdos de exemplo e PDF completo de várias páginas com metodologia e aviso de dados demonstrativos. Não há seção para personalizar o relatório.
- **Conectar contas:** Instagram/Meta, TikTok, YouTube, Google Agenda, Claude e endpoint/API própria são opções pendentes. Nenhum OAuth, formulário de credenciais, envio de dados ou conexão é ativado nesta versão local.
- **Modo local:** informa onde os dados ficam e apresenta o estado das conexões; a guia é o último item do menu lateral.
- **Notícias Entreverso TV:** portal, canal oficial e playlists do YouTube; atalhos para Google Trends Brasil e modelos editoriais utilizáveis no criador.

## Limites desta versão

Os indicadores e conteúdos de rede são exemplos visuais, não insights reais. Google Trends abre a página oficial; a aplicação não simula uma API. Não há backend, banco remoto, OAuth, armazenamento de credenciais, publicação direta, integração Google Agenda, conexão com Claude/chatbot ou consulta de dados de contas. Não informe senhas, tokens, chaves ou endereços de API nesta demonstração. Máscaras e retoque automático por IA não são apresentados como funções implementadas; a timeline anima uma prévia e a exportação do compositor é uma imagem PNG estática.