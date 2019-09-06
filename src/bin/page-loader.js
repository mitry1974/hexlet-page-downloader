#!/usr/bin/env node
import program from 'commander';
import { version, description } from '../../package.json';
import loadPage from '..';

program
  .version(version, '-V, --version')
  .description(description)
  .arguments('<pageAddress>')
  .option('-o, --output [dirname]', '  Output directory', __dirname)
  .action((pageAddress) => {
    console.log(`loading page: ${pageAddress} to directory: ${program.output}`);
    return loadPage(program.output, pageAddress)
      .then(() => {
        console.log(`Page ${pageAddress} successfully loaded to ${program.output} ! `);
      })
      .catch((err) => {
        console.error(`Error loading page ${pageAddress}: ${err}`);
        process.exit(-1);
      });
  })
  .parse(process.argv);
