# Cacarejar - Instrucoes Para Agentes

Este projeto herda o fluxo geral do monorepo `hostinger-projects`.

Antes de trabalhar aqui, leia:

- `../README.md`
- `../docs/WORKFLOW.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/WORKFLOW.md`
- `docs/DEPLOY.md`

## Contexto

- Dominio: `cacarejar.com.br`
- Projeto local: `C:\Users\Marcio Leandro\hostinger-projects\cacarejar`
- Caminho remoto: `/var/www/cacarejar`
- Processo PM2: `cacarejar`
- Porta de producao: `3020`
- Stack: React, Vite, Express, tRPC, Drizzle, MySQL, PM2, Nginx
- Gerenciador: `pnpm`

## Regras De Trabalho

1. Rode `git status` antes de qualquer alteracao.
2. Trabalhe apenas dentro de `cacarejar/`, exceto quando o usuario pedir mudancas no monorepo ou nos scripts.
3. Nao commite `.env`, segredos, dumps de banco, logs, `node_modules`, `dist` ou uploads.
4. Preserve a estrutura existente: `client`, `server`, `shared`, `drizzle`.
5. Para frontend, siga o design existente e use componentes locais antes de criar novos padroes.
6. Para backend, preserve contratos tRPC/API e atualize testes quando alterar comportamento.
7. Se alterar schema ou migracoes, explique claramente o impacto no banco.
8. Nao rode deploy sem autorizacao explicita do usuario.
9. Ao finalizar, informe arquivos alterados, testes feitos e comando de deploy recomendado.

## Comandos Locais

```powershell
cd "C:\Users\Marcio Leandro\hostinger-projects\cacarejar"
pnpm install
pnpm run dev
```

Validacoes comuns:

```powershell
pnpm run check
pnpm test
pnpm run build
```

## Deploy

O deploy deve ser feito a partir da raiz do monorepo:

```powershell
cd "C:\Users\Marcio Leandro\hostinger-projects"
.\scripts\deploy-hostinger.ps1 -Project cacarejar
```

Quando o GitHub estiver configurado, prefira:

```powershell
.\scripts\update-hostinger-from-github.ps1 -Project cacarejar
```

