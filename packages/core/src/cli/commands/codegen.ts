import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { c } from '../index.js';

export async function codegen(): Promise<void> {
  const { values } = parseArgs({
    options: {
      space: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o', default: 'htmless.d.ts' },
      url: { type: 'string', default: 'http://localhost:4000' },
    },
    allowPositionals: true,
    strict: false,
  });

  const spaceId = values.space as string | undefined;
  const output = (values.output as string) ?? 'htmless.d.ts';
  const baseUrl = (values.url as string) ?? 'http://localhost:4000';

  if (!spaceId) {
    console.log(`  ${c.red}${c.bold}Missing --space flag.${c.reset}`);
    console.log(`  ${c.dim}Usage: htmless codegen --space <spaceId>${c.reset}`);
    console.log('');
    console.log(`  ${c.bold}OPTIONS${c.reset}`);
    console.log(`    ${c.yellow}--space, -s${c.reset}   ${c.dim}Space ID to generate types for (required)${c.reset}`);
    console.log(`    ${c.yellow}--output, -o${c.reset}  ${c.dim}Output file path (default: htmless.d.ts)${c.reset}`);
    console.log(`    ${c.yellow}--url${c.reset}         ${c.dim}API base URL (default: http://localhost:4000)${c.reset}`);
    console.log('');
    process.exit(1);
  }

  console.log(`  ${c.magenta}${c.bold}Generating TypeScript types...${c.reset}`);
  console.log(`  ${c.dim}Space: ${spaceId}${c.reset}`);
  console.log('');

  let content: string;

  // Strategy 1: Try importing the codegen module directly (works when
  // running inside the HTMLess repo with access to Prisma client)
  try {
    const { generateTypeScript } = await import('../../schema/codegen.js');
    content = await generateTypeScript(spaceId);
    console.log(`  ${c.dim}Source: direct database query${c.reset}`);
  } catch {
    // Strategy 2: Fall back to calling the CMA API endpoint
    console.log(`  ${c.dim}Direct import unavailable, calling API...${c.reset}`);

    try {
      const url = `${baseUrl}/api/cma/spaces/${spaceId}/codegen`;
      const resp = await fetch(url);

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`API returned ${resp.status}: ${body}`);
      }

      content = await resp.text();
      console.log(`  ${c.dim}Source: ${url}${c.reset}`);
    } catch (apiErr) {
      console.log('');
      console.error(`  ${c.red}${c.bold}Codegen failed.${c.reset}`);

      if (apiErr instanceof Error) {
        console.error(`  ${c.dim}${apiErr.message}${c.reset}`);
      }

      console.log('');
      console.error(`  ${c.dim}Make sure the HTMLess API is running at ${baseUrl}${c.reset}`);
      console.error(`  ${c.dim}or run this command from inside the HTMLess project root.${c.reset}`);
      console.log('');
      process.exit(1);
    }
  }

  const outPath = resolve(process.cwd(), output);
  writeFileSync(outPath, content, 'utf-8');

  console.log('');
  console.log(`  ${c.green}${c.bold}Types written to ${output}${c.reset}`);
  console.log(`  ${c.dim}${outPath}${c.reset}`);
  console.log('');
}
