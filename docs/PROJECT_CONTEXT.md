# Cacarejar - Contexto Do Projeto

## Resumo

O Cacarejar e um app SaaS hospedado em `cacarejar.com.br`. Ele roda como aplicacao Node/PM2 na VPS da Hostinger, com Nginx fazendo proxy para a porta `3020`.

## Ambiente

| Item | Valor |
| --- | --- |
| Dominio | `cacarejar.com.br` |
| Caminho local | `C:\Users\Marcio Leandro\hostinger-projects\cacarejar` |
| Caminho remoto | `/var/www/cacarejar` |
| Processo PM2 | `cacarejar` |
| Porta | `3020` |
| Deploy pelo monorepo | `.\scripts\deploy-hostinger.ps1 -Project cacarejar` |

## Stack

- React 19
- Vite
- Tailwind
- shadcn/ui
- Express
- tRPC
- Drizzle ORM
- MySQL
- PM2
- Nginx
- pnpm

## Estrutura Principal

```text
cacarejar/
  client/      Frontend React
  server/      Backend Express/tRPC
  shared/      Tipos e constantes compartilhadas
  drizzle/     Schema e migracoes
  patches/     Patches pnpm
  site/        Assets/conteudos auxiliares
```

## Arquivos Importantes

- `client/src/App.tsx`: rotas e layout principal.
- `client/src/pages/`: telas do produto.
- `client/src/components/`: componentes reutilizaveis.
- `client/src/index.css`: tema e estilos globais.
- `server/routers.ts`: contratos tRPC.
- `server/db.ts`: helpers de banco.
- `drizzle/schema.ts`: schema do banco.
- `ecosystem.config.cjs`: configuracao PM2 de producao.
- `package.json`: scripts e dependencias.

## Cuidados

- Nao versionar `.env`.
- Nao versionar `node_modules`.
- Nao versionar builds gerados em `dist`.
- Evitar mexer em `server/_core` sem necessidade real.
- Mudancas de banco precisam de revisao cuidadosa antes de producao.

