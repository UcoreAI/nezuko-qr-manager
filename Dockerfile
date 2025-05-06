# Use a simple Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose the internal port the server listens on
EXPOSE 8080

# Command to run the server
CMD [ "npm", "start" ]
