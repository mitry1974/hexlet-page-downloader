import nock from 'nock';
import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import loadPage from '../src';

const fixturesPath = './__fixtures__/';

const pathResolveFixtures = fileName => path.resolve(__dirname, `${fixturesPath}${fileName}`);

test('loading page', async () => {
  const testUrl = 'https://hexlet.io';
  const fixtureFileName = 'hexlet-io-courses.html';
  const expectedFileName = pathResolveFixtures(fixtureFileName);
  nock(testUrl)
    .get('/courses')
    .replyWithFile(200, expectedFileName, {
      'Content-Type': 'application/html',
    });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader'));
  await loadPage(tempDir, `${testUrl}/courses`);
  const actual = await fs.readFile(`${tempDir}/${fixtureFileName}`);
  const expected = await fs.readFile(expectedFileName);
  expect(actual).toStrictEqual(expected);
});
