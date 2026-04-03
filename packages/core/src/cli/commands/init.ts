import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { c } from '../index.js';

// ─── Template: docker-compose.dev.yml ───

const DOCKER_COMPOSE_TEMPLATE = `services:
  postgres:
    image: postgres:16-alpine
    container_name: htmless_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: htmless
      POSTGRES_PASSWORD: htmless_dev
      POSTGRES_DB: htmless
    ports:
      - "5434:5432"
    volumes:
      - htmless_pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: htmless_redis
    restart: unless-stopped
    ports:
      - "6380:6379"

volumes:
  htmless_pgdata:
`;

// ─── Template: .env ───

const ENV_TEMPLATE = `# HTMLess environment
DATABASE_URL="postgresql://htmless:htmless_dev@localhost:5434/htmless?schema=public"
REDIS_URL="redis://localhost:6380"

JWT_SECRET="change-me-to-a-long-random-string"
PORT=4000

# Storage (local or s3)
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./uploads
`;

// ─── Template: schema.prisma (minimal starter) ───

const PRISMA_SCHEMA_TEMPLATE = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Copy the full HTMLess schema from the official repo:
// https://github.com/htmless/htmless/blob/main/packages/core/prisma/schema.prisma
//
// Or run: npx prisma db pull  (if you already have a running instance)
`;

function writeIfMissing(filePath: string, content: string, label: string): boolean {
  if (existsSync(filePath)) {
    console.log(`  ${c.yellow}SKIP${c.reset}  ${label} ${c.dim}(already exists)${c.reset}`);
    return false;
  }
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  ${c.green}CREATE${c.reset}  ${label}`);
  return true;
}

export async function init(): Promise<void> {
  const cwd = process.cwd();

  console.log(`  ${c.magenta}${c.bold}Initializing HTMLess project...${c.reset}`);
  console.log(`  ${c.dim}Directory: ${cwd}${c.reset}`);
  console.log('');

  // docker-compose.dev.yml
  writeIfMissing(resolve(cwd, 'docker-compose.dev.yml'), DOCKER_COMPOSE_TEMPLATE, 'docker-compose.dev.yml');

  // .env
  writeIfMissing(resolve(cwd, '.env'), ENV_TEMPLATE, '.env');

  // prisma/schema.prisma
  const prismaDir = resolve(cwd, 'prisma');
  if (!existsSync(prismaDir)) {
    mkdirSync(prismaDir, { recursive: true });
  }
  writeIfMissing(resolve(prismaDir, 'schema.prisma'), PRISMA_SCHEMA_TEMPLATE, 'prisma/schema.prisma');

  console.log('');
  console.log(`  ${c.green}${c.bold}Done!${c.reset} Next steps:`);
  console.log('');
  console.log(`    ${c.dim}1.${c.reset} Review ${c.cyan}.env${c.reset} and update secrets`);
  console.log(`    ${c.dim}2.${c.reset} Copy the full Prisma schema or run ${c.cyan}htmless migrate${c.reset}`);
  console.log(`    ${c.dim}3.${c.reset} Start dev environment:`);
  console.log('');
  console.log(`       ${c.cyan}htmless dev${c.reset}`);
  console.log('');
}
