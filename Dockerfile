FROM node:18-alpine

WORKDIR /app

# Copy ONLY backend-related files first to avoid touching react stuff
COPY package*.json ./

# Force install only production dependencies, ignore react-scripts
RUN npm install --omit=dev --legacy-peer-deps

COPY server.js .

EXPOSE 5000
CMD ["node", "server.js"]
