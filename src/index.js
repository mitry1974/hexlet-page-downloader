import axios from 'axios';
import path from 'path';
import { promises as fs } from 'fs';
import cherio from 'cherio';
import url from 'url';
import debug from 'debug';
import Listr from 'listr';

const log = debug('page-loader');

const removeDotsByDashes = str => str.replace(/[\W]/g, '-');

const getPageFileName = (pageUrl) => {
  const parsedUrl = url.parse(pageUrl);
  return removeDotsByDashes(path.join(parsedUrl.hostname, parsedUrl.pathname));
};

const getResourceFileName = (resourceUrl) => {
  const parsedUrl = url.parse(resourceUrl);
  const parsedPath = path.parse(parsedUrl.pathname);
  const fileNamePart = path.join(parsedPath.dir, parsedPath.name);

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

const getResourceUrlsAndModifyHtml = ($, resourcesDir) => $('link, script, img')
  .map((i, el) => {
    const tag = tag2url[el.name];
    const resourceUrl = $(el).attr(tag);

    if (resourceUrl && isLocalUrl(resourceUrl)) {
      const resourcePath = `./${path.join(resourcesDir, getResourceFileName(resourceUrl))}`;
      log(`Resource url: ${resourceUrl} ->, resource local path: ${resourcePath}`);
      $(el).attr(tag, resourcePath);
      return resourceUrl;
    }
    return '';
  })
  .get()
  .filter(el => el !== '');

const errorDescriptions = {
  404: errorPath => `Can't connect to server: ${errorPath}`,
  ENOENT: errorPath => `Can't find file or directory: ${errorPath}`,
};

const getErrorMessage = (errorCode, objPath) => errorDescriptions[errorCode](objPath);

const getErrorInfo = (error) => {
  if (error.response) {
    return [error.response.status, error.response.config.url];
  }
  return [error.code, error.path];
};

const proceedError = (error) => {
  const [errorCode, errorPath] = getErrorInfo(error);
  const errorMessage = getErrorMessage(errorCode, errorPath);
  log(`proceedError, error: ${errorMessage}`);
  return new Error(errorMessage);
};

const getAndSaveResources = (
  resourceUrls, parsedServerUrl, directortypath,
) => resourceUrls.map((el) => {
  const resourceUrl = `${parsedServerUrl.protocol}//${parsedServerUrl.hostname}${el}`;
  return {
    title: `Downloading resource ${resourceUrl}`,
    task: () => {
      log(`Dowloadind resource ${resourceUrl}`);
      return axios.get(resourceUrl, { responseType: 'arraybuffer' })
        .then((resourceResp) => {
          const resourceFileName = path.join(
            directortypath, getResourceFileName(el),
          );
          log(`Resouce downloaded, write to file ${resourceFileName}`);
          return fs.writeFile(resourceFileName, resourceResp.data);
        });
    },
  };
});

export default (destinationDirectory, pageAddress) => {
  log(`\n\nloading page: ${pageAddress} to directory: ${destinationDirectory}`);
  const fileName = path.join(destinationDirectory, `${getPageFileName(pageAddress)}.html`);
  log(`Page file name: ${fileName}`);
  const parsedUrl = url.parse(pageAddress);
  const resourcersRelativePath = `${getPageFileName(pageAddress)}_files`;
  const resourcesAbsolutPath = path.join(destinationDirectory, resourcersRelativePath);
  log(`Resourses absolute path: ${resourcesAbsolutPath}, resourses relative path: ${resourcersRelativePath}`);
  let urls = [];
  return fs.mkdir(resourcesAbsolutPath)
    .then(() => axios.get(pageAddress))
    .then((response) => {
      const $ = cherio.load(response.data);
      urls = getResourceUrlsAndModifyHtml($, resourcersRelativePath);
      return $.html();
    })
    .then(html => fs.writeFile(fileName, html, 'utf-8'))
    .then(() => {
      const resourceTasks = getAndSaveResources(urls, parsedUrl, resourcesAbsolutPath);
      const tasks = new Listr(resourceTasks, { concurrent: true });
      return tasks.run();
    })
    .catch((error) => {
      throw proceedError(error);
    });
};
