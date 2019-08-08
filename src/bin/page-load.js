#!/usr/bin/env node
import program from 'commander';
import os from 'os';
import { version, description } from '../../package.json';
import loadPage from '..';

program
  .version(version, '-V, --version')
  .description(description)
  .arguments('<pageAddress>')
  .options('-o, --output [type]', '  Output directory', os.tmpdir())
  .action(pageAddress => loadPage(pageAddress, program.output));
