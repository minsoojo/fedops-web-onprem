ARG BASE_IMAGE=docker.io/library/node@sha256:4a55308cc855cba1a925d19ae4e45838741dad2fd7bb8949a93b2a0f2ae339e3
FROM ${BASE_IMAGE}
WORKDIR /app/server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
EXPOSE 4000
CMD ["node", "src/index.js"]
