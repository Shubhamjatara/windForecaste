FROM node:22-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG SERVER_URL=""
ENV SERVER_URL=$SERVER_URL
RUN pnpm build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
