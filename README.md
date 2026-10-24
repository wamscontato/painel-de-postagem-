# Estúdio Social

Ferramenta genérica e responsiva para planejar conteúdo social, organizar mídia e produzir relatórios demonstrativos. O site pode ser acessado por URL hospedada; dados de rascunhos, preferências e mídia continuam guardados no navegador de cada pessoa.

Implementado em React, TypeScript e Vite. Usa fontes Poppins locais, Lucide React, Framer Motion, dnd-kit, jsPDF e IndexedDB.

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

- **Dashboard, calendário, agendadas e rascunhos:** planejamento editorial demonstrativo no navegador. Os menus de três pontos abrem como pop-ups flutuantes e permitem editar, duplicar, agendar ou reagendar, mover um agendamento para rascunhos e excluir com confirmação.
- **Criar publicação:** imagem única, carrossel, Story e Reel; seleção de Instagram, TikTok e YouTube; presets de proporção e dimensões; mídia, texto, hashtags, contexto e prévia. Selecionar uma proporção não recorta nem reexporta o arquivo.
- **Biblioteca de mídia:** upload de JPEG/PNG/WebP (até 8 MB por arquivo), edição de nome e texto alternativo, substituição, duplicação, download, encaminhamento ao criador e exclusão. Mídias e metadados ficam neste navegador, em IndexedDB.
- **Métricas e relatórios:** períodos de 7 e 28 dias, 90 dias, seis meses, um ano ou intervalo manual; indicadores, conteúdos em destaque e PDF personalizável. Os valores da tela são exemplos demonstrativos.
- **Estúdio pessoal:** painéis demonstrativos para preparar conexões de Meta/Instagram, TikTok e YouTube e consultar documentação oficial.
- **Notícias Entreverso TV:** atalhos ao portal e a seções oficiais.

## Limites da versão publicada

A hospedagem torna o site acessível, mas não transforma as demonstrações em integrações reais. Não há backend, OAuth, armazenamento seguro de credenciais, consulta de insights reais nem publicação nas plataformas. Os botões de conexão são informativos; uma integração real exige apps registrados, credenciais seguras, backend de OAuth e as permissões aprovadas em cada rede. Não insira segredos nesta demonstração. Rascunhos, mídias e preferências são armazenados somente no navegador local.
