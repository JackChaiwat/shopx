# ─────────────────────────────────────────
# Stage 1: builder
# ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_WS_BASE_URL=/ws
ARG VITE_APP_NAME=ShopX
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_OMISE_PUBLIC_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_SENTRY_DSN

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_BASE_URL=$VITE_WS_BASE_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_OMISE_PUBLIC_KEY=$VITE_OMISE_PUBLIC_KEY \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ─────────────────────────────────────────
# Stage 2: production (nginx)
# ─────────────────────────────────────────
FROM nginx:1.25-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
