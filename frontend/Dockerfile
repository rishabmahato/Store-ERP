FROM node:18-alpine
WORKDIR /app
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
COPY package.json ./
RUN npm install --force
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
