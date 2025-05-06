FROM node:23-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4004
CMD ["node", "src/app.js"]
