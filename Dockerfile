FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm install --verbose --production \
    && npm cache clean --force

COPY . .

CMD ["npm", "run", "start"]
