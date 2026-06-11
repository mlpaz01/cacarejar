# Cacarejar - Deploy Hostinger

## Producao

| Item | Valor |
| --- | --- |
| Dominio | `cacarejar.com.br` |
| Host | `2.24.104.195` |
| Usuario SSH | `root` |
| Caminho remoto | `/var/www/cacarejar` |
| PM2 | `cacarejar` |
| Porta | `3020` |

## Script Oficial

O deploy oficial fica na raiz do monorepo:

```powershell
cd "C:\Users\Marcio Leandro\hostinger-projects"
.\scripts\deploy-hostinger.ps1 -Project cacarejar
```

O script:

- empacota o projeto local;
- envia para `/tmp` no servidor;
- cria backup de `/var/www/cacarejar`;
- sincroniza com `rsync --delete`;
- nao envia `.env`, `node_modules`, `dist` nem uploads;
- roda `pnpm install`;
- roda `pnpm run build`;
- recarrega `pm2 reload cacarejar`.

## Deploy Pelo GitHub

Quando o remoto GitHub estiver configurado, prefira:

```powershell
cd "C:\Users\Marcio Leandro\hostinger-projects"
.\scripts\update-hostinger-from-github.ps1 -Project cacarejar
```

Esse comando primeiro atualiza a copia local com `git pull --ff-only` e depois executa o deploy.

## Rollback

Cada deploy cria um backup remoto com timestamp:

```text
/var/www/cacarejar.backup-YYYYMMDD-HHMMSS
```

Para rollback manual, use SSH e restaure o backup desejado com cuidado. Antes de qualquer rollback, confira o caminho exato do backup e o estado atual do PM2.

## Comandos Uteis No Servidor

```bash
pm2 status
pm2 logs cacarejar
pm2 reload cacarejar
nginx -t
systemctl reload nginx
```

