"""
Parses confession PDFs into JS data files.
Uses simple text extraction + targeted paragraph parsing.
"""
import pdfplumber, re, os

os.makedirs('src/data', exist_ok=True)

BOOK_PAT = (r'(?:[12]\s?)?(?:Gen|Ex[oa]?|Lev|Num|Deu?t?|Jos|Jdg|Jug|Rut|[12]?Sam|[12]?Ki?ng?s?|'
            r'[12]?Chr|Ezr|Neh|Est|Job|Ps[as]?|Pro?v?|Ecc?l?|Son?g?|Isa?|Jer?|Lam|Eze?k?|Dan|Hos|'
            r'Joe?l?|Amo?s?|Oba?d?|Jon?a?h?|Mic?|Nah?|Hab?|Zep?h?|Hag?|Zec?h?|Mal|'
            r'Mat?t?|Mar?k?|Luk?e?|Joh?n?|Act?s?|Rom?|[12]?Co?r?|Gal?|Eph?|Phi?l?|Col?|'
            r'[12]?The?s?s?|[12]?Ti?m?|Tit?|Phm?|Heb?|Jam?e?s?|[12]?Pe?t?|[12]?Jo?h?n?|'
            r'Jud?e?|Re?v?)')

def fix(t):
    if not t: return ''
    return (t.replace('\u2019',"'").replace('\u2018',"'")
             .replace('\u201c','"').replace('\u201d','"')
             .replace('\u2013','-').replace('\u2014','-')
             .replace('\uf066','ff').replace('\uf069','fi')
             .replace('\uf06c','fl').replace('\ufffd',"'"))

def get_full_text(path):
    """Extract text from all pages using simple extraction (better for flowing text)."""
    parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(fix(t))
    return '\n'.join(parts)

def is_scripture_ref_line(line):
    """A scripture reference block line."""
    return bool(
        re.search(BOOK_PAT + r'\s+\d+[:.]?\d*', line) and
        re.search(r'[;,]', line) and
        len(line) < 300
    )

