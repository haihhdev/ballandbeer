# Stage 1: Build Next.js app
FROM node:23-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env.local.build .env.local
RUN npm run build

# Stage 2: Run production server
FROM node:23-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
