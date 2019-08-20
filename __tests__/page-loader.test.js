import nock from 'nock';
import os from 'os';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import httpAdapter from 'axios/lib/adapters/http';
import loadPage from '../src';

axios.defaults.adapter = httpAdapter;
nock.disableNetConnect();

const fixturesPath = './__fixtures__/';
const resoursesPath = './hexlet-io-courses_files/';
const pathResolveFixtures = fileName => path.resolve(__dirname, fixturesPath, fileName);

test('test 404 error', async () => {
  nock('https://hexlet.io')
    .get('/courses')
    .reply(404);
  try {
    await loadPage('', 'https://hexlet.io/courses');
  } catch (err) {
    expect(err.message).toMatch('Request failed with status code 404');
  }
});

test('loading page', async () => {
  const originalHtmlFileName = pathResolveFixtures('original.html');
  const expectedHtmlFileName = pathResolveFixtures('hexlet-io-courses.html');
  const expectedCssFileName = pathResolveFixtures(`${resoursesPath}assets-application.css`);
  const expectedImgFileName = pathResolveFixtures(`${resoursesPath}derivations-image`);
  const expectedJsFileName = pathResolveFixtures(`${resoursesPath}packs-script.js`);

  nock('https://hexlet.io')
    .get('/courses')
    .replyWithFile(200, originalHtmlFileName, {
      'Content-Type': 'application/html',
    });

  nock('https://hexlet.io')
    .get('/assets/application.css')
    .replyWithFile(200, expectedCssFileName, {
      'Content-Type': 'text/css',
    })
    .get('/derivations/image')
    .replyWithFile(200, expectedImgFileName, {
      'Content-Type': 'image/jpeg',
    })
    .get('/packs/script.js')
    .replyWithFile(200, expectedJsFileName, {
      'Content-Type': 'application/javascript',
    });


  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader'));
  try {
    await loadPage(tempDir, 'https://hexlet.io/courses');
  } catch (err) {
    console.log(err);
    return;
  }

  const actualHtml = await fs.readFile(`${tempDir}/hexlet-io-courses.html`, 'utf-8');
  const expectedHtml = await fs.readFile(expectedHtmlFileName, 'utf-8');
  expect(actualHtml).toMatch(expectedHtml);

  const tempDirResourcesPath = path.resolve(tempDir, resoursesPath);
  console.log(`temp resources path = ${tempDirResourcesPath}`);
  const actualJs = await fs.readFile(`${tempDirResourcesPath}/packs-script.js`, 'utf-8');
  const actualImg = await fs.readFile(`${tempDirResourcesPath}/derivations-image`);
  const actualCss = await fs.readFile(`${tempDirResourcesPath}/assets-application.css`, 'utf-8');
  const expectedJs = await fs.readFile(expectedJsFileName, 'utf-8');
  const expectedImg = await fs.readFile(expectedImgFileName);
  const expectedCss = await fs.readFile(expectedCssFileName, 'utf-8');
  expect(actualCss).toEqual(expectedCss);
  expect(actualJs).toEqual(expectedJs);
  expect(actualImg).toStrictEqual(expectedImg);
});