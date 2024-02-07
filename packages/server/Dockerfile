FROM node:20-bullseye-slim as build

WORKDIR /app

COPY tsconfig*.json ./
COPY package*.json ./

RUN npm install

COPY . /app
EXPOSE 3001
CMD ["npm", "run", "start:dev"]