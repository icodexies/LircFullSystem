# The LIRC Library System as a container: build the site, serve it with
# nginx. Runs anywhere Docker runs:
#
#   docker build -t lirc-library-system .
#   docker run -p 8080:80 lirc-library-system        → http://localhost:8080
#
# or simply:  docker compose up --build
#
# The build reads .env.production (committed) for the database address and
# the public anon key — the same values the deployed site uses.

# --- Build the site -------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve it -------------------------------------------------------------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
