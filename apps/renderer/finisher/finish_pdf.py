"""Makes Chromium's tagged PDF a PDF/A-2a and PDF/UA-1 file, in place (architecture.md AD-10, NFR-82, UX-120).

Chromium's tagging is real — headings, paragraphs, lists, tables with header scope and cell headers, the document's
language and its title — and this step adds only what it leaves undone, measured against veraPDF on Chromium 151
(§12.5.6's task-44 row): the output intent and the identification metadata, a body for every list item, a description
for every link, and the Artifact marking of what is drawn but is not content — the outlines of the inline marks, and
the running header and footer in the page margins.

It edits the file through pikepdf, which leaves every object it does not touch as it was. Ghostscript is never in this
path: it re-emits rather than edits, and the structure tree does not survive it (AD-10).

**It refuses rather than guesses.** Text Chromium left untagged inside the page body is a tagging defect, not
decoration, so it fails the render instead of being hidden as an artifact; so does a link count that differs from the
document's anchors. A refusal fails the attempt, and the export's retry and veraPDF's regression suite say so loudly.

Usage: finish_pdf.py --generated-at <ISO instant> --profile <sRGB .icc> --links <JSON list>  < printed.pdf > finished.pdf
"""

import argparse
import io
import json
import sys
from datetime import datetime, timezone
from xml.sax.saxutils import escape

import pikepdf
from pikepdf import Array, Dictionary, Name, Operator, String

# The document's own page margin (`document.css`, `@page { margin: 20mm }`). Untagged text whose origin lies in the
# top or bottom margin is the running header or footer; anywhere else it is a defect.
MARGIN_PT = 20 / 25.4 * 72

PATH_CONSTRUCTION = {"m", "l", "c", "v", "y", "h", "re"}
PATH_PAINTING = {"S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"}
SELF_PAINTING = {"sh", "Do", "INLINE IMAGE"}
TEXT_SHOWING = {"Tj", "TJ", "'", '"'}


class Refusal(Exception):
    """The file cannot be made to conform without guessing — the render fails, saying why."""


# The exit status of a refusal, which the renderer tells apart from the finisher failing on its own (1, Python's).
REFUSED = 2


# ── Geometry: where a text object starts, in default user space ──────────────────────────────────────────────────

def multiply(a, b):
    """The product a × b of two PDF matrices [a b c d e f], in the order PDF composes them."""
    return [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ]


IDENTITY = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]


def text_origin(ops, ctm):
    """The user-space point where a BT … ET block shows its first glyph — or None when it shows nothing."""
    line = list(IDENTITY)
    leading = 0.0
    for operands, op in ops:
        name = str(op)
        if name == "Tm":
            line = [float(x) for x in operands]
        elif name in ("Td", "TD"):
            tx, ty = float(operands[0]), float(operands[1])
            if name == "TD":
                leading = -ty
            line = multiply([1.0, 0.0, 0.0, 1.0, tx, ty], line)
        elif name == "TL":
            leading = float(operands[0])
        elif name == "T*":
            line = multiply([1.0, 0.0, 0.0, 1.0, 0.0, -leading], line)
        elif name in TEXT_SHOWING:
            origin = multiply(line, ctm)
            return origin[4], origin[5]
    return None


# ── Content: mark what is drawn but is not content ───────────────────────────────────────────────────────────────

def artifact(kind=None):
    """The opening of an Artifact sequence — a pagination one for page furniture, a plain one for decoration."""
    if kind is None:
        return ([Name.Artifact], Operator("BMC"))
    return ([Name.Artifact, Dictionary(Type=Name.Pagination, Subtype=Name("/" + kind))], Operator("BDC"))


END = ([], Operator("EMC"))


