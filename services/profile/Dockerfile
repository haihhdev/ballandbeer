FROM node:23-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env .env
EXPOSE 4004
CMD ["node", "src/app.js"]
