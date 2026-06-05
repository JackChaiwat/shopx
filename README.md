# ShopX - E-Commerce Marketplace Platform

ShopX is a production-ready full-stack marketplace for buyer, seller, and admin workflows.

- Backend: FastAPI, PostgreSQL, Redis, Celery
- Frontend: React, TypeScript, Tailwind CSS, Vite
- Infrastructure: Docker Compose, Nginx, MinIO
- Monitoring: Prometheus, Grafana, Loki
- Payments: PromptPay via Omise webhook, manual seller verification fallback, wallet, Stripe-ready
- Commerce features: cart, checkout, stock handling, shipping estimate, order cancellation rules, invoices, notifications, chat

---

## Current Production Status

The current local build has been verified with:

- Frontend type-check passed
- Frontend production build passed
- Docker images build successfully
- Backend, frontend, nginx, postgres, redis, minio, and worker containers are healthy
- Omise keys are configured in `.env`
- Omise webhook endpoint is configured and has received `POST /api/v1/payments/webhook/omise` with HTTP 200
- PromptPay checkout creates payment successfully
- Route-level data refresh is enabled without full-page reloads

Recommended launch mode: soft launch first, then full launch after monitoring the first real Omise payments.

---

## Prerequisites

| Tool | Minimum |
|------|---------|
| Docker | 24.x |
| Docker Compose | v2.x |
| Git | any recent version |

For production you also need:

- A domain name, for example `yourstore.xyz` or `yourstore.com`
- A VPS with Ubuntu 22.04/24.04
- Cloudflare DNS recommended
- Omise account for PromptPay auto-confirmation

Recommended VPS minimum:

| Resource | Recommended |
|----------|-------------|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 40 GB SSD or more |

---

## Quick Start - Local Docker

### 1. Clone the project

```bash
git clone https://github.com/YOUR_USERNAME/shopx.git
cd shopx
```

If you are working from the existing local folder:

```powershell
cd C:\Users\zxcvb\Downloads\ecommerce-shopx-v10\ecommerce_v2
```

### 2. Configure `.env`

Create or edit `.env`. At minimum, set strong secrets:

```env
APP_SECRET_KEY=replace-with-random-secret
JWT_SECRET_KEY=replace-with-random-secret
POSTGRES_PASSWORD=replace-with-db-password
REDIS_PASSWORD=replace-with-redis-password
MINIO_SECRET_KEY=replace-with-minio-secret
```

For Omise PromptPay auto-confirmation:

```env
OMISE_PUBLIC_KEY=pkey_test_or_live_xxxxx
OMISE_SECRET_KEY=skey_test_or_live_xxxxx
VITE_OMISE_PUBLIC_KEY=pkey_test_or_live_xxxxx
```

For production domain:

```env
ALLOWED_ORIGINS=https://yourdomain.xyz,https://www.yourdomain.xyz
VITE_API_BASE_URL=https://yourdomain.xyz/api/v1
VITE_WS_BASE_URL=wss://yourdomain.xyz
MINIO_PUBLIC_URL=https://yourdomain.xyz/storage
```

Never commit `.env` to GitHub.

### 3. Build and start

```bash
docker compose up -d --build
```

### 4. Check services

```bash
docker compose ps
docker compose logs --tail=80 backend
docker compose logs --tail=80 nginx
```

Healthy services should include:

- `ecommerce-backend`
- `ecommerce-frontend`
- `ecommerce-nginx`
- `ecommerce-postgres`
- `ecommerce-redis`
- `ecommerce-minio`
- `ecommerce-worker`

### 5. Open the app

```text
http://localhost
```

API docs:

```text
http://localhost/api/v1/docs
http://localhost/api/v1/redoc
```

---

## Omise PromptPay Setup

ShopX supports PromptPay auto-confirmation through Omise webhooks.

### Local testing with ngrok

Run ngrok:

```powershell
ngrok http 80
```

Example forwarding URL:

```text
https://your-ngrok-name.ngrok-free.dev
```

Set Omise webhook endpoint to:

```text
https://your-ngrok-name.ngrok-free.dev/api/v1/payments/webhook/omise
```

Keep ngrok running while testing.

### Production webhook

After deploying to a real domain, set Omise webhook endpoint to:

```text
https://yourdomain.xyz/api/v1/payments/webhook/omise
```

The important Omise event is:

```text
charge.complete
```

Expected successful log:

```text
POST /api/v1/payments/webhook/omise 200
```

When Omise confirms a successful charge:

- Payment becomes `paid`
- Order becomes `confirmed`
- Buyer and seller notifications are created
- Seller no longer needs to click manual verify

Manual fallback endpoint remains available for sellers:

```text
POST /api/v1/payments/seller/orders/{order_id}/verify-transfer
```

---

## Service Architecture

```text
Internet
  |
  v
Nginx :80/:443
  |-- /             -> Frontend React SPA
  |-- /api/v1/*     -> Backend FastAPI
  |-- /ws/*         -> Backend WebSocket
  |-- /storage/*    -> MinIO public files
  |
  |-- Backend -> PostgreSQL
  |-- Backend -> Redis
  |-- Backend -> MinIO
  |-- Worker  -> Redis/Celery
  |-- Beat    -> Scheduled jobs
```

---

## Main Features

### Buyer

- Register/login
- Product browsing and search
- Cart
- Checkout
- Saved shipping addresses
- Google Maps delivery pin fields
- Distance-based shipping estimate
- PromptPay QR payment
- Order tracking
- Customer order cancellation while order is still cancellable
- Notifications
- Chat with seller

