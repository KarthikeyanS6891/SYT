FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY . .
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
