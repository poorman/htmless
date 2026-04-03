#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ─── ANSI helpers ───

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[97m',
  bgCyan: '\x1b[46m',
  bgRed: '\x1b[41m',
};

export { c };

// ─── Version ───

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Walk up from dist/cli/ or src/cli/ to find package.json
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
      try {
        const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
        if (pkg.name === '@htmless/core') return pkg.version;
      } catch {
        // not found here, go up
      }
      dir = dirname(dir);
    }
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ─── Banner ───

function printBanner(version: string): void {
  console.log('');
  console.log(`  ${c.cyan}${c.bold}HTMLess${c.reset} ${c.dim}v${version}${c.reset}`);
  console.log(`  ${c.dim}The open-source headless CMS that doesn't suck${c.reset}`);
  console.log('');
}

// ─── Command dispatch ───

const COMMANDS = ['init', 'migrate', 'seed', 'dev', 'codegen', 'help'] as const;
type Command = (typeof COMMANDS)[number];

async function main(): Promise<void> {
  const version = getVersion();

  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.version) {
    console.log(version);
    process.exit(0);
  }

  const command = (process.argv[2] ?? 'help') as Command;

  if (values.help && command === 'help') {
    printBanner(version);
    const { help } = await import('./commands/help.js');
    help();
    process.exit(0);
  }

  if (!COMMANDS.includes(command)) {
    printBanner(version);
    console.log(`  ${c.red}${c.bold}Unknown command:${c.reset} ${command}`);
    console.log(`  ${c.dim}Run ${c.cyan}htmless help${c.dim} to see available commands${c.reset}`);
    console.log('');
    process.exit(1);
  }

  printBanner(version);

  switch (command) {
    case 'init': {
      const { init } = await import('./commands/init.js');
      await init();
      break;
    }
    case 'migrate': {
      const { migrate } = await import('./commands/migrate.js');
      await migrate();
      break;
    }
    case 'seed': {
      const { seed } = await import('./commands/seed.js');
      await seed();
      break;
    }
    case 'dev': {
      const { dev } = await import('./commands/dev.js');
      await dev();
      break;
    }
    case 'codegen': {
      const { codegen } = await import('./commands/codegen.js');
      await codegen();
      break;
    }
    case 'help': {
      const { help } = await import('./commands/help.js');
      help();
      break;
    }
  }
}

main().catch((err: unknown) => {
  console.error(`\n  ${c.red}${c.bold}Fatal error:${c.reset}`, err);
  process.exit(1);
});
