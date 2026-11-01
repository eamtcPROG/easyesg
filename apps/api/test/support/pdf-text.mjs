// A PDF's words, page by page, as JSON on stdout — what a reader of the file sees, read by Mozilla's PDF.js (task 44).
// Run in a child process by `pdf-file.ts`: PDF.js ships as ES modules only, and the api's suites load CommonJS.
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const document = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])), verbosity: 0 }).promise;
const pages = [];
for (let number = 1; number <= document.numPages; number += 1) {
  const content = await (await document.getPage(number)).getTextContent();
  pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/gu, ' ').trim());
}
const { info } = await document.getMetadata();
process.stdout.write(JSON.stringify({ pages, title: info.Title ?? null }));
