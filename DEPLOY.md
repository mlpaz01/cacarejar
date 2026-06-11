# Deploy cacarejar.com.br — VPS Hostinger

## Pré-requisitos
- Node 20+ instalado
- pnpm instalado: `npm i -g pnpm`
- MySQL rodando, banco `cacarejar_saas` criado
- PM2 instalado: `npm i -g pm2`
- Nginx configurado

---

## 1. Banco de dados

```sql
CREATE DATABASE cacarejar_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 2. Deploy inicial

```bash
# Upload do projeto
cd /var/www
git clone <repo> cacarejar   # ou rsync do local

cd /var/www/cacarejar

# Variáveis de ambiente
cp .env.example .env
nano .env   # preencher DATABASE_URL, JWT_SECRET, PORT=3020

# Instalar dependências
pnpm install

# Migrations do banco
pnpm db:push

# Seed (cria superadmin)
pnpm db:seed

# Build
pnpm build

# PM2
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 3. Nginx

```nginx
# /etc/nginx/sites-available/cacarejar.com.br

server {
    listen 80;
    server_name cacarejar.com.br www.cacarejar.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cacarejar.com.br www.cacarejar.com.br;

    ssl_certificate     /etc/letsencrypt/live/cacarejar.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cacarejar.com.br/privkey.pem;

    client_max_body_size 50M;

    # Tudo no mesmo app (landing + /app + /admin + API)
    location / {
        proxy_pass http://localhost:3020/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/cacarejar.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL (Certbot)
certbot --nginx -d cacarejar.com.br -d www.cacarejar.com.br
```

---

## 4. Credenciais do superadmin (seed padrão)

- Email: `admin@cacarejar.com.br`
- Senha: `Cacarejar2024@`
- **Troque a senha no primeiro login!**

---

## 5. URLs

| URL | O que é |
|-----|---------|
| `cacarejar.com.br` | Landing page pública |
| `cacarejar.com.br/register` | Cadastro self-service |
| `cacarejar.com.br/login` | Login (redireciona superadmin para /admin) |
| `cacarejar.com.br/app/` | Plataforma SaaS |
| `cacarejar.com.br/admin/` | Painel do admin |

---

## 6. Atualização (deploy contínuo)

```bash
cd /var/www/cacarejar
git pull
pnpm install
pnpm build
pm2 restart cacarejar
```
