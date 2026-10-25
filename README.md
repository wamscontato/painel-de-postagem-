# Estúdio Social

Ferramenta genérica e responsiva para planejar conteúdo social, organizar mídia, montar capas e produzir relatórios demonstrativos. O site está preparado para hospedagem estática; rascunhos, preferências, fotos processadas e modelos continuam armazenados no navegador de cada pessoa.

Implementado em React, TypeScript e Vite. Usa Poppins local, Lucide React, Framer Motion, dnd-kit, jsPDF e IndexedDB. O seletor do editor de capas carrega sob demanda a família de fonte escolhida pelo Google Fonts; sem internet, a prévia usa a família de fallback disponível.

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

- **Dashboard, calendário, agendadas e rascunhos:** planejamento demonstrativo no navegador. Menus de três pontos em pop-ups flutuantes permitem editar, duplicar, agendar ou reagendar, mover entre estados e excluir com confirmação.
- **Criar publicação:** imagem única, carrossel, Story e Reel; seleção de Instagram, TikTok e YouTube; dimensões e proporções padrão; mídia, legenda, hashtags, localização, contexto e prévia. Modelos de capa podem ser inseridos no criador.
- **Conteúdo visual e laboratório de fotografia:** cada imagem do carrossel tem ações visíveis de remover, editar e reenquadrar. O editor trabalha sobre a cópia e preserva a origem e os parâmetros da edição para reabri-la ao salvar o rascunho; permite comparar, desfazer/refazer/restaurar, usar presets e controlar luz, contraste, realces, sombras, brancos/pretos, temperatura, matiz, cor, detalhe, nitidez, ruído, vinheta e grão. Recorte livre ou 1:1, 4:5, 16:9 e 9:16; reposicionamento, zoom, giro e endireitamento; exportação PNG, JPEG e WebP, com qualidade e tamanho escolhidos. Presets personalizados ficam neste navegador.
- **Modelos de publicações e editor de capas:** crie capas nos formatos de Instagram, Stories, TikTok e YouTube ou em tamanho próprio. Importe imagem/PNG e marca-d'água; adicione texto e formas, cores, cantos, opacidade, contorno, sombra, brilho e duotone. Inclui régua, guias, reordenação/visibilidade de camadas, multisseleção por Ctrl+clique, agrupamento contextual, grande catálogo de fontes, timeline com transições por objeto, prévia de movimento e exportação PNG. Os modelos salvos podem ser usados como imagem no criador.
- **Métricas e relatórios:** períodos de 7 e 28 dias, 90 dias, seis meses, um ano ou intervalo manual; indicadores, conteúdos em destaque e PDF personalizável. Os valores são exemplos demonstrativos, não insights obtidos das redes.
- **Estúdio pessoal:** painéis para preparar conexões de Meta/Instagram, TikTok e YouTube com orientação OAuth segura.
- **Notícias Entreverso TV:** notícias/episódios do portal, canal oficial e playlists/séries verificadas do YouTube, um buscador que abre o Google Trends Brasil e modelos de programas editoriais utilizáveis no criador. As tendências ao vivo são consultadas na página oficial do Google — o aplicativo não inventa números nem simula uma API.

## Limites da versão publicada

A hospedagem torna o site acessível, mas não transforma demonstrações em integrações reais. Não há backend, OAuth, armazenamento seguro de credenciais, publicação direta nem consulta de insights reais. Os botões de conexão são informativos; uma integração real exige apps registrados, credenciais seguras, backend de OAuth e permissões aprovadas pelas plataformas. Não insira segredos nesta demonstração. Rascunhos, mídia e preferências são armazenados somente neste navegador, em IndexedDB. Recursos que precisam de serviços especializados — como máscaras e retoque automático por IA — são apresentados como indisponíveis, e não como funções implementadas. A prévia das transições do compositor não é vídeo; o arquivo exportado é um PNG estático.
