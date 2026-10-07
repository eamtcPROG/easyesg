import { crc32 } from 'node:zlib';

/**
 * An `.xlsx` built by the journey that uploads it (task 204.2; FR-211), so each test states its rows where it asserts
 * on them rather than in a binary fixture nobody can read.
 *
 * **The least a workbook can be and still be one**: the content types, the package's relationship to the workbook,
 * the workbook naming its sheets, the workbook's relationships to them, and each sheet — text as inline strings,
 * numbers as the stored text a spreadsheet writes (`1700.5`, `1.5E-3`), so the import reads a number cell exactly as it
 * reads one from Excel. No styles and no shared strings: both are optional, and the reader under test treats them so.
 * Zipped without compression, which every reader accepts.
 */
export type WorkbookCell = string | { readonly number: string } | null;

export interface WorkbookSheet {
  readonly name: string;
  readonly rows: readonly (readonly WorkbookCell[])[];
}

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const escape = (text: string) =>
  text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');

const columnName = (column: number): string =>
  column < 26
    ? String.fromCharCode(65 + column)
    : `${columnName(Math.floor(column / 26) - 1)}${String.fromCharCode(65 + (column % 26))}`;

function sheetXml(rows: readonly (readonly WorkbookCell[])[]): string {
  const body = rows
    .map((cells, row) => {
      const written = cells
        .map((cell, column) => {
          const reference = `${columnName(column)}${row + 1}`;
          if (cell === null) return '';
          if (typeof cell === 'string') {
            return `<c r="${reference}" t="inlineStr"><is><t>${escape(cell)}</t></is></c>`;
          }
          return `<c r="${reference}"><v>${cell.number}</v></c>`;
        })
        .join('');
      return `<row r="${row + 1}">${written}</row>`;
    })
    .join('');
  return `${XML_DECLARATION}<worksheet xmlns="${MAIN}"><sheetData>${body}</sheetData></worksheet>`;
}

/** A zip of stored entries: each local header and its bytes, the central directory, its end record. */
function zip(entries: readonly { readonly name: string; readonly data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const fileName = Buffer.from(name, 'utf8');
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, fileName, data);
    centrals.push(central, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export function workbookOf(sheets: readonly WorkbookSheet[]): Buffer {
  const part = (name: string, xml: string) => ({ name, data: Buffer.from(xml, 'utf8') });
  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');
  return zip([
    part(
      '[Content_Types].xml',
      `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        `${overrides}</Types>`,
    ),
    part(
      '_rels/.rels',
      `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}">` +
        `<Relationship Id="rId1" Type="${RELATIONSHIPS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    part(
      'xl/workbook.xml',
      `${XML_DECLARATION}<workbook xmlns="${MAIN}" xmlns:r="${RELATIONSHIPS}"><sheets>` +
        sheets
          .map((sheet, index) => `<sheet name="${escape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
          .join('') +
        '</sheets></workbook>',
    ),
    part(
      'xl/_rels/workbook.xml.rels',
      `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}">` +
        sheets
          .map(
            (_, index) =>
              `<Relationship Id="rId${index + 1}" Type="${RELATIONSHIPS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
          )
          .join('') +
        '</Relationships>',
    ),
    ...sheets.map((sheet, index) => part(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet.rows))),
  ]);
}
