# Build the Träningsreturen frontend and serve it with nginx.
# Build context is the repo root.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
ARG VITE_KEYCLOAK_URL=http://localhost:8080
ARG VITE_KEYCLOAK_REALM=traningsreturen
ARG VITE_KEYCLOAK_CLIENT_ID=traningsreturen-app
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter @traningsreturen/frontend
COPY frontend frontend
RUN pnpm --filter @traningsreturen/frontend run build

FROM nginx:1.27-alpine
# The Portainer stack swaps in deploy/nginx.tls.conf. Copied as a template so
# the nginx entrypoint fills in ${ENV_VARS} (e.g. PUBLIC_URL) at startup;
# nginx's own $variables are left alone.
ARG NGINX_CONF=deploy/nginx.conf
COPY ${NGINX_CONF} /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