def mark_untagged(pdf, page, number):
    """Wraps whatever the page draws outside any marked-content sequence: decoration as Artifact, and text in the
    page margins as the pagination it is. Text outside any sequence in the body is refused."""
    height = float(page.MediaBox[3]) - float(page.MediaBox[1])
    ops = pikepdf.parse_content_stream(page.obj)
    out = []
    depth = 0
    ctm = list(IDENTITY)
    saved = []
    i = 0
    while i < len(ops):
        operands, op = ops[i]
        name = str(op)
        if name in ("BMC", "BDC"):
            depth += 1
        elif name == "EMC":
            depth -= 1
        elif name == "q":
            saved.append(ctm)
        elif name == "Q":
            ctm = saved.pop() if saved else list(IDENTITY)
        elif name == "cm":
            ctm = multiply([float(x) for x in operands], ctm)

        if depth == 0 and name == "BT":
            end = next(j for j in range(i, len(ops)) if str(ops[j][1]) == "ET")
            block = ops[i : end + 1]
            if any(str(o) in ("BMC", "BDC") for _, o in block):
                out.extend(block)
            else:
                origin = text_origin(block, ctm)
                if origin is None:
                    out.extend(block)
                elif origin[1] > height - MARGIN_PT:
                    out.extend([artifact("Header"), *block, END])
                elif origin[1] < MARGIN_PT:
                    out.extend([artifact("Footer"), *block, END])
                else:
                    raise Refusal(f"Page {number} shows text that Chromium did not tag, inside the page body.")
            i = end + 1
            continue

        if depth == 0 and (name in PATH_CONSTRUCTION or name in SELF_PAINTING):
            run = []
            j = i
            while j < len(ops):
                run.append(ops[j])
                current = str(ops[j][1])
                j += 1
                if current in PATH_PAINTING or current in SELF_PAINTING:
                    break
            # A path ended by `n` only clips — it paints nothing, and is not content.
            if str(run[-1][1]) == "n":
                out.extend(run)
            else:
                out.extend([artifact(), *run, END])
            i = j
            continue

        out.append(ops[i])
        i += 1
    page.obj.Contents = pdf.make_stream(pikepdf.unparse_content_stream(out))


# ── Structure: list bodies and link descriptions ─────────────────────────────────────────────────────────────────

def kids_of(element):
    kids = element.get("/K")
    if kids is None:
        return []
    return list(kids) if isinstance(kids, Array) else [kids]


def is_element(node, role=None):
    return isinstance(node, Dictionary) and "/S" in node and (role is None or node.S == Name(role))


def page_of(element):
    """The page a structure element's marked content is on, inherited from its ancestors where it states none."""
    while isinstance(element, Dictionary):
        if "/Pg" in element:
            return element.Pg
        element = element.get("/P")
    raise Refusal("A list item's content names no page.")


def parent_tree_entry(node, key):
    if "/Nums" in node:
        nums = node.Nums
        for index in range(0, len(nums), 2):
            if int(nums[index]) == key:
                return nums[index + 1]
    for kid in node.get("/Kids", []):
        limits = kid.get("/Limits")
        if limits is None or int(limits[0]) <= key <= int(limits[1]):
            found = parent_tree_entry(kid, key)
            if found is not None:
                return found
    return None


def give_list_items_bodies(pdf):
    """PDF/UA-1 7.2: an LI holds a Lbl and a LBody. Chromium gives it the label and then its content directly, so the
    content moves into a body — marked content included, whose parent-tree entry then names the body."""
    root = pdf.Root.StructTreeRoot

    def visit(element):
        if is_element(element, "/LI"):
            kids = kids_of(element)
            labels = [kid for kid in kids if is_element(kid, "/Lbl")]
            content = [kid for kid in kids if not is_element(kid, "/Lbl")]
            if content and not any(is_element(kid, "/LBody") for kid in content):
                body = pdf.make_indirect(Dictionary(Type=Name.StructElem, S=Name.LBody, P=element, K=Array(content)))
                for kid in content:
                    if is_element(kid):
                        kid.P = body
                    else:
                        page = kid.Pg if isinstance(kid, Dictionary) and "/Pg" in kid else page_of(element)
                        mcid = int(kid.MCID) if isinstance(kid, Dictionary) else int(kid)
                        parent_tree_entry(root.ParentTree, int(page.StructParents))[mcid] = body
                        body.Pg = page
                element.K = Array(labels + [body])
        for kid in kids_of(element):
            if is_element(kid):
                visit(kid)

    for kid in kids_of(root):
        visit(kid)


