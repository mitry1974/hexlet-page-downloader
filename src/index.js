import axios from 'axios';
import path from 'path';
import { promises as fs } from 'fs';
import cherio from 'cherio';
import url from 'url';
import log4js from 'log4js';

const logger = log4js.getLogger();
logger.level = 'debug';

const removeDotsByDashes = str => str.replace(/[\W]/g, '-');

const getPageFileName = (pageUrl) => {
  const parsedUrl = url.parse(pageUrl);
  const urlPart = parsedUrl.pathname.length > 1
    ? path.join(parsedUrl.hostname, parsedUrl.pathname)
    : parsedUrl.hostname;
  return removeDotsByDashes(urlPart);
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

const getResourceUrls = ($, resourcesDir) => $('link, script, img')
  .map((i, el) => {
    const tag = tag2url[el.name];
    const resourceUrl = $(el).attr(tag);

    if (resourceUrl && isLocalUrl(resourceUrl)) {
      const resourcePath = `./${path.join('./', resourcesDir, getResourceFileName(resourceUrl))}`;
      logger.info(`Resource url: ${resourceUrl} ->, resource local path: ${resourcePath}`);
      $(el).attr(tag, resourcePath);
      return resourceUrl;
    }
    return '';
  })
  .get()
  .filter(el => el !== '');

export default (destinationDirectory, pageAddress) => {
  logger.info(`loading page: ${pageAddress} to directory: ${destinationDirectory}`);
  const fileName = path.join(destinationDirectory, `${getPageFileName(pageAddress)}.html`);
  logger.info(`Page file name: ${fileName}`);
  const parsedUrl = url.parse(pageAddress);
  return axios.get(pageAddress)
    .then((htmlResp) => {
      const $ = cherio.load(htmlResp.data);
      const resourcersRelativePath = `${getPageFileName(pageAddress)}_files`;
      const resourcesAbsolutPath = path.join(destinationDirectory, resourcersRelativePath);
      logger.info(`Resourses absolute path: ${resourcesAbsolutPath}, resourses relative path: ${resourcersRelativePath}`);
      const urls = getResourceUrls($, resourcersRelativePath);
      return fs.mkdir(resourcesAbsolutPath)
        .then(() => fs.writeFile(fileName, $.html(), 'utf-8'))
        .then(() => Promise.all(urls.map((el) => {
          const resourceUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${el}`;
          return axios.get(resourceUrl, { responseType: 'arraybuffer' })
            .then((resourceResp) => {
              const resourceFileName = path.join(
                resourcesAbsolutPath, getResourceFileName(el),
              );
              return fs.writeFile(resourceFileName, resourceResp.data);
            });
        })))
        .catch((err) => {
          logger.error(`catched error: ${err}`);
          throw err;
        });
    });
};
