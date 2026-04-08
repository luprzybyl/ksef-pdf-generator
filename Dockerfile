FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ src/
COPY tsconfig.base.json tsconfig.json ./
RUN npx esbuild src/server/server.ts --bundle --platform=node --outfile=dist-server/server.cjs --format=cjs

FROM node:22-alpine

WORKDIR /app
COPY --from=build /app/dist-server/server.cjs ./server.cjs

ENV PORT=3000
ENV INVOICES_DIR=/faktury
EXPOSE 3000

CMD ["node", "server.cjs"]
