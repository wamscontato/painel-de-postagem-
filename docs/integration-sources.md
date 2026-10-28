# Fontes oficiais das integrações sociais

Consulta: 28 de outubro de 2026. Este registro fundamenta os escopos, endpoints e avisos no produto. Não representa aprovação de app pelos fornecedores. Antes de alterar versão, permissões ou métricas, verificar novamente as referências oficiais.

## Instagram — Instagram Login para contas profissionais

A rota escolhida é Instagram Login, sem dependência de uma Página do Facebook conectada. Somente contas profissionais Business/Creator são elegíveis. Para leitura básica e insights, pedir `instagram_business_basic` e `instagram_business_manage_insights`; não pedir permissões de publicação, comentários ou mensagens. Contas de terceiros podem exigir Advanced Access, análise do app e verificação empresarial.

O endpoint de insights de conta é `GET https://graph.instagram.com/v26.0/{ig-user-id}/insights`. A versão mais recente encontrada no changelog oficial consultado é `v26.0`. O endpoint aceita métricas/períodos com combinações documentadas; métricas indisponíveis devem permanecer ausentes, não virar zero. `follower_count` e `online_followers` não estão disponíveis abaixo de 100 seguidores; `online_followers` cobre somente os últimos 30 dias; dados podem atrasar até 48 horas. A interface deve mostrar cobertura e omitir campos não retornados.

A troca OAuth é server-side: autorização em `https://www.instagram.com/oauth/authorize`, token curto em `https://api.instagram.com/oauth/access_token`, troca por token longo em `https://graph.instagram.com/access_token`, e renovação em `https://graph.instagram.com/refresh_access_token`. O token longo expira em 60 dias; a renovação precisa ocorrer antes da expiração e segue as condições do provedor.

Fontes Meta: [Graph API Changelog](https://developers.facebook.com/docs/graph-api/changelog/), [Instagram API with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login), [Instagram Account Insights](https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights), [Business Login for Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login), [Instagram Media Insights](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights).

## TikTok — Login Kit + Display API

Usar Display API para dados da própria conta autorizada, não Research API nem Content Posting API. Solicitar `user.info.basic`, `user.info.stats` (necessário para contagens de seguidores/curtidas/vídeos) e `video.list`. O produto/app e os escopos precisam de aprovação; o callback registrado deve ser HTTPS, estático e coincidir exatamente. Mostrar vídeos públicos e contagens por vídeo `view_count`, `like_count`, `comment_count` e `share_count`, além de totais de perfil disponíveis. Essas contagens são atuais/lifetime no momento da leitura; não representam desempenho diário histórico. Não persistir legendas nem baixar mídias.

A autorização web ocorre em `https://www.tiktok.com/v2/auth/authorize/`; troca e refresh em `POST https://open.tiktokapis.com/v2/oauth/token/`; revogação em `POST https://open.tiktokapis.com/v2/oauth/revoke/`. O token de acesso dura 24 horas; o refresh token normalmente é válido por 365 dias e pode ser rotacionado: persistir imediatamente o valor novo quando retornar.

Fontes TikTok: [Display API overview](https://developers.tiktok.com/doc/display-api-overview), [Get Started](https://developers.tiktok.com/doc/display-api-get-started/), [Login Kit Web](https://developers.tiktok.com/doc/login-kit-web/), [User Info](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info), [Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes), [List Videos](https://developers.tiktok.com/doc/tiktok-api-v2-video-list), [Video Object](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-object), [Token Management](https://developers.tiktok.com/doc/oauth-user-access-token-management), [App Review Guidelines](https://developers.tiktok.com/docs/en/app-review-guidelines).

## YouTube — Analytics API para canal próprio

Consultar `GET https://youtubeanalytics.googleapis.com/v2/reports`. O endpoint requer `ids`, `startDate`, `endDate` e ao menos uma métrica; usar `ids=channel==MINE`, nunca um canal alheio. A nota atual no topo da referência de `reports.query` exige `https://www.googleapis.com/auth/youtube.readonly`; seguir essa exigência específica, apesar de exemplos/descrições mais antigos na mesma página mencionarem `yt-analytics.readonly`. Não pedir escopo monetário nem permissão de gestão.

A API não é em tempo real: processamento típico tem atraso de 48–72 horas e o fim do período retornado pode ser anterior à data pedida. Combinações de métricas/dimensões variam por relatório. Mostrar a última data efetivamente retornada e não completar dias ausentes. Refresh tokens permanecem sujeitos a revogação, política e expiração do Google.

Fontes Google/YouTube: [Reports Query](https://developers.google.com/youtube/analytics/reference/reports/query), [Analytics Data Model](https://developers.google.com/youtube/analytics/data_model), [Channel Reports](https://developers.google.com/youtube/analytics/v1/channel_reports), [Metrics](https://developers.google.com/youtube/analytics/v1/dimsmets/mets), [OAuth Web Server](https://developers.google.com/identity/protocols/oauth2/web-server), [OAuth scopes](https://developers.google.com/identity/protocols/oauth2/scopes), [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies).

## Regra de apresentação

Métricas só existem quando a API as retorna para uma conta consentida e para a cobertura disponível. Nunca rotular contagens vitalícias do TikTok como série do período; não somar alcance ausente como zero; não comparar definições incompatíveis sem indicar a fonte. O cache local do servidor é separado por conta autenticada e a desconexão elimina tokens e instantâneos daquela conta. A publicação automatizada permanece fora do escopo.
