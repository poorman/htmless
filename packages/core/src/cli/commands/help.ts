import { c } from '../index.js';

interface CommandEntry {
  name: string;
  description: string;
}

const commands: CommandEntry[] = [
  { name: 'init', description: 'Scaffold a new HTMLess project in the current directory' },
  { name: 'migrate', description: 'Run Prisma database migrations (prisma migrate dev)' },
  { name: 'seed', description: 'Seed the database with initial data (prisma db seed)' },
  { name: 'dev', description: 'Start Docker services and the dev server with hot reload' },
  { name: 'codegen', description: 'Generate TypeScript types from your content schema' },
  { name: 'help', description: 'Show this help message' },
];

export function help(): void {
  console.log(`  ${c.bold}USAGE${c.reset}`);
  console.log(`    ${c.cyan}htmless${c.reset} ${c.green}<command>${c.reset} ${c.dim}[options]${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}COMMANDS${c.reset}`);

  const maxLen = Math.max(...commands.map((cmd) => cmd.name.length));

  for (const cmd of commands) {
    const padded = cmd.name.padEnd(maxLen + 2);
    console.log(`    ${c.green}${padded}${c.reset} ${c.dim}${cmd.description}${c.reset}`);
  }

  console.log('');
  console.log(`  ${c.bold}OPTIONS${c.reset}`);
  console.log(`    ${c.yellow}--help, -h${c.reset}      ${c.dim}Show help${c.reset}`);
  console.log(`    ${c.yellow}--version, -v${c.reset}   ${c.dim}Show version number${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}EXAMPLES${c.reset}`);
  console.log(`    ${c.dim}$${c.reset} htmless init`);
  console.log(`    ${c.dim}$${c.reset} htmless migrate`);
  console.log(`    ${c.dim}$${c.reset} htmless dev`);
  console.log(`    ${c.dim}$${c.reset} htmless codegen`);
  console.log('');
}
