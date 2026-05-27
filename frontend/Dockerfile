# Build stage
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_URL=https://api.safironpay.com
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Düzgün SPA routing config — inline echo yerine dosya olarak kopyala
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run defaults to 8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