### Seller

- Dashboard
- Product and stock management
- Order management
- Verify transfer fallback
- Payment notifications
- Reviews
- Shop settings
- Homepage slides
- Chat with customers

### Admin

- Admin dashboard
- Users, shops, products, orders, reviews
- Billing and analytics-ready views
- Monitoring stack included

---

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh token |
| GET | `/api/v1/products` | List products |
| GET | `/api/v1/products/slug/{slug}` | Product detail |
| POST | `/api/v1/cart/items` | Add to cart |
| GET | `/api/v1/cart` | Get cart |
| POST | `/api/v1/orders/checkout` | Create order |
| GET | `/api/v1/orders` | Buyer orders |
| GET | `/api/v1/orders/{order_id}` | Order detail |
| POST | `/api/v1/orders/{order_id}/cancel` | Customer cancel order when allowed |
| GET | `/api/v1/orders/shipping-estimate` | Estimate shipping |
| GET | `/api/v1/orders/seller/orders` | Seller orders |
| PATCH | `/api/v1/orders/seller/orders/{order_id}/status` | Seller update order status |
| POST | `/api/v1/payments` | Create payment |
| POST | `/api/v1/payments/webhook/omise` | Omise webhook |
| POST | `/api/v1/payments/seller/orders/{order_id}/verify-transfer` | Seller manual verification |
| GET | `/api/v1/notifications` | List notifications |
| POST | `/api/v1/notifications/{id}/read` | Mark notification read |
| GET | `/api/v1/chat/rooms` | Chat rooms |
| POST | `/api/v1/chat/rooms/by-order/{order_id}` | Create/find order chat room |
| WS | `/ws/chat/{room_id}?token=<jwt>` | Real-time chat |

---

## GitHub Deployment Flow

GitHub is used for source control. It does not replace the VPS.

Recommended flow:

```text
Local machine -> GitHub -> VPS -> Docker Compose
```

Manual deploy on VPS:

```bash
git clone https://github.com/YOUR_USERNAME/shopx.git
cd shopx
nano .env
docker compose up -d --build
```

Update deploy:

```bash
git pull
docker compose up -d --build
```

Do not push `.env`, database volumes, MinIO data, or secrets to GitHub.

---

## Production Deployment - VPS + Domain

### 1. Buy a domain

Example:

```text
yourstore.xyz
www.yourstore.xyz
```

### 2. Point domain to VPS

In Cloudflare DNS:

```text
A    @      VPS_PUBLIC_IP
A    www    VPS_PUBLIC_IP
```

### 3. Configure firewall

Open only needed ports:

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### 4. Deploy with Docker Compose

```bash
docker compose up -d --build
docker compose ps
```

### 5. Configure HTTPS

Recommended options:

- Cloudflare proxy + SSL
- Let's Encrypt / Certbot

For Let's Encrypt, place certificates in:

```text
nginx/ssl/
```

Then update nginx config to use:

```nginx
listen 443 ssl;
ssl_certificate     /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
```

### 6. Update Omise webhook

```text
https://yourdomain.xyz/api/v1/payments/webhook/omise
```

---

## Environment Checklist Before Launch

- [ ] Strong `APP_SECRET_KEY`
- [ ] Strong `JWT_SECRET_KEY`
- [ ] Strong Postgres password
- [ ] Strong Redis password
- [ ] Strong MinIO keys
- [ ] Real Omise keys are set
- [ ] Omise webhook endpoint is set
- [ ] `ALLOWED_ORIGINS` uses the real domain
- [ ] Frontend API/WS URLs use the real domain
- [ ] SMTP is configured for real email delivery
- [ ] Domain DNS points to VPS
- [ ] HTTPS is enabled
- [ ] `docker compose ps` shows healthy services
- [ ] First real PromptPay order auto-confirms through Omise
- [ ] Backups are configured

---

## Testing Checklist

Run frontend checks:

```bash
cd frontend
npm run type-check
npm run build
```

Run Docker checks:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=80 backend
docker compose logs --tail=80 nginx
docker compose logs --tail=80 worker
```

Expected:

- No TypeScript errors
- No backend traceback
- No repeated 500 errors
- Omise webhook returns 200 after payment
- Chat sends messages without refreshing the page
- Notifications update after order/payment/chat events
- Orders and seller pages refetch data when opened

---

## Monitoring

| Service | Local URL |
|---------|-----------|
| Grafana | `http://localhost:3001` |
| Prometheus | `http://localhost:9090` |
| Loki | `http://localhost:3100` |
| MinIO Console | `http://localhost:9001` |

---

## Troubleshooting

### Docker cannot pull images

```bash
docker pull python:3.12-slim
docker pull node:20-alpine
docker pull nginx:1.25-alpine
docker compose up -d --build
```

### Backend returns 502 during rebuild

This is normal while containers restart. Wait until backend is healthy:

```bash
docker compose ps
```

### Backend errors

```bash
docker compose logs --tail=120 backend
```

### Nginx routing errors

```bash
docker compose logs --tail=120 nginx
```

### Omise webhook does not arrive locally

- Keep ngrok running
- Use the current ngrok HTTPS URL
- Make sure Omise webhook endpoint is updated
- Check nginx log for `POST /api/v1/payments/webhook/omise`

### Reset local data

Warning: this deletes local database/storage volumes.

```bash
docker compose down -v
docker compose up -d --build
```

---

## License

MIT
