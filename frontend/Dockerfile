FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_BASE=/api/v1
ARG VITE_SOCKET_URL=
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Default to 80; Railway sets $PORT to whatever it allocates
ENV PORT=80
# Restrict envsubst to only $PORT so $host, $remote_addr etc. stay intact
ENV NGINX_ENVSUBST_FILTER=^PORT$
# Remove the stock site config so our template wins
RUN rm -f /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
