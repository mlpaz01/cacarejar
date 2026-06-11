# Cacarejar - Workflow

## Antes De Comecar

Na raiz do monorepo:

```powershell
cd "C:\Users\Marcio Leandro\hostinger-projects"
git status
git pull
```

Entre no projeto:

```powershell
cd .\cacarejar
```

## Rodar Localmente

```powershell
pnpm install
pnpm run dev
```

## Validar Alteracoes

Use o nivel de validacao proporcional ao risco da mudanca.

Para mudancas simples de UI:

```powershell
pnpm run check
```

Para backend, rotas, banco ou comportamento compartilhado:

```powershell
pnpm test
pnpm run build
```

## Commit

Volte para a raiz do monorepo:

```powershell
cd "C:\Users\Marcio Leandro\hostinger-projects"
git status
git add cacarejar
git commit -m "Descreva a alteracao no Cacarejar"
git push
```

## Publicacao

Publique somente depois que a alteracao estiver testada e, idealmente, enviada ao GitHub.

```powershell
.\scripts\update-hostinger-from-github.ps1 -Project cacarejar
```

Se o GitHub ainda nao estiver configurado:

```powershell
.\scripts\deploy-hostinger.ps1 -Project cacarejar
```

## Checklist Para Agentes

- `git status` conferido.
- Escopo restrito ao `cacarejar/`.
- Segredos e arquivos gerados fora do commit.
- Teste ou justificativa de teste registrada.
- Deploy sugerido, mas nao executado sem autorizacao.

