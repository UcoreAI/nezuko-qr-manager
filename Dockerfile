# 1. Use an official Node.js v18 image based on Alpine (smaller)
FROM node:18-alpine

# 2. Set working directory
WORKDIR /usr/src/app

# 3. Copy package definition files
COPY package*.json ./

# 4. Install dependencies 
#    Alpine needs python3, make, g++ for some builds
RUN apk add --no-cache python3 make g++ && \
    npm install --omit=dev && \
    apk del python3 make g++

# 5. Copy application code (including server.js)
COPY . .

# 6. Expose the internal port the server listens on
EXPOSE 8080

# 7. Command to run the server using the correct file name 'server.js'
CMD [ "node", "server.js" ] 
