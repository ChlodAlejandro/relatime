FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json LICENSE ./
COPY ./src/ src/

RUN npm install --verbose
RUN npx tsc

FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm install --verbose --production \
    && npm cache clean --force \
    && rm -rf /root/.npm \
    && rm -rf /tmp/*

COPY --from=build /app/build build/

CMD ["npm", "run", "start"]
