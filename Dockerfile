FROM node:lts-alpine

ENV NODE_ENV=production

WORKDIR /app
COPY package.json .

RUN npm install --verbose --production

COPY . .

CMD ["npm", "run", "start"]
