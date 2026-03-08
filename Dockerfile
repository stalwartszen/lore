FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/server/package.json ./packages/server/
COPY packages/core/package.json ./packages/core/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install
COPY . .
RUN pnpm build
RUN pnpm --filter @lore/server db:generate
EXPOSE 3000
CMD ["pnpm", "start"]
