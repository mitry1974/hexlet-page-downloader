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
	DEBUG='page-loader' npx jest

run version:
	npx babel-node src/bin/page-load.js -V
