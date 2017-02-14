import fs from 'fs';
import test from 'ava';
import liveServer from 'live-server';
import execa from 'execa';
import pify from 'pify';
import pathExists from 'path-exists';

const readFile = pify(fs.readFile);
const crawl = '../index.js';

function getFiles (...paths) {
    return Promise
        .all(paths.map(path => readFile(path)))
        .then(files =>
            files.map(f => JSON.parse(f.toString()))
        );
}

test.before(() => {
    process.chdir('test');
    const params = {
        port: 8080, // Set the server port. Defaults to 8080.
        host: '0.0.0.0', // Set the address to bind to. Defaults to 0.0.0.0 or process.env.IP.
        root: './fixtures/site', // Set root directory that's being served. Defaults to cwd.
        open: false, // When false, it won't load your browser by default.
        logLevel: 0, // 0 = errors only, 1 = some, 2 = lots
    };
    liveServer.start(params);
    if (!pathExists.sync('./fixtures/not-writeable')) {
        fs.writeFileSync('./fixtures/not-writeable', 'This is not writeable');
        fs.chmodSync('./fixtures/not-writeable', 0);
    }
});


test('Show help on no input', async (t) => {
    const { stdout } = await execa(crawl);
    t.truthy(stdout.includes(`$ backstop-crawl <url>`));
});


test('Failed on invalid URL', async (t) => {
    const { stderr } = await execa(crawl, ['not a url'], { reject: false });
    t.truthy(stderr.replace(/\\|\n/, '') === `> Error: "not a url" isn't a valid URL`);
});


test('Default usage', async (t) => {
    await execa(crawl, ['http://0.0.0.0:8080']);
    const [file, expected] = await getFiles(
        './backstop.json',
        './fixtures/default-test.json',
    );
    return t.deepEqual(file, expected);
});


test('Allow crawling subdomains', async (t) => {
    await execa(crawl, ['https://badssl.com/', '--allow-subdomains', '--outfile=allow-subdomains.json']);
    const [file, expected] = await getFiles(
        './allow-subdomains.json',
        './fixtures/allow-subdomains.json',
    );
    return t.deepEqual(file, expected);
});


test('Ignore SSL errors', async (t) => {
    await execa(crawl, ['https://badssl.com/', '--ignore-ssl-errors', '--allow-subdomains', '--outfile=ignore-ssl-errors.json']);
    const [file, expected] = await getFiles(
        './ignore-ssl-errors.json',
        './fixtures/ignore-ssl-errors.json',
    );
    return t.deepEqual(file, expected);
});


test('Ignored robots.txt', async (t) => {
    await execa(crawl, ['http://0.0.0.0:8080', '--ignore-robots', '--outfile=ignore-robots.json']);
    const [file, expected] = await getFiles(
        './ignore-robots.json',
        './fixtures/ignore-robots.json',
    );
    return t.deepEqual(file, expected);
});


test('Custom outfile', async (t) => {
    await execa(crawl, ['http://0.0.0.0:8080', '--outfile=custom/out/file.json']);
    const [file, expected] = await getFiles(
        './custom/out/file.json',
        './fixtures/default-test.json',
    );
    return t.deepEqual(file, expected);
});


test('mkpath errors nicely', async (t) => {
    const { stderr } = await execa(crawl, ['http://0.0.0.0:8080', '--outfile=fixtures/file-exists/backstop.json']);
    t.truthy(stderr.includes('fixtures/file-exists exists and is not a directory'));
});


test('jsonfile errors nicely', async (t) => {
    const { stderr } = await execa(crawl, ['http://0.0.0.0:8080', '--outfile=fixtures/not-writeable']);
    t.truthy(stderr.includes(`✖ Error: EACCES: permission denied, open 'fixtures/not-writeable'`));
});


test('Debug flag produces crawl errors', async (t) => {
    const { stderr } = await execa(crawl, ['https://expired.badssl.com/', '--debug', '--outfile=fixtures/debug.json']);
    t.truthy(stderr.includes(`✖ Error: certificate has expired`));
});


test('Can limit similar urls (defaults to 3)', async (t) => {
    await execa(crawl, ['http://0.0.0.0:8080', '--limit-similar', '--outfile=limit-similar-default.json']);
    const [file, expected] = await getFiles(
        './limit-similar-default.json',
        './fixtures/limit-similar-default.json',
    );
    t.deepEqual(file, expected);
});


test('Can limit similar urls lower than default (2)', async (t) => {
    await execa(crawl, ['http://0.0.0.0:8080', '--limit-similar=2', '--outfile=limit-similar-2.json']);
    const [file, expected] = await getFiles(
        './limit-similar-2.json',
        './fixtures/limit-similar-2.json',
    );
    t.deepEqual(file, expected);
});


test('Can limit similar urls lower than default (4)', async (t) => {
    await execa(crawl, ['http://0.0.0.0:8080', '--limit-similar=4', '--outfile=limit-similar-4.json']);
    const [file, expected] = await getFiles(
        './limit-similar-4.json',
        './fixtures/limit-similar-4.json',
    );
    t.deepEqual(file, expected);
});