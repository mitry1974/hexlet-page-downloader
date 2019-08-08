# Makefile
install:
	npm install

publish:
	npm publish --dry-run

lint:
	npx eslint .

help:
	npx babel-node src/bin/page-load.js -h

test:
	npx jest

run version:
	npx babel-node src/bin/page-load.js -V
