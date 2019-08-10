import axios from 'axios';
import path from 'path';
import { promises as fs } from 'fs';

const getFileName = url => url.substring(url.indexOf('//') + 2).replace(/[^a-zA-Z0-9]/g, '-');

export default (destinationDirectory, pageAddress) => {
  const fileName = path.join(destinationDirectory, `${getFileName(pageAddress)}.html`);
  return axios.get(pageAddress)
    .then(res => res.data)
    .then(data => fs.writeFile(fileName, data))
    .catch((err) => {
      console.log(err);
      throw err;
    });
};
