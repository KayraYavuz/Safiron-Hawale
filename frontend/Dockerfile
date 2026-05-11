# Build stage
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# API URL'ini doğrudan buraya yazıyoruz
ENV VITE_API_URL=https://hawala-backend-174683789974.europe-west3.run.app
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx config for SPA routing and Cloud Run port handling
RUN echo 'server { \
    listen 8080; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Cloud Run defaults to 8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
