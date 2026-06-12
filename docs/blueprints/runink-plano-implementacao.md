# Cacarejar - Plano de refinamento da jornada Runink

Cliente modelo: Runink  
Objetivo: demonstrar uma jornada completa de diagnóstico, mercado, conteúdo, campanha e acompanhamento.

## Sequência de implementação

### 1. QA visual e textos quebrados

Objetivo: deixar a plataforma confiável para demonstração.

Tarefas:
- Revisar acentuação quebrada nas telas antigas.
- Checar desktop e mobile das telas Diagnóstico, Radar, Aprovação, Campanhas, Métricas e Acompanhamento.
- Padronizar grid 2x2 quando houver 4 cards estratégicos.
- Corrigir qualquer botão com texto agressivo ou desalinhado.
- Verificar fluxo: criar diagnóstico -> radar -> gerar posts -> aprovação -> acompanhamento -> PDF.

Critério de pronto:
- Fluxo Runink executa sem tela estranha.
- Nenhuma tela principal com texto mojibake visível.
- Prints de QA aprovados.

### 2. PDF premium

Objetivo: transformar o relatório em entrega comercial.

Tarefas:
- Criar capa premium com cliente, data, objetivo e agentes.
- Separar seções: Parecer, Método, Fontes, Prescrição, Visão 360, Radar, Campanhas, Acompanhamento.
- Melhorar hierarquia visual.
- Garantir que grids do PDF não saiam em 3+1.
- Incluir resumo executivo e próximos passos.

Critério de pronto:
- PDF parece relatório de consultoria, não captura de tela.
- Pode ser enviado para cliente sem explicação adicional.

### 3. Campanhas e métricas conectadas

Objetivo: mostrar o que acontece depois da aprovação.

Tarefas:
- Melhorar tela Campanhas com status: em revisão, ativa, pausada, vencedora.
- Mostrar verba total, verba por criativo e regra de redistribuição.
- Mostrar criativo vencedor e motivo.
- Conectar Métricas com diagnóstico e acompanhamento.
- Criar leitura automática: CTR baixo, CPL alto, conversão baixa, comentário bom.

Critério de pronto:
- Usuário entende quanto dinheiro foi usado e por quê.
- Métricas geram recomendação clara.

### 4. Jornada guiada para cliente novo

Objetivo: reduzir passos e evitar confusão.

Tarefas:
- Criar guia visual no topo ou checklist lateral: 1 Diagnosticar, 2 Radar, 3 Aprovar posts, 4 Acompanhar.
- Cada etapa mostra estado: pendente, pronto, recomendado.
- Botão principal muda conforme contexto.
- Evitar que o usuário rode Radar sem diagnóstico ou sem base clara.

Critério de pronto:
- Usuário sabe sempre qual é o próximo clique.

### 5. Documentação para equipe e venda

Objetivo: permitir apresentar, vender e repassar para sócios/desenvolvedores.

Tarefas:
- Criar roteiro de demonstração da Runink.
- Criar checklist de QA antes da apresentação.
- Criar notas técnicas de arquitetura: GitHub, Hostinger, deploy e principais rotas.
- Criar mapa de agentes: Estrategista, Radar/Audiência, Criativo, Mídia, Analista.

Critério de pronto:
- Qualquer pessoa da equipe entende a proposta e consegue demonstrar.

## História modelo de navegação

1. O usuário entra em Diagnóstico e informa os links da Runink.
2. O Agente Estrategista cruza site, LinkedIn, Instagram, TikTok e briefing.
3. A plataforma entrega parecer, método, fontes e prescrição por canal.
4. A Visão 360 mostra 3 níveis, públicos de LinkedIn Ads e mensagens por público.
5. O usuário abre Radar, marca posts com Gostei/Não gostei e retroalimenta o parecer.
6. O usuário gera posts para aprovação.
7. Em Aprovação, escolhe os posts, edita se quiser e define verba.
8. Campanhas mostram status, verba e criativo vencedor.
9. Acompanhamento registra check-ins e compara Semana 0 com Semana 2.
10. O PDF premium consolida tudo para apresentação.

## Screenshots gerados

- `docs/blueprints/screenshots/runink-jornada/01-slide-01.png`
- `docs/blueprints/screenshots/runink-jornada/02-slide-02.png`
- `docs/blueprints/screenshots/runink-jornada/03-slide-03.png`
- `docs/blueprints/screenshots/runink-jornada/04-slide-04.png`
- `docs/blueprints/screenshots/runink-jornada/05-slide-05.png`
- `docs/blueprints/screenshots/runink-jornada/06-slide-06.png`
- `docs/blueprints/screenshots/runink-jornada/07-slide-07.png`
- `docs/blueprints/screenshots/runink-jornada/08-slide-08.png`
