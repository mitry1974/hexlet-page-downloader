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
  404: "Can't connect to server.",
  ENOENT: "Can't find file or directory.",
};

const proceedError = (error) => {
  if (error.response) {
    log(`network error: ${error.response.status}`);
    const newError = new Error(errorDescriptions[error.response.status]);
    newError.code = error.response.status;
    newError.stack = error.stack;
    newError.path = error.response.config.url;
    throw newError;
  } else {
    log(`fs error: ${error}`);
    throw error;
  }
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
  const tasks = new Listr([
    {
      title: `Loading ${pageAddress} to the ${destinationDirectory} directory`,
      task: ctx => fs.mkdir(resourcesAbsolutPath)
        .then(() => axios.get(pageAddress))
        .then((response) => {
          const $ = cherio.load(response.data);
          ctx.urls = getResourceUrlsAndModifyHtml($, resourcersRelativePath);
          ctx.html = $.html();
        })
        .then(() => fs.writeFile(fileName, ctx.html, 'utf-8')),
    },
    {
      title: 'Loading resources',
      task: (ctx) => {
        const resourceTasks = getAndSaveResources(ctx.urls, parsedUrl, resourcesAbsolutPath);
        return new Listr(resourceTasks, { concurrent: true });
      },
    },
  ]);

  return tasks.run().catch(err => proceedError(err));
};
