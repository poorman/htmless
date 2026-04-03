import { execSync } from 'node:child_process';
import { c } from '../index.js';

export async function migrate(): Promise<void> {
  console.log(`  ${c.magenta}${c.bold}Running database migrations...${c.reset}`);
  console.log('');

  try {
    execSync('npx prisma migrate dev', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env },
    });

    console.log('');
    console.log(`  ${c.green}${c.bold}Migrations applied successfully.${c.reset}`);
    console.log('');
  } catch (error) {
    console.log('');
    console.error(`  ${c.red}${c.bold}Migration failed.${c.reset}`);
    console.error(`  ${c.dim}Make sure your database is running and DATABASE_URL is set.${c.reset}`);
    console.log('');

    if (error instanceof Error && 'status' in error) {
      process.exit((error as NodeJS.ErrnoException & { status: number }).status ?? 1);
    }
    process.exit(1);
  }
}
