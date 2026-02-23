# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy server file into container
COPY index.js .

# Expose the port the server listens on
EXPOSE 5000

# Run the server
CMD ["node", "index.js"]