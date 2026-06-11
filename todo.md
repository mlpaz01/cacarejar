# NoMeuTempo Marketing Engine — TODO

## Schema & Backend
- [x] Definir e aplicar schema do banco: campaigns, creatives, metrics, integrations, calibration_logs, dispatch_logs
- [x] Criar routers tRPC: campaigns, creatives, metrics, integrations, calibration, dispatch
- [x] Implementar cron job de disparo automático (heartbeat)
- [x] Implementar motor de recalibração com LLM (OpenRouter — Claude 3.5 Haiku)
- [x] Implementar geração de imagens com IA (helper integrado + prompt otimizado via OpenRouter)

## Frontend — Layout & Design System
- [x] Configurar design system premium (cores, tipografia, espaçamento, tokens)
- [x] Implementar AppLayout com sidebar elegante e navegação principal
- [x] Criar componentes reutilizáveis: StatusBadge, MetricCard, ChannelBadge, CreativeCard

## Tela 1 — Dashboard Central
- [x] Visão geral de campanhas ativas com cards de métricas (impressões, cliques, conversões, ROI)
- [x] Alertas de recalibração em destaque
- [x] Gráfico de performance geral (últimos 30 dias)
- [x] Lista de campanhas ativas com status e progresso de orçamento

## Tela 2 — Campanhas
- [x] Listagem de campanhas com filtros por canal, status e período
- [x] Formulário de criação/edição: objetivo, público-alvo, orçamento, canais, período
- [x] Detalhes da campanha com métricas e criativos vinculados
- [x] Ações: pausar, reativar, arquivar campanha

## Tela 3 — Geração de Criativos
- [x] Formulário de briefing textual para geração de imagem com IA
- [x] Visualização do criativo gerado com opções de aprovação/rejeição
- [x] Vinculação de criativo a uma campanha
- [x] Status de geração (em progresso, aprovado, rejeitado)

## Tela 4 — Painel de Métricas
- [x] Gráficos de performance por canal (recharts)
- [x] Gráficos por campanha e por período
- [x] Comparativos entre campanhas
- [x] Análise de tendências (semanal/mensal)

## Tela 5 — Motor de Recalibração
- [x] Painel de sugestões geradas pelo LLM
- [x] Detalhamento: ajuste de orçamento, público-alvo e criativos
- [x] Histórico de recalibrações aplicadas
- [x] Ação de aplicar/ignorar sugestão

## Tela 6 — Biblioteca de Criativos
- [x] Grid de todos os criativos gerados
- [x] Filtros por campanha, canal e status
- [x] Histórico de uso de cada criativo
- [x] Reutilização em nova campanha

## Tela 7 — Configuração de Integrações
- [x] Cards por canal: LinkedIn, TikTok, Instagram, Google
- [x] Campos de token/API key por canal
- [x] Status de conexão (conectado/desconectado/erro)
- [x] Logs de disparo por canal

## Testes & Entrega
- [x] Testes vitest para routers principais (12 testes passando)
- [x] Validação da chave OpenRouter (345 modelos disponíveis)
- [x] Checkpoint final
- [x] Entrega ao usuário
