import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { escapeXml, readAttributes, startTags } from './xml-text.js';

/**
 * The file's own facts, as the package's two property parts carry them (task 46; `architecture.md` §12.5.6's task-46
 * row (4), (7)). Each is optional and leaves its element as it was when absent.
 */
export interface DocumentProperties {
  /**
   * The application that wrote the file — `docProps/app.xml`'s `Application`. **What makes LibreOffice recalculate on
   * open**: it trusts the cached results of a file whose application is Microsoft Excel and computes those of any
   * other, measured on 25.2.3, so a file that names its true writer shows its formulas' results in both applications.
   */
  readonly application?: string;
  /** The content's language, BCP 47 — `dc:language`. */
  readonly language?: string;
  /** When the file was last written — `dcterms:modified`, to the second, in UTC as W3CDTF writes it. */
  readonly modified?: Date;
  /** Who the file was last written for — `cp:lastModifiedBy`. */
  readonly lastModifiedBy?: string;
}

export const PROPERTY_RELATIONSHIP = {
  CORE: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  EXTENDED: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
} as const;

const NAMESPACE = {
  DC: 'http://purl.org/dc/elements/1.1/',
  DCTERMS: 'http://purl.org/dc/terms/',
  CORE: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
  XSI: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

const refuse = (message: string): never => {
  throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK, message);
};

/** The extended properties with their `Application` replaced — the rest of the part as it was. */
export function withApplication(appXml: string, application: string): string {
  const match = /<Application>[^<]*<\/Application>/.exec(appXml) ?? refuse('the extended properties name no application');
  return appXml.slice(0, match.index) + `<Application>${escapeXml(application)}</Application>` + appXml.slice(match.index + match[0].length);
}

/**
 * The core properties with a language, a modification moment and a modifier set — each replaced where the part holds
 * it, and added before the root's end where it does not. **Under the prefixes the part itself binds**: Excel writes
 * `dc:`, `dcterms:`, `cp:` and `xsi:`, and a part binding them otherwise is still written in its own spelling.
 */
export function withCoreProperties(coreXml: string, properties: Omit<DocumentProperties, 'application'>): string {
  const root = startTags(coreXml, 'cp:coreProperties')[0] ?? startTags(coreXml, 'coreProperties')[0] ?? refuse('the core properties have no root');
  const prefixOf = (namespace: string): string =>
    readAttributes(root.tag).find((attribute) => attribute.name.startsWith('xmlns:') && attribute.value === namespace)?.name.slice(6) ??
    refuse(`the core properties bind no prefix to ${namespace}`);

  let xml = coreXml;
  const set = (element: string, text: string, attributes = '') => {
    const pattern = new RegExp(`<${element}(?:\\s[^>]*)?(?:/>|>[^<]*</${element}>)`);
    const replacement = `<${element}${attributes}>${escapeXml(text)}</${element}>`;
    const match = pattern.exec(xml);
    if (match !== null) {
      xml = xml.slice(0, match.index) + replacement + xml.slice(match.index + match[0].length);
      return;
    }
    const end = xml.lastIndexOf('</');
    xml = xml.slice(0, end) + replacement + xml.slice(end);
  };

  if (properties.language !== undefined) set(`${prefixOf(NAMESPACE.DC)}:language`, properties.language);
  if (properties.lastModifiedBy !== undefined) set(`${prefixOf(NAMESPACE.CORE)}:lastModifiedBy`, properties.lastModifiedBy);
  if (properties.modified !== undefined) {
    const moment = properties.modified.toISOString().replace(/\.\d{3}Z$/, 'Z');
    set(`${prefixOf(NAMESPACE.DCTERMS)}:modified`, moment, ` ${prefixOf(NAMESPACE.XSI)}:type="${prefixOf(NAMESPACE.DCTERMS)}:W3CDTF"`);
  }
  return xml;
}
