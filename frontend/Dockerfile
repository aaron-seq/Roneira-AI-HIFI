# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock if you use yarn)
COPY package*.json ./

# Install app dependencies with legacy peer deps to resolve ESLint conflict
RUN npm install --legacy-peer-deps

# Copy the rest of the application's code
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run the app in development mode when the container launches
CMD ["npm", "run", "dev"]
