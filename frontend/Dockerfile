# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Chromium for the build-time prerender (scripts/prerender.mjs). Without it the
# prerender step finds no browser, skips silently, and we ship a plain SPA with
# no per-route SEO HTML. resolveChrome() probes both /usr/bin/chromium-browser
# and /usr/bin/chromium, so this works across Alpine versions.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_URL=https://api.safironpay.com
RUN npm run build
# Fail loudly if the prerender did not run: the static template carries no
# JSON-LD, so its presence in the built landing page proves prerender executed.
RUN grep -q 'application/ld+json' dist/index.html \
    || (echo 'ERROR: prerender produced no SEO HTML (Chromium missing?)' && exit 1)

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Düzgün SPA routing config — inline echo yerine dosya olarak kopyala
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run defaults to 8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
