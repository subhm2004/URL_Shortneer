# Stage 1: build the React app
FROM node:20-alpine AS build
WORKDIR /app

# Vite bakes these at build time. They are passed as build args from
# docker-compose.yml and exported as ENV so Vite sees them.
ARG VITE_API_URL=""
ARG VITE_HOSTED_MCP_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_HOSTED_MCP_URL=$VITE_HOSTED_MCP_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve the built assets with nginx and reverse-proxy to backend + mcp
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
