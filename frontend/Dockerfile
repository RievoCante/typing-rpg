# Stage 1: Build the app
FROM node:20-alpine AS builder
# ↑ Use Node 20 on Alpine Linux (lightweight)
# "AS builder" names this stage

WORKDIR /app
# ↑ Set working directory inside container

COPY package.json bun.lock ./
# ↑ Copy dependency files first (for caching)

RUN npm install -g bun && bun install
# ↑ Install Bun and dependencies

COPY . .
# ↑ Copy all source code

# Accept build arguments for environment variables
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_URL
ARG VITE_SENTRY_DSN

# Make them available during build
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

RUN bun run build
# ↑ Build the production app

# Stage 2: Serve the app
FROM nginx:alpine
# ↑ Use Nginx to serve static files

COPY --from=builder /app/dist /usr/share/nginx/html
# ↑ Copy built files from Stage 1

COPY nginx.conf /etc/nginx/nginx.conf
# ↑ Custom Nginx config

EXPOSE 80
# ↑ Container listens on port 80

CMD ["nginx", "-g", "daemon off;"]
# ↑ Start Nginx