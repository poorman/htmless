import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { c } from '../index.js';

export async function dev(): Promise<void> {
  const cwd = process.cwd();
  const composeFile = resolve(cwd, 'docker-compose.dev.yml');

  // ─── Start Docker services ───

  if (existsSync(composeFile)) {
    console.log(`  ${c.cyan}${c.bold}Starting Docker services...${c.reset}`);
    console.log('');

    try {
      execSync('docker compose -f docker-compose.dev.yml up -d', {
        stdio: 'inherit',
        cwd,
      });
      console.log('');
      console.log(`  ${c.green}Docker services up.${c.reset}`);
    } catch {
      console.log('');
      console.log(`  ${c.yellow}Warning:${c.reset} ${c.dim}Could not start Docker services.${c.reset}`);
      console.log(`  ${c.dim}Continuing anyway — make sure Postgres and Redis are available.${c.reset}`);
    }
  } else {
    console.log(`  ${c.yellow}No docker-compose.dev.yml found.${c.reset} ${c.dim}Skipping Docker services.${c.reset}`);
  }

  console.log('');

  // ─── Dev server banner ───

  const port = process.env['PORT'] ?? '4000';

  console.log(`  ${c.green}${c.bold}HTMLess dev server starting...${c.reset}`);
  console.log('');
  console.log(`  ${c.dim}API:${c.reset}     ${c.cyan}http://localhost:${port}${c.reset}`);
  console.log(`  ${c.dim}GraphQL:${c.reset} ${c.cyan}http://localhost:${port}/graphql${c.reset}`);
  console.log('');
  console.log(`  ${c.dim}Press Ctrl+C to stop${c.reset}`);
  console.log('');

  // ─── Start tsx watch ───

  const child = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
    stdio: 'inherit',
    cwd,
    env: { ...process.env },
    shell: true,
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  // Forward SIGINT / SIGTERM to child
  const forward = (signal: NodeJS.Signals) => {
    child.kill(signal);
  };

  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  // Keep the process alive
  await new Promise(() => {
    // intentionally never resolves — process exits via child.on('close')
  });
}
