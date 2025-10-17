# Simple Dockerfile - no nginx complexity

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend serves everything
FROM node:20-alpine
WORKDIR /app

# Copy backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Copy built frontend to backend's public folder
COPY --from=frontend-builder /app/frontend/dist ./public

# Expose port
EXPOSE 3001

# Start backend
CMD ["node", "server.js"]
