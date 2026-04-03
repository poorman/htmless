import { execSync } from 'node:child_process';
import { c } from '../index.js';

export async function seed(): Promise<void> {
  console.log(`  ${c.magenta}${c.bold}Seeding database...${c.reset}`);
  console.log('');

  try {
    execSync('npx prisma db seed', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env },
    });

    console.log('');
    console.log(`  ${c.green}${c.bold}Database seeded successfully.${c.reset}`);
    console.log('');
  } catch (error) {
    console.log('');
    console.error(`  ${c.red}${c.bold}Seed failed.${c.reset}`);
    console.error(`  ${c.dim}Make sure your database is running and migrations are up to date.${c.reset}`);
    console.error(`  ${c.dim}Run ${c.cyan}htmless migrate${c.dim} first if needed.${c.reset}`);
    console.log('');

    if (error instanceof Error && 'status' in error) {
      process.exit((error as NodeJS.ErrnoException & { status: number }).status ?? 1);
    }
    process.exit(1);
  }
}
