FROM node:20-bullseye-slim as build
WORKDIR /app

COPY tsconfig*.json ./
COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . /app

CMD ["npm", "start"]