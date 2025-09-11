FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm install --verbose --production

COPY . .

CMD ["npm", "run", "start"]
