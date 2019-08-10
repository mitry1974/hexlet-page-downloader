#!/usr/bin/env node
import program from 'commander';
import { version, description } from '../../package.json';
import loadPage from '..';

program
  .version(version, '-V, --version')
  .description(description)
  .arguments('<pageAddress>')
  .option('-o, --output [dirname]', '  Output directory', __dirname)
  .action(pageAddress => loadPage(program.output, pageAddress))
  .parse(process.argv);
