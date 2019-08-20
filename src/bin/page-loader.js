#!/usr/bin/env node
import program from 'commander';
import { version, description } from '../../package.json';
import loadPage from '..';

program
  .version(version, '-V, --version')
  .description(description)
  .arguments('<pageAddress>')
  .option('-o, --output [dirname]', '  Output directory', __dirname)
  .action(pageAddress => loadPage(program.output, pageAddress)
    .then(() => console.log(`Page ${pageAddress} successfully loaded to ${program.output} ! `))
    .catch(err => console.log(`Error loading page ${pageAddress}: ${err}`)))
  .parse(process.argv);
