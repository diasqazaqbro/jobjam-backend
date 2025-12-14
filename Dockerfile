FROM node:18-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client for Linux ARM64
RUN PRISMA_CLI_BINARY_TARGETS=linux-arm64-openssl-3.0.x npx prisma generate

# Build application
RUN npm run build

EXPOSE 3001

# Start command will be overridden by docker-compose
CMD ["npm", "run", "start:prod"]

