ARG BASE_IMAGE=docker.io/library/node@sha256:4a55308cc855cba1a925d19ae4e45838741dad2fd7bb8949a93b2a0f2ae339e3
FROM ${BASE_IMAGE}
WORKDIR /app/client
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive && yarn cache clean
COPY . .
EXPOSE 3000
CMD ["yarn", "start"]
