# Use the official Node.js 20 image.
# https://hub.docker.com/_/node
FROM node:20

# Install Yarn
RUN npm install -g yarn

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND yarn.lock are copied.
COPY package.json yarn.lock ./

# Install app dependencies using Yarn.
RUN yarn install

# Copy application files
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["yarn", "start"]
