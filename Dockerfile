FROM node:20-slim

# Install dependencies
RUN corepack enable
# Install dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    git \
    python3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set the working directory
WORKDIR /app

# Install typescript
RUN npm install -g typescript

# Copy package.json to the working directory
COPY package.json ./

# Install dependencies using pnpm
RUN pnpm install

# Copy the rest of the application files
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build the application
RUN pnpm build

# Expose the application port
EXPOSE 3000

# Start the application with the command
CMD ["/bin/sh", "-c", "pnpm prisma:deploy && pnpm start:prod"]