def clean_para_text(text):
    """Clean paragraph text: remove superscript marker letters."""
    # Remove markers before uppercase words: cTherefore -> Therefore
    text = re.sub(r'(?<!\w)[a-z]([A-Z]\w)', r'\1', text)
    # Remove footnote ref blocks in parentheses: (a 2Ti 3:15; b Rom 1:19)
    text = re.sub(r'\([a-z ][^)]*' + BOOK_PAT + r'[^)]*\)', '', text)
    # Fix hyphenated line breaks
    text = re.sub(r'-\n', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_refs_from_text(text):
    """Pull out scripture reference blocks from paragraph text."""
    refs = []
    for m in re.finditer(r'\(([a-z0-9 ][^)]*' + BOOK_PAT + r'[^)]*)\)', text):
        ref = m.group(1)
        # Clean letter markers
        ref = re.sub(r'(?<![A-Za-z0-9])[a-z]\s+', ' ', ref)
        ref = re.sub(r'^[a-z]\s+', '', ref)
        ref = re.sub(r'\s+', ' ', ref).strip()
        if ref:
            refs.append(ref)
    return '; '.join(refs)

# ══════════════════════════════════════════════════════════════════════
# 1689 CONFESSION
# ══════════════════════════════════════════════════════════════════════
print("Extracting 1689 PDF...")
text_1689 = get_full_text(r'C:\Users\Jeff Chavez\Downloads\The London Baptist Confession of Faith of 1689 with Preface, Baptist Catechism, and Appendix on Baptism.pdf')

# Locate sections
conf_start = text_1689.find('Chapter 1\nOf the Holy Scriptures')
if conf_start == -1:
    conf_start = max(0, text_1689.find('Of the Holy Scriptures') - 20)
cat_start  = text_1689.find('1. Q. Who is the first')
app_start  = text_1689.find('APPENDIX', cat_start) if cat_start > 0 else len(text_1689)

conf_text = text_1689[conf_start : cat_start if cat_start > 0 else len(text_1689)]
cat_text  = text_1689[cat_start  : app_start]

print(f"  Confession: {len(conf_text)} chars | Catechism: {len(cat_text)} chars")

def parse_1689(text):
    """Parse 1689 chapters and paragraphs."""
    result = {}
    # Split by chapter
    ch_re = re.compile(r'Chapter\s+(\d+)\s*\n([^\n]+)', re.MULTILINE)
    ch_matches = list(ch_re.finditer(text))

    for idx, m in enumerate(ch_matches):
        ch = int(m.group(1))
        title = m.group(2).strip()
        start = m.end()
        end = ch_matches[idx+1].start() if idx+1 < len(ch_matches) else len(text)
        chunk = text[start:end]

        # Parse paragraphs: look for digit at start of line
        # Para pattern: line starting with \n<digit(s)>\s or ^<digit(s)>\s
        para_re = re.compile(r'(?:^|\n)(\d{1,2})\s+(.+?)(?=\n\d{1,2}\s|\Z)', re.DOTALL)
        paras = {}

        # Also check for paragraphs starting with just a digit on its own line
        # followed by text on the next line
        lines = chunk.split('\n')
        cur_p = None
        cur_lines = []

        def save_p():
            if cur_p is None: return
            raw = ' '.join(cur_lines)
            refs = extract_refs_from_text(raw)
            body = clean_para_text(raw)
            # Remove page number artifacts
            body = re.sub(r'\b\d+\s+THE LONDON CONFESSION\b', '', body)
            body = re.sub(r'\bConfession of Faith of 1689\s+\d+\b', '', body)
            body = re.sub(r'\s+', ' ', body).strip()
            paras[cur_p] = {'text': body, 'refs': refs}

        for line in lines:
            ls = line.strip()
            # Skip page headers
            if re.match(r'^\d+\s+THE LONDON CONFESSION', ls): continue
            if re.match(r'^Confession of Faith of 1689\s+\d+', ls): continue

            # New paragraph: line is just a number
            if re.match(r'^\d{1,2}$', ls):
                save_p()
                cur_p = int(ls)
                cur_lines = []
                continue

            # New paragraph: line starts with number + space + text
            pstart = re.match(r'^(\d{1,2})\s+(.+)$', ls)
            if pstart and int(pstart.group(1)) >= 1 and int(pstart.group(1)) <= 20:
                # Check it's not a scripture ref
                if not is_scripture_ref_line(ls):
                    save_p()
                    cur_p = int(pstart.group(1))
                    cur_lines = [pstart.group(2)]
                    continue

            if cur_p is not None:
                cur_lines.append(ls)

        save_p()
        # If no paragraphs found, treat entire chunk as paragraph 1
        if not paras and chunk.strip():
            raw = ' '.join(chunk.split())
            refs = extract_refs_from_text(raw)
            body = clean_para_text(raw)
            body = re.sub(r'\s+', ' ', body).strip()
            if body:
                paras[1] = {'text': body, 'refs': refs}
        result[ch] = {'title': title, 'paragraphs': paras}

    return result

chapters = parse_1689(conf_text)
total_p = sum(len(c['paragraphs']) for c in chapters.values())
print(f"  Parsed {len(chapters)} chapters, {total_p} paragraphs")

# ── Catechism ────────────────────────────────────────────────────────
def parse_catechism(text):
    result = {}
    pattern = re.compile(r'(\d+)\.\s+Q\.\s+(.+?)\nA\.\s+(.+?)(?=\n\d+\.\s+Q\.|\Z)', re.DOTALL)
    for m in pattern.finditer(text):
        num = int(m.group(1))
        q = ' '.join(m.group(2).split())
        a_raw = ' '.join(m.group(3).split())
        refs_m = re.search(r'\((' + BOOK_PAT + r'[^)]+)\)\.?\s*(?:\d+\s*)?$', a_raw)
        refs = refs_m.group(1).strip() if refs_m else ''
        a = a_raw[:refs_m.start()].strip() if refs_m else a_raw
        a = re.sub(r'\s+\d+\s*$', '', a).strip()
        result[num] = {'q': q, 'a': a, 'refs': refs}
    return result

catechism = parse_catechism(cat_text)
print(f"  Parsed {len(catechism)} catechism Q&As")

# ══════════════════════════════════════════════════════════════════════
# 1LBCF (1644)
# ══════════════════════════════════════════════════════════════════════
print("Extracting 1LBCF PDF...")
text_1lbcf = get_full_text(r'C:\Users\Jeff Chavez\Downloads\1LCF-EN-CompEd-Text-plus-Scripture-US-Letter.pdf')

def parse_1lbcf(text):
    result = {}
    art_re = re.compile(r'(?:^|\n)(\d+)\.\s+([A-Z][^\n]+)\n', re.MULTILINE)
    matches = list(art_re.finditer(text))
    for i, m in enumerate(matches):
        num = int(m.group(1))
        if num > 52: break
        title = m.group(2).strip()
        start = m.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        chunk = text[start:end]

        ref_map = {}
        for rm in re.finditer(r'\[([a-z])\]\s*([^\[]+)', chunk):
            ref_map[rm.group(1)] = [v.strip() for v in rm.group(2).split('|') if v.strip()]

        body = re.sub(r'\[[a-z]\][^\n]*\n?', '', chunk)
        body = re.sub(r'^\d+\s*$', '', body, flags=re.MULTILINE)
        body = re.sub(r'(?<!\w)[a-z]([A-Z]\w)', r'\1', body)
        body = re.sub(r'(?<=[.,;])\s*[a-z](?=\s)', '', body)
        body = re.sub(r'-\n', '', body)
        body = re.sub(r'\n{3,}', '\n\n', body)
        body = re.sub(r'First London Confession[^\n]*\n?', '', body)
        body = re.sub(r'www\.london1644[^\n]*\n?', '', body)
        body = body.strip()

        all_refs, seen = [], set()
        for let in sorted(ref_map):
            for v in ref_map[let]:
                if v and v not in seen: all_refs.append(v); seen.add(v)

        result[num] = {'title': title, 'text': body, 'refs': '; '.join(all_refs)}
    return result

lbcf1 = parse_1lbcf(text_1lbcf)
print(f"  Parsed {len(lbcf1)} articles")

# ══════════════════════════════════════════════════════════════════════
# WRITE JS FILES
# ══════════════════════════════════════════════════════════════════════
def esc(s):
    s = s or ''
    return s.replace('\\','\\\\').replace("'","\\'").replace('\n','\\n').replace('\r','')

with open('src/data/lbcf2.js', 'w', encoding='utf-8') as f:
    f.write('// Second London Baptist Confession (1689)\nexport const LBCF2 = {\n')
    for ch in sorted(chapters):
        c = chapters[ch]
        f.write(f"  // Ch.{ch}: {c['title']}\n")
        for p in sorted(c['paragraphs']):
            para = c['paragraphs'][p]
            t = esc(para['text'])
            r = esc(para['refs'])
            f.write(f"  '{ch}.{p}': {{ text: '{t}', refs: '{r}' }},\n")
    f.write('}\n')

with open('src/data/catechism.js', 'w', encoding='utf-8') as f:
    f.write("// The Baptist Catechism (Keach's, 1693)\nexport const CATECHISM = {\n")
    for n in sorted(catechism):
        qa = catechism[n]
        q = esc(qa['q']); a = esc(qa['a']); r = esc(qa['refs'])
        f.write(f"  {n}: {{ q: '{q}', a: '{a}', refs: '{r}' }},\n")
    f.write('}\n')

with open('src/data/lbcf1.js', 'w', encoding='utf-8') as f:
    f.write('// First London Baptist Confession (1644)\nexport const LBCF1 = {\n')
    for n in sorted(lbcf1):
        a = lbcf1[n]
        ti = esc(a['title']); tx = esc(a['text']); r = esc(a['refs'])
        f.write(f"  {n}: {{ title: '{ti}', text: '{tx}', refs: '{r}' }},\n")
    f.write('}\n')

print(f"\nResults:")
print(f"  lbcf2.js     : {sum(len(c['paragraphs']) for c in chapters.values())} paragraphs / {len(chapters)} chapters")
print(f"  catechism.js : {len(catechism)} Q&As")
print(f"  lbcf1.js     : {len(lbcf1)} articles")
