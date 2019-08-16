import axios from 'axios';
import path from 'path';
import { promises as fs } from 'fs';
import cherio from 'cherio';
import validUrl from 'valid-url';
import url from 'url';

const getPageFileName = (pageUrl) => {
  const parsedUrl = url.parse(pageUrl);
  return `${parsedUrl.hostname}${parsedUrl.pathname}`.replace(/[^a-zA-Z0-9]/g, '-');
};

const getResourceFileName = (resourceUrl) => {
  const parsedUrl = url.parse(resourceUrl);
  const parsedPath = path.parse(parsedUrl.pathname);
  const fileNamePart = path.join(parsedPath.dir, parsedPath.name);

  return `${fileNamePart.substring(1).replace(/[^a-zA-Z0-9]/g, '-')}${parsedPath.ext}`;
};

const tag2url = {
  script: 'src',
  link: 'href',
  img: 'src',
};

const getResourceUrls = ($, resourcesDir) => $('link, script, img')
  .map((i, el) => {
    const tag = tag2url[el.name];
    const resourceUrl = $(el).attr(tag);
    if (resourceUrl && validUrl.isUri(resourceUrl)) {
      const resourcePath = `./${path.join('./', resourcesDir, getResourceFileName(resourceUrl))}`;
      $(el).attr(tag, resourcePath);
      return resourceUrl;
    }
    return '';
  })
  .get()
  .filter(el => el !== '');

export default (destinationDirectory, pageAddress) => {
  const fileName = path.join(destinationDirectory, `${getPageFileName(pageAddress)}.html`);
  return axios.get(pageAddress)
    .then((htmlResp) => {
      const $ = cherio.load(htmlResp.data);
      const resourcersRelativePath = `${getPageFileName(pageAddress)}_files`;
      const resourcesAbsolutPath = path.join(destinationDirectory, resourcersRelativePath);
      const urls = getResourceUrls($, resourcersRelativePath);
      return fs.mkdir(resourcesAbsolutPath)
        .then(() => fs.writeFile(fileName, $.html()))
        .then(() => Promise.all(urls.map(el => axios.get(el, { responseType: 'arraybuffer' })
          .then((resourceResp) => {
            const resourceFileName = path.join(
              resourcesAbsolutPath, getResourceFileName(el),
            );
            return fs.writeFile(resourceFileName, resourceResp.data);
          }))));
    })
    .catch((err) => {
      console.log(err);
      throw err;
    });
};
