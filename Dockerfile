FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm --prefix web ci && npm run build
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir data && chown -R node:node /app
COPY --from=build /app/web/dist ./web/dist
COPY server ./server
ENV HOST=0.0.0.0 PORT=8787 FACE_DB_PATH=/app/data/face.sqlite
USER node
EXPOSE 8787
CMD ["node","server/index.mjs"]
