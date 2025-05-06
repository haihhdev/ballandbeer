FROM node:23-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env .env
EXPOSE 4002
CMD ["node", "src/server.js"]