def describe_links(pdf, descriptions):
    """PDF/UA-1 7.18.5: every link annotation carries its description. The renderer reads each anchor's words from the
    page in document order, which is the order the structure tree holds its Link elements; a count that differs is
    refused rather than paired up wrongly."""
    links = []

    def visit(element):
        if is_element(element, "/Link"):
            annotations = []

            def gather(node):
                if isinstance(node, Dictionary) and node.get("/Type") == Name.OBJR:
                    annotations.append(node.Obj)
                elif is_element(node):
                    for kid in kids_of(node):
                        gather(kid)

            for kid in kids_of(element):
                gather(kid)
            links.append(annotations)
            return
        for kid in kids_of(element):
            if is_element(kid):
                visit(kid)

    for kid in kids_of(pdf.Root.StructTreeRoot):
        visit(kid)
    if len(links) != len(descriptions):
        raise Refusal(f"The file holds {len(links)} links and the document {len(descriptions)} anchors.")
    for annotations, words in zip(links, descriptions):
        for annotation in annotations:
            annotation.Contents = String(words)


# ── Identification: the output intent and the metadata ───────────────────────────────────────────────────────────

def pdf_date(moment):
    return moment.strftime("D:%Y%m%d%H%M%SZ")


def identify(pdf, generated_at, profile_path):
    with open(profile_path, "rb") as profile:
        icc = pdf.make_stream(profile.read(), N=3)
    pdf.Root.OutputIntents = Array(
        [
            pdf.make_indirect(
                Dictionary(
                    Type=Name.OutputIntent,
                    S=Name.GTS_PDFA1,
                    OutputConditionIdentifier=String("sRGB IEC61966-2.1"),
                    Info=String("sRGB IEC61966-2.1"),
                    DestOutputProfile=icc,
                )
            )
        ]
    )
    info = pdf.docinfo
    info.CreationDate = String(pdf_date(generated_at))
    info.ModDate = String(pdf_date(generated_at))
    title = str(info.get("/Title", ""))
    if not title:
        raise Refusal("The document has no title, which PDF/UA-1 requires.")
    language = str(pdf.Root.get("/Lang", ""))
    if not language:
        raise Refusal("The document states no language.")
    instant = generated_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    xmp = f"""<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
  xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
  xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
  xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaid:part>2</pdfaid:part><pdfaid:conformance>A</pdfaid:conformance><pdfuaid:part>1</pdfuaid:part>
<dc:format>application/pdf</dc:format>
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">{escape(title)}</rdf:li></rdf:Alt></dc:title>
<dc:language><rdf:Bag><rdf:li>{escape(language)}</rdf:li></rdf:Bag></dc:language>
<xmp:CreateDate>{instant}</xmp:CreateDate><xmp:ModifyDate>{instant}</xmp:ModifyDate><xmp:MetadataDate>{instant}</xmp:MetadataDate>
<xmp:CreatorTool>{escape(str(info.get("/Creator", "")))}</xmp:CreatorTool>
<pdf:Producer>{escape(str(info.get("/Producer", "")))}</pdf:Producer>
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>PDF/UA Universal Accessibility Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>http://www.aiim.org/pdfua/ns/id/</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>pdfuaid</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq><rdf:li rdf:parseType="Resource">
<pdfaProperty:name>part</pdfaProperty:name><pdfaProperty:valueType>Integer</pdfaProperty:valueType>
<pdfaProperty:category>internal</pdfaProperty:category>
<pdfaProperty:description>Indicates which part of ISO 14289 the file conforms to</pdfaProperty:description>
</rdf:li></rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>"""
    pdf.Root.Metadata = pdf.make_stream(xmp.encode("utf-8"), Type=Name.Metadata, Subtype=Name.XML)


def finish(raw, generated_at, profile_path, descriptions):
    pdf = pikepdf.open(io.BytesIO(raw))
    if "/StructTreeRoot" not in pdf.Root:
        raise Refusal("The file is not tagged — Chromium was asked for a tagged PDF and printed none.")
    for number, page in enumerate(pdf.pages, start=1):
        mark_untagged(pdf, page, number)
        if "/Annots" in page.obj:
            page.obj.Tabs = Name.S
    give_list_items_bodies(pdf)
    describe_links(pdf, descriptions)
    identify(pdf, generated_at, profile_path)
    out = io.BytesIO()
    pdf.save(out)
    return out.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--generated-at", required=True)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--links", required=True)
    args = parser.parse_args()
    generated_at = datetime.fromisoformat(args.generated_at.replace("Z", "+00:00")).astimezone(timezone.utc)
    try:
        finished = finish(sys.stdin.buffer.read(), generated_at, args.profile, json.loads(args.links))
    except Refusal as refusal:
        print(str(refusal), file=sys.stderr)
        sys.exit(REFUSED)
    sys.stdout.buffer.write(finished)


if __name__ == "__main__":
    main()
