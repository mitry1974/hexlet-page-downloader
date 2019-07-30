# Makefile
install:
	npm install

publish:
	npm publish --dry-run

lint:
	npx eslint .

help:
	npx babel-node src/bin/gendiff.js -h

test:
	npx jest

run version:
	npx babel-node src/bin/gendiff.js -V
