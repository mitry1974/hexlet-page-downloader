import axios from 'axios';
import Path from 'path';
import { promises as fs } from 'fs';
import cherio from 'cherio';
import url from 'url';
import debug from 'debug';
import Listr from 'listr';

const log = debug('page-loader');

const removeDotsByDashes = str => str.replace(/[\W]/g, '-');

const getPageFileName = (pageUrl) => {
  const parsedUrl = url.parse(pageUrl);
  return removeDotsByDashes(Path.join(parsedUrl.hostname, parsedUrl.pathname));
};

const getResourceFileName = (resourceUrl) => {
  const parsedUrl = url.parse(resourceUrl);
  const parsedPath = Path.parse(parsedUrl.pathname);
  const fileNamePart = Path.join(parsedPath.dir, parsedPath.name);

  return `${removeDotsByDashes(fileNamePart.substring(1))}${parsedPath.ext}`;
};

const tag2url = {
  script: 'src',
  link: 'href',
  img: 'src',
};

const isLocalUrl = (u) => {
  const { hostname } = url.parse(u);
  return !hostname && u.match(/^\/\/(.*)/) === null && u.match(/^\/(.*)/) !== null;
};

const getResourceUrlsAndModifyHtml = ($, resourcesDir) => Array.from(new Set($('link, script, img')
  .map((i, el) => {
    const tag = tag2url[el.name];
    const resourceUrl = $(el).attr(tag);

    if (resourceUrl && isLocalUrl(resourceUrl)) {
      const resourcePath = `./${Path.join(resourcesDir, getResourceFileName(resourceUrl))}`;
      log(`Resource url: ${resourceUrl} ->, resource local path: ${resourcePath}`);
      $(el).attr(tag, resourcePath);
      return resourceUrl;
    }
    return '';
  })
  .get()
  .filter(el => el !== '')));

const errorDescriptions = {
  404: errorPath => `Can't connect to server: ${errorPath}`,
  ENOENT: errorPath => `Can't find file or directory: ${errorPath}`,
  ENOTFOUND: errorPath => `Page or resource not found: ${errorPath}`,
  EEXIST: errorPath => `File or directory already exists: ${errorPath}`,
};

const getErrorMessage = (errorCode, objPath) => errorDescriptions[errorCode](objPath);

const getErrorInfo = (error) => {
  if (error.isAxiosError) {
    if (error.response) {
      return [error.response.status, error.response.config.url];
    }

    return [error.code, error.hostname];
  }

  return [error.code, error.path];
};

const proceedError = (error) => {
  const [errorCode, errorPath] = getErrorInfo(error);
  log(`proceedError, errorCode: ${errorCode}, errorPath: ${errorPath}`);
  const errorMessage = getErrorMessage(errorCode, errorPath);
  log(`proceedError, error: ${errorMessage}`);
  return new Error(errorMessage);
};

const getAndSaveResources = (
  resourceUrls, parsedServerUrl, directortypath,
) => resourceUrls.map((el) => {
  const resourceUrl = `${parsedServerUrl.protocol}//${parsedServerUrl.hostname}${el}`;
  const resourceFileName = Path.join(
    directortypath, getResourceFileName(el),
  );
  const titleText = `Downloading resource ${resourceUrl} to ${resourceFileName}`;
  return {
    title: titleText,
    task: () => {
      log(titleText);
      return axios.get(resourceUrl, { responseType: 'arraybuffer' })
        .then((resourceResp) => {
          log('Resource downloaded, Writing resource to file');
          return fs.writeFile(resourceFileName, resourceResp.data);
        });
    },
  };
});

export default (destinationDirectory, pageAddress) => {
  log(`loading page: ${pageAddress} to directory: ${destinationDirectory}`);
  const fileName = Path.resolve(destinationDirectory, `${getPageFileName(pageAddress)}.html`);
  log(`Page file name: ${fileName}`);
  const parsedUrl = url.parse(pageAddress);
  const resourcersRelativePath = `${getPageFileName(pageAddress)}_files`;
  const resourcesAbsolutPath = Path.resolve(destinationDirectory, resourcersRelativePath);
  log(`Resourses absolute path: ${resourcesAbsolutPath}, resourses relative path: ${resourcersRelativePath}`);
  let urls = [];
  log(`Creating directory: ${resourcesAbsolutPath}`);
  return fs.mkdir(resourcesAbsolutPath)
    .then(() => {
      log('Directory created');
      log(`Loading page ${pageAddress}`);
      return axios.get(pageAddress);
    })
    .then((response) => {
      log('Page loaded');
      const $ = cherio.load(response.data);
      urls = getResourceUrlsAndModifyHtml($, resourcersRelativePath);
      return $.html();
    })
    .then((html) => {
      log(`Write modified html file: ${fileName}`);
      return fs.writeFile(fileName, html, 'utf-8');
    })
    .then(() => {
      log('Html file wrote.');
      const resourceTasks = getAndSaveResources(urls, parsedUrl, resourcesAbsolutPath);
      const tasks = new Listr(resourceTasks, { concurrent: true });
      return tasks.run();
    })
    .catch((error) => {
      throw proceedError(error);
    });
};
