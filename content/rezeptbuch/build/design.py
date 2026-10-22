"""Alpha5 – sportliches Layout (überschreibt die Darstellung von build_pdf / build_lexikon)."""
import os, re, glob, unicodedata, tempfile
from PIL import Image as PILImage
import build_pdf as b
from build_pdf import *  # noqa
from reportlab.platypus import Flowable
from reportlab.lib.utils import ImageReader
from functools import partial
Table = partial(Table, hAlign='LEFT')

S = os.path.dirname(os.path.abspath(__file__))
F2 = f'{S}/fonts2'
FOTO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/fotos'

# ---------- Schriften: Barlow (Text) + Barlow Condensed (Überschriften, kursiv) ----------
for name, f in [('A-Regular', 'Barlow-Regular'), ('A-SemiBold', 'Barlow-SemiBold'), ('A-Bold', 'Barlow-Bold'),
                ('A-Black', 'BarlowCondensed-ExtraBoldItalic'), ('A-Medium', 'Barlow-Medium'), ('A-Italic', 'Barlow-Italic'),
                ('C-Bold', 'BarlowCondensed-Bold'), ('C-BoldIt', 'BarlowCondensed-BoldItalic'),
                ('C-XBIt', 'BarlowCondensed-ExtraBoldItalic'), ('C-Semi', 'BarlowCondensed-SemiBold')]:
    pdfmetrics.registerFont(TTFont(name, f'{F2}/{f}.ttf'))

SCHWARZ = colors.HexColor('#0a0c10'); BLAU = colors.HexColor('#1f5bff'); GRAU = colors.HexColor('#5b6475')
LINIE = colors.HexColor('#e2e6ee'); PAPIER = colors.HexColor('#f3f5f9'); WEISS = colors.white
ACC = {'schnell': '#f5b400', 'pre': '#00b3c7', 'post': '#1f5bff', 'cardio': '#ff7a1a', 'wettkampf': '#e11d48',
       'mealprep': '#7c4dff', 'fastfood': '#ff4d2e', 'airfryer': '#d99a00', 'dessert': '#ff5fa2', 'eis': '#2cc4f5',
       'budget': '#21b36b', 'vegan': '#1f9d55', 'vegetarisch': '#86bc25', 'fleisch': '#c8102e', 'ohne-schwein': '#e07a1f',
       'unterwegs': '#6b7a99', 'lexikon': '#1f5bff', 'gratis': '#1f5bff'}
ACC = {k: colors.HexColor(v) for k, v in ACC.items()}
NAME2KEY = {n.replace('&amp;', '&'): k for k, n, _ in b.ALL}
CHAPNUM = {k: i + 1 for i, (k, _, _) in enumerate(b.ALL)}

def acc_for_group(g):
    k = NAME2KEY.get((g or '').replace('&amp;', '&'))
    return ACC.get(k, BLAU)

def esc(t): return t.replace('&', '&amp;').replace('&amp;amp;', '&amp;')

def st(name, **kw):
    base = dict(fontName='A-Regular', fontSize=10.5, leading=15, textColor=SCHWARZ)
    base.update(kw); return ParagraphStyle(name, **base)

H_TITLE = st('ht', fontName='C-XBIt', fontSize=34, leading=34)
H_DESC = st('hd', fontSize=11, leading=15.5, textColor=GRAU)
H_SEC = st('hs', fontName='C-BoldIt', fontSize=16, leading=18, textColor=SCHWARZ)
P_TXT = st('pt', fontSize=10.5, leading=15)
P_SMALL = st('ps', fontSize=8.5, leading=11.5, textColor=GRAU)
b.H_TITLE = H_TITLE; b.H_DESC = H_DESC; b.H_SEC = H_SEC; b.P_SMALL = P_SMALL
b.P_ING = st('pi', fontSize=10.5, leading=14); b.P_TIP = st('ptp', fontSize=10.5, leading=15)

# ---------- Formen ----------
def para(c, x, y, w, h, skew, fill=None, stroke=None, lw=0.8):
    p = c.beginPath(); p.moveTo(x + skew, y + h); p.lineTo(x + w + skew, y + h); p.lineTo(x + w, y); p.lineTo(x, y); p.close()
    if fill is not None: c.setFillColor(fill)
    if stroke is not None: c.setStrokeColor(stroke); c.setLineWidth(lw)
    c.drawPath(p, fill=1 if fill is not None else 0, stroke=1 if stroke is not None else 0)

def tag(c, x, y, text, fill, color=WEISS, size=9.5, font='C-BoldIt', padx=3 * mm, h=6 * mm):
    w = pdfmetrics.stringWidth(text, font, size) + 2 * padx
    para(c, x, y, w, h, 1.6 * mm, fill=fill)
    c.setFillColor(color); c.setFont(font, size); c.drawString(x + padx + 0.8 * mm, y + (h - size * 0.7) / 2, text)
    return w

def slug(s):
    s = s.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss').replace('&', 'und')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

_names = {}
for k, *_ in b.ALL:
    for r in b.data.get(k, {}).get('recipes', []): _names[slug(r['name'])] = _names.get(slug(r['name']), 0) + 1
def foto_id(key, r):
    s = slug(r['name'])
    return f'{key}-{s}' if _names.get(s, 0) > 1 else s

# Fürs PDF reichen 1240 px Breite (~150 dpi auf A4); die Originale in fotos/ bleiben unverändert.
PDF_FOTO_BREITE = 1240
PDF_FOTO_CACHE = os.path.join(tempfile.gettempdir(), 'alpha5-pdf-fotos')

def pdf_foto(p):
    os.makedirs(PDF_FOTO_CACHE, exist_ok=True)
    dst = os.path.join(PDF_FOTO_CACHE, f'{os.path.splitext(os.path.basename(p))[0]}-{int(os.path.getmtime(p))}.jpg')
    if not os.path.exists(dst):
        img = PILImage.open(p).convert('RGB')
        if img.width > PDF_FOTO_BREITE:
            img = img.resize((PDF_FOTO_BREITE, round(img.height * PDF_FOTO_BREITE / img.width)), PILImage.LANCZOS)
        img.save(dst, 'JPEG', quality=80, optimize=True, progressive=True)
    return dst

def find_foto(fid):
    for ext in ('jpg', 'jpeg', 'png', 'webp'):
        p = f'{FOTO_DIR}/{fid}.{ext}'
        if os.path.exists(p): return pdf_foto(p)
    return None

# ---------- Flowables ----------
FRAME_TOP_GAP = 26 * mm   # Abstand Rahmen-Oberkante bis Seitenrand (Vorlage 'recipe')

class Hero(Flowable):
    """Foto-Fläche über die volle Breite mit schräger Unterkante."""
    def __init__(self, key, r, chapter, h=60 * mm):
        super().__init__(); self.key, self.r, self.chapter, self.h = key, r, chapter, h
        self.fid = foto_id(key, r)
    def wrap(self, aw, ah): return (aw, self.h)
    def draw(self):
        c = self.canv; acc = ACC.get(self.key, BLAU)
        x0, top, sl = -M, self.h + FRAME_TOP_GAP, 13 * mm
        c.saveState()
        p = c.beginPath(); p.moveTo(x0, 0); p.lineTo(x0 + W, sl); p.lineTo(x0 + W, top); p.lineTo(x0, top); p.close()
        c.clipPath(p, stroke=0, fill=0)
        foto = find_foto(self.fid)
        if foto:
            img = ImageReader(foto); iw, ih = img.getSize(); bw, bh = W, top
            sc = max(bw / iw, bh / ih); dw, dh = iw * sc, ih * sc
            c.drawImage(img, x0 + (bw - dw) / 2, (bh - dh) / 2, dw, dh)
        else:
            c.setFillColor(PAPIER); c.rect(x0, 0, W, top, fill=1, stroke=0)
            c.setStrokeColor(colors.HexColor('#e6eaf1')); c.setLineWidth(0.6)
            for i in range(-40, 80):
                xx = x0 + i * 7 * mm; c.line(xx, 0, xx + top * 0.35, top)
            cx, cy = x0 + W / 2, top * 0.5
            lw = 22 * mm; lh = lw * b.LH / b.LW
            c.setFillAlpha(0.18); c.drawImage(b.LOGO, cx - lw / 2, cy, lw, lh, mask='auto'); c.setFillAlpha(1)
            c.setFillColor(GRAU); c.setFont('A-Medium', 9); c.drawCentredString(cx, cy - 6 * mm, 'Platz für euer Foto')
            c.setFont('A-Regular', 8); c.drawCentredString(cx, cy - 10.5 * mm, f'fotos/{self.fid}.jpg')
        c.restoreState()
        p = c.beginPath(); p.moveTo(x0, 0); p.lineTo(x0 + W, sl); p.lineTo(x0 + W, sl - 3.2 * mm); p.lineTo(x0, -3.2 * mm); p.close()
        c.setFillColor(acc); c.drawPath(p, fill=1, stroke=0)
        y = top - 21 * mm
        w = tag(c, 0, y, self.chapter.replace('&amp;', '&'), SCHWARZ)
        tag(c, w + 1.5 * mm, y, self.r['mahlzeit'].replace('&amp;', '&'), acc, color=WEISS if self.key not in ('schnell', 'airfryer', 'vegetarisch') else SCHWARZ)

class ChapterHero(Flowable):
    """Kapitel-Öffner: schwarzer Block mit schräger Kante, Akzentstreifen, großer kursiver Titel."""
    def __init__(self, key, title, h=58 * mm, kicker=None, bg=None):
        super().__init__(); self.key, self.title, self.h, self.kicker, self.bg = key, title.replace('&amp;', '&'), h, kicker, bg
    def wrap(self, aw, ah): return (aw, self.h)
    def draw(self):
        c = self.canv; acc = ACC.get(self.key, BLAU)
        x0, top, sl = -M, self.h + FRAME_TOP_GAP, 22 * mm
        p = c.beginPath(); p.moveTo(x0, sl); p.lineTo(x0 + W, 0); p.lineTo(x0 + W, top); p.lineTo(x0, top); p.close()
        c.setFillColor(SCHWARZ); c.drawPath(p, fill=1, stroke=0)
        p = c.beginPath(); p.moveTo(x0, sl); p.lineTo(x0 + W, 0); p.lineTo(x0 + W, -4.5 * mm); p.lineTo(x0, sl - 4.5 * mm); p.close()
        c.setFillColor(acc); c.drawPath(p, fill=1, stroke=0)
        # großes Kapitel-Zeichen im Hintergrund
        c.saveState(); c.setFillColor(colors.HexColor('#1a1f2a')); c.setFont('C-XBIt', 170)
        c.drawRightString(W - M - 2 * mm, sl + 6 * mm, self.bg if self.bg is not None else (f'{CHAPNUM.get(self.key, "")}' if self.key in CHAPNUM else ''))
        c.restoreState()
        lw = 13 * mm; b.draw_logo(c, 0, top - 17 * mm, 6 * mm)
        kick = self.kicker or (f'Kapitel {CHAPNUM[self.key]}' if self.key in CHAPNUM else '')
        if kick:
            c.setFillColor(acc); c.setFont('C-BoldIt', 15); c.drawString(0, sl + 30 * mm, kick)
        size = 56
        while pdfmetrics.stringWidth(self.title, 'C-XBIt', size) > W - 2 * M - 4 * mm and size > 30: size -= 2
        c.setFillColor(WEISS); c.setFont('C-XBIt', size); c.drawString(0, sl + 12 * mm, self.title)

class Score(Flowable):
    """Nährwert-Anzeige wie eine Anzeigetafel: große kursive Zahlen, schräge Trenner."""
    def __init__(self, items, accent=BLAU, highlight=1, h=17 * mm):
        super().__init__(); self.items, self.acc, self.hl, self.h = items, accent, highlight, h
    def wrap(self, aw, ah): self.aw = aw; return (aw, self.h)
    def draw(self):
        c = self.canv; n = len(self.items); cw = self.aw / n
        for i, (val, unit, label) in enumerate(self.items):
            x = i * cw + (0 if i == 0 else 4 * mm)
            if i:
                c.setStrokeColor(LINIE); c.setLineWidth(1); c.line(i * cw - 1 * mm, 2 * mm, i * cw + 2.5 * mm, self.h - 1 * mm)
            c.setFillColor(BLAU if i == self.hl else SCHWARZ); c.setFont('C-XBIt', 25); c.drawString(x, 6.5 * mm, str(val))
            vw = pdfmetrics.stringWidth(str(val), 'C-XBIt', 25)
            c.setFont('C-Semi', 10); c.setFillColor(GRAU); c.drawString(x + vw + 1.2 * mm, 6.5 * mm, unit)
            c.setFont('A-Medium', 8.3); c.drawString(x, 1.2 * mm, label)

class Chips(Flowable):
    def __init__(self, items, h=6 * mm):
        super().__init__(); self.items, self.h = items, h   # (text, fill, color, outline)
    def wrap(self, aw, ah): return (aw, self.h)
    def draw(self):
        c = self.canv; x = 0
        for text, fill, color, outline in self.items:
            if outline:
                w = pdfmetrics.stringWidth(text, 'C-Semi', 10) + 6 * mm
                para(c, x, 0, w, self.h, 1.6 * mm, stroke=outline, lw=0.9)
                c.setFillColor(color); c.setFont('C-Semi', 10); c.drawString(x + 3.6 * mm, 1.9 * mm, text)
            else:
                w = tag(c, x, 0, text, fill, color=color, size=10)
            x += w + 2 * mm

class Mark(Flowable):
    """Kleiner schräger Balken als Aufzählungszeichen."""
    def __init__(self, color=BLAU, w=2.6 * mm, h=2.6 * mm, dy=1.2 * mm):
        super().__init__(); self.color, self.w, self.h, self.dy = color, w, h, dy
    def wrap(self, aw, ah): return (self.w + 1.2 * mm, self.h + self.dy)
    def draw(self): para(self.canv, 0, self.dy, self.w * 0.6, self.h, self.w * 0.4, fill=self.color)

class SkewBar(Flowable):
    def __init__(self, color, h): super().__init__(); self.color, self.hh = color, h
    def wrap(self, aw, ah): return (3.2 * mm, self.hh)
    def draw(self): para(self.canv, 0, 0, 1.6 * mm, self.hh, 1.4 * mm, fill=self.color)

def blist(items, color=BLAU, size=10.5, width=None):
    rows = [[Mark(color, dy=size * 0.16), Paragraph(x, st('bl', fontSize=size, leading=size * 1.42))] for x in items]
    t = Table(rows, colWidths=[5 * mm, (width - 5 * mm) if width else None])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5)]))
    return t

def callout(label, text, color=BLAU, label_color=None, w=None):
    w = w or (W - 2 * M)
    body = Paragraph(f'<font name="C-BoldIt" size="13" color="{(label_color or color).hexval().replace("0x", "#")}">{label}</font><br/>{text}', st('co', fontSize=10.5, leading=15))
    t = Table([[SkewBar(color, 16 * mm), body]], colWidths=[6 * mm, w - 6 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]))
    return t

def box(text, w=None, bg=None, line=None, style=None):
    m = re.match(r'<font name="A-Bold" color="([^"]+)">([^<]+?):?\s*</font>\s*(.*)', text, re.S)
    if m: return callout(m.group(2).rstrip(':'), m.group(3), line or BLAU, w=w)
    return callout('', text, line or BLAU, w=w)
b.box = box

# ---------- Seitenrahmen ----------
def footer(c, doc, label='Rezeptbuch'):
    acc = acc_for_group(b.STATE.get('group'))
    c.saveState()
    lw = b.draw_logo(c, M, 7.2 * mm, 3.6 * mm)
    c.setFont('A-SemiBold', 8); c.setFillColor(SCHWARZ); c.drawString(M + lw + 2.5 * mm, 8 * mm, label)
    g = (b.STATE.get('group') or '').replace('&amp;', '&')
    if g:
        x = M + lw + 2.5 * mm + pdfmetrics.stringWidth(label, 'A-SemiBold', 8) + 3 * mm
        para(c, x, 7.6 * mm, 1.2 * mm, 3.2 * mm, 0.9 * mm, fill=acc)
        c.setFont('A-Regular', 8); c.setFillColor(GRAU); c.drawString(x + 4 * mm, 8 * mm, g)
    n = str(doc.page)
    c.setFont('C-XBIt', 15); c.setFillColor(SCHWARZ); c.drawRightString(W - M, 7.4 * mm, n)
    nw = pdfmetrics.stringWidth(n, 'C-XBIt', 15)
    para(c, W - M - nw - 5.5 * mm, 7.4 * mm, 1.4 * mm, 4.6 * mm, 1.2 * mm, fill=acc)
    c.restoreState()

def page_recipe(c, doc): footer(c, doc)
def page_light(c, doc): footer(c, doc)
def page_divider(c, doc): footer(c, doc)
b.page_recipe = page_recipe; b.page_light = page_light; b.page_divider = page_divider

def page_cover(c, doc):
    c.saveState()
    c.setFillColor(SCHWARZ); c.rect(0, 0, W, H, fill=1, stroke=0)
    p = c.beginPath(); p.moveTo(0, H * 0.30); p.lineTo(W, H * 0.47); p.lineTo(W, H * 0.47 - 30 * mm); p.lineTo(0, H * 0.30 - 30 * mm); p.close()
    c.setFillColor(BLAU); c.drawPath(p, fill=1, stroke=0)
    p = c.beginPath(); p.moveTo(0, H * 0.30 - 33 * mm); p.lineTo(W, H * 0.47 - 33 * mm); p.lineTo(W, H * 0.47 - 37 * mm); p.lineTo(0, H * 0.30 - 37 * mm); p.close()
    c.setFillColor(colors.HexColor('#2cc4f5')); c.drawPath(p, fill=1, stroke=0)
    b.draw_logo(c, M, H - 52 * mm, 24 * mm)
    c.setFillColor(WEISS); c.setFont('C-XBIt', 82); c.drawString(M - 1 * mm, H - 88 * mm, 'Rezeptbuch')
    c.setFont('C-BoldIt', 19); c.setFillColor(colors.HexColor('#8db0ff'))
    c.drawString(M, H - 100 * mm, f'{sum(b.n_recipes(k) for k, *_ in b.ALL)} Rezepte für Training, Alltag und Wettkampf')
    half = (len(b.ALL) + 1) // 2
    for i, (key, name, txt) in enumerate(b.ALL):
        x = M + (0 if i < half else (W - 2 * M) / 2 + 2 * mm); y = H - 116 * mm - (i % half) * 7.6 * mm
        para(c, x, y - 0.4 * mm, 1.6 * mm, 4.6 * mm, 1.2 * mm, fill=ACC.get(key, BLAU))
        c.setFillColor(WEISS); c.setFont('C-BoldIt', 13.5); c.drawString(x + 5 * mm, y, name.replace('&amp;', '&'))
    c.setFillColor(colors.HexColor('#b4bdd0')); c.setFont('A-Regular', 9.5)
    c.drawString(M, 16 * mm, f'{len(b.ALL)} Kapitel, alle Nährwerte pro Portion berechnet')
    c.restoreState()
b.page_cover = page_cover

# ---------- Rezeptseite ----------
def ing_table(r, width):
    rows = []
    for z in r['zutaten']:
        rows.append([Paragraph(esc(z['anzeige']), st('am', fontName='C-Bold', fontSize=11.5, leading=14)),
                     Paragraph(esc(z['name']), st('nm', fontSize=10.5, leading=14))])
    t = Table(rows, colWidths=[30 * mm, width - 30 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), 0.5, LINIE),
                           ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 3), ('TOPPADDING', (0, 0), (-1, -1), 2.6),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 3.2)]))
    return t

def steps_table(steps, width, acc):
    rows = [[Paragraph(f'<font name="C-XBIt" size="22" color="#1f5bff">{i}</font>', st('n', leading=22)), Paragraph(esc(t), st('sp', fontSize=10.8, leading=15.5))]
            for i, t in enumerate(steps, 1)]
    t = Table(rows, colWidths=[9 * mm, width - 9 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    return t

def recipe_page(key, gname, r, ing):
    acc = ACC.get(key, BLAU); m = r['m']
    chips = []
    if 'passt_fuer' in r: chips.append((b.diet_of(r), SCHWARZ, WEISS, None))
    if r.get('portionen', 1) > 1: chips.append((f'{r["portionen"]} Portionen', SCHWARZ, WEISS, None))
    chips += [(t, None, SCHWARZ, colors.HexColor('#c9cfda')) for t in r.get('tags', [])[:3]]
    pp = ' / Portion' if r.get('portionen', 1) > 1 else ''
    items = [(r['zeit_min'], 'Min.', 'Aktive Zeit' if pp else 'Zubereitung'), (round(m['kcal']), 'kcal', 'Energie' + pp),
             (round(m['p']), 'g', 'Eiweiß'), (round(m['c']), 'g', 'Kohlenhydrate'), (round(m['f']), 'g', 'Fett')]
    if 'kosten_eur' in r: items.append((de(r['kosten_eur'], 2), '€', 'Kosten ca.'))
    s = [Spacer(0, 6 * mm), Paragraph(esc(r['name']), H_TITLE), Spacer(0, 2.5 * mm), Paragraph(esc(r['beschreibung']), H_DESC),
         Spacer(0, 3.5 * mm)]
    if chips: s += [Chips(chips), Spacer(0, 4.5 * mm)]
    s += [Score(items, acc), Spacer(0, 6 * mm)]
    lw = 76 * mm; rw = W - 2 * M - lw - 9 * mm
    head = f'Zutaten für {r["portionen"]} Portionen' if r.get('portionen', 1) > 1 else 'Zutaten'
    left = [Paragraph(head, H_SEC), Spacer(0, 2.5 * mm), ing_table(r, lw)]
    right = [Paragraph('Zubereitung', H_SEC), Spacer(0, 3 * mm), steps_table(r['zubereitung'], rw, acc)]
    if r.get('tipp'): right += [Spacer(0, 2 * mm), callout('Tipp', esc(r['tipp']), acc, label_color=SCHWARZ, w=rw)]
    body = Table([[left, '', right]], colWidths=[lw, 9 * mm, rw])
    body.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    s.append(body)
    avail = H - FRAME_TOP_GAP - 16 * mm - 2 * mm
    return [b.Anchor(r['anchor'], gname, r['mahlzeit']), Hero(key, r, gname),
            KeepInFrame(W - 2 * M, avail - 60 * mm, s, mode='shrink')]
b.recipe_page = recipe_page

# ---------- Kapitel-Öffner ----------
def opener(key, gname, desc, sections, links=(), extra=None, kicker=None):
    """sections: [(titel, [(name, anchor|None, info)])]"""
    acc = ACC.get(key, BLAU)
    s = [b.Anchor(f'div-{key}', gname, ''), ChapterHero(key, gname, kicker=kicker, bg='' if key == 'gratis' else None), Spacer(0, 9 * mm),
         Paragraph(esc(desc), st('od', fontSize=12, leading=17, textColor=SCHWARZ)), Spacer(0, 5 * mm)]
    if extra: s += [extra, Spacer(0, 6 * mm)]
    inner = []
    for title, rows in sections:
        inner += [Table([[Mark(acc, w=3 * mm, h=3.4 * mm, dy=0.6 * mm), Paragraph(esc(title), st('sh', fontName='C-BoldIt', fontSize=14, leading=16))]],
                        colWidths=[6 * mm, W - 2 * M - 6 * mm], style=[('LEFTPADDING', (0, 0), (-1, -1), 0), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BOTTOMPADDING', (0, 0), (-1, -1), 1)])]
        tr = []
        for name, anchor, info in rows:
            nm = f'<a href="#{anchor}" color="#0a0c10">{esc(name)}</a>' if anchor else esc(name)
            pg = f'<a href="#{anchor}" color="#1f5bff">{b.PREV_PAGES.get(anchor, "")}</a>' if anchor else ''
            tr.append([Paragraph(nm, st('rn', fontName='A-Medium', fontSize=10.3, leading=13.5)), Paragraph(info, st('ri', fontSize=9, leading=13.5, textColor=GRAU)),
                       Paragraph(pg, st('rp', fontName='C-XBIt', fontSize=12, leading=13.5, alignment=2))])
        t = Table(tr, colWidths=[104 * mm, 54 * mm, W - 2 * M - 158 * mm])
        t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                               ('TOPPADDING', (0, 0), (-1, -1), 1.8), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.6), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
        inner += [t, Spacer(0, 5 * mm)]
    for text, anchor in links:
        inner += [Paragraph(f'<a href="#{anchor}" color="#1f5bff">{text} <font name="C-XBIt">{b.PREV_PAGES.get(anchor, "")}</font></a>', st('ol', fontName='A-SemiBold', fontSize=10.5, leading=15))]
    s.append(KeepInFrame(W - 2 * M, H - 16 * mm - FRAME_TOP_GAP - 58 * mm - 40 * mm - (25 * mm if extra else 0), inner, mode='shrink'))
    return s

def info_for(key, r):
    if key == 'mealprep': return f'{r["mahlzeit"]}, {round(r["m"]["kcal"])} kcal'
    if key == 'budget': return f'{b.diet_of(r)}, ca. {de(r["kosten_eur"], 2)} €'
    if key == 'schnell': return f'{b.diet_of(r)}, {r["zeit_min"]} Min.'
    if 'passt_fuer' in r: return f'{b.diet_of(r)}, {round(r["m"]["kcal"])} kcal'
    return f'{round(r["m"]["kcal"])} kcal, {round(r["m"]["p"])} g Eiweiß'

def chapter_divider(key, gname, gtxt, recs):
    d = b.data[key]; secs = d.get('sections', b.MEALS)
    sections = [(b.MEAL_PL.get(sec, sec),
                 [(r['name'], r['anchor'], info_for(key, r)) for r in recs if r.get('sec', r['mahlzeit']) == sec]) for sec in secs]
    links = []
    if key == 'schnell':
        n = sum(1 for k, *_ in b.GROUPS for r in b.data[k]['recipes'] if r['zeit_min'] <= 10)
        links.append((f'Noch {n} weitere Rezepte unter 10 Minuten aus den anderen Kapiteln: Seite', 'mehr-schnell'))
    if key in b.GUIDES: links.append((b.GUIDES[key][2] + ': Seite', f'guide-{key}'))
    if key != 'mealprep': links.append((f'Einkaufsliste für alle {len(recs)} Rezepte dieses Kapitels: Seite', f'shop-{key}'))
    extra = callout('Gut zu wissen', esc(b.FAUST[key]), ACC.get(key, BLAU), label_color=SCHWARZ) if key in b.FAUST else None
    desc = gtxt + (' Ohne Ofen, ohne Wartezeit, mit cleveren Zutaten aus dem Supermarkt wie Express-Reis, Bohnen aus der Dose oder Aufschnitt.' if key == 'schnell' else '')
    return opener(key, gname, desc, sections, links, extra)
b.divider = chapter_divider; b.divider_schnell = chapter_divider

def unterwegs_chapter():
    U = b.UNTERWEGS; key, gname, gtxt = b.UNTERWEGS_CH
    regeln = callout('Grundregeln', '<br/>'.join(f'<font name="C-XBIt" color="#1f5bff">{i}</font>  {esc(g)}' for i, g in enumerate(U['grundregeln'], 1)), ACC[key], label_color=SCHWARZ)
    sections = [('Orte', [(o['ort'], f'ort-{i}', '') for i, o in enumerate(U['orte'])])]
    return opener(key, gname, U['einleitung'], sections, (), regeln)
b.unterwegs_chapter = unterwegs_chapter

def ort_block(i, o):
    cw = (W - 2 * M - 9 * mm) / 2; acc = ACC['unterwegs']
    left = [Paragraph('Gute Wahl', st('og', fontName='C-BoldIt', fontSize=14, leading=16, textColor=BLAU)), Spacer(0, 2 * mm), blist([esc(x) for x in o['gut']], BLAU, width=cw)]
    right = [Paragraph('Lieber seltener', st('ol2', fontName='C-BoldIt', fontSize=14, leading=16, textColor=GRAU)), Spacer(0, 2 * mm), blist([esc(x) for x in o['lieber_seltener']], colors.HexColor('#b4bdd0'), width=cw)]
    g = Table([[left, '', right]], colWidths=[cw, 9 * mm, cw])
    g.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    return KeepTogether([b.Anchor(f'ort-{i}', b.UNTERWEGS_CH[1], 'Ratgeber'), Paragraph(esc(o['ort']), st('ot', fontName='C-XBIt', fontSize=26, leading=28)), Spacer(0, 3 * mm), g,
                         Spacer(0, 3 * mm), callout('Trick', esc(o['trick']), acc, label_color=SCHWARZ), Spacer(0, 10 * mm)])
b.ort_block = ort_block

# ---------- Lexikon ----------
try:
    import build_lexikon as L
    L.box = box
    def lex_footer(c, doc): footer(c, doc, 'Zutatenlexikon')
    L.page_lex = lex_footer; L.page_light_lex = lambda c, d: footer(c, d, 'Zutatenlexikon')
    for cat in L.CATS: NAME2KEY[cat] = 'lexikon'; NAME2KEY[cat.replace('&', '&amp;')] = 'lexikon'

    def num(v): return de(v, 0) if v >= 10 or float(v).is_integer() else de(v, 1)
    def lex_divider(i, cat):
        ents = [e for e in L.ENTRIES if e['kategorie'] == cat]
        hs = st('hh', fontName='C-Semi', fontSize=9.5, leading=11, textColor=GRAU, alignment=2)
        cs = st('cv', fontName='C-Semi', fontSize=11, leading=13, alignment=2)
        rows = [[Paragraph('pro 100 g', st('h0', fontName='C-Semi', fontSize=9.5, textColor=GRAU)), Paragraph('kcal', hs), Paragraph('Eiweiß', hs), Paragraph('KH', hs),
                 Paragraph('Fett', hs), Paragraph('Ballastst.', hs), Paragraph('', hs)]]
        for e in ents:
            n = e['naehrwerte_100g']
            rows.append([Paragraph(f'<a href="#lex-{e["id"]}" color="#0a0c10">{esc(e["name"])}</a><br/><font size="8.5" color="#5b6475">{esc(e["bezug"])}</font>', st('dn', fontName='A-Medium', fontSize=10.5, leading=13)),
                         Paragraph(num(n['kcal']), cs), Paragraph(num(n['eiweiss_g']), st('cv2', parent=cs, textColor=BLAU, fontName='C-Bold')), Paragraph(num(n['kohlenhydrate_g']), cs),
                         Paragraph(num(n['fett_g']), cs), Paragraph(num(n['ballaststoffe_g']), cs),
                         Paragraph(f'<a href="#lex-{e["id"]}" color="#1f5bff">{b.PREV_PAGES.get("lex-" + e["id"], "")}</a>', st('dp', fontName='C-XBIt', fontSize=12, leading=13, alignment=2))])
        t = Table(rows, colWidths=[70 * mm, 16 * mm, 18 * mm, 16 * mm, 16 * mm, 22 * mm, W - 2 * M - 158 * mm])
        t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                               ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
        s = [b.Anchor(f'lexcat-{i}', cat.replace('&', '&amp;'), ''), ChapterHero('lexikon', cat, kicker='Zutatenlexikon', bg=''), Spacer(0, 9 * mm),
             Paragraph(esc(L.CAT_TXT.get(cat, '')), st('od', fontSize=12, leading=17)), Spacer(0, 7 * mm),
             KeepInFrame(W - 2 * M, H - 16 * mm - FRAME_TOP_GAP - 58 * mm - 45 * mm, [t], mode='shrink')]
        return s
    L.divider = lex_divider

    def lex_entry(e):
        n = e['naehrwerte_100g']; cw = (W - 2 * M - 9 * mm) / 2
        items = [(num(n['kcal']), 'kcal', 'Energie'), (num(n['eiweiss_g']), 'g', 'Eiweiß'), (num(n['kohlenhydrate_g']), 'g', 'Kohlenhydrate'),
                 (num(n['fett_g']), 'g', 'Fett'), (num(n['ballaststoffe_g']), 'g', 'Ballaststoffe')]
        s = [Chips([(e['kategorie'], SCHWARZ, WEISS, None), ('Zutatenlexikon', None, SCHWARZ, colors.HexColor('#c9cfda'))]), Spacer(0, 5 * mm),
             Paragraph(esc(e['name']), H_TITLE), Spacer(0, 2.5 * mm), Paragraph(esc(e['kurz']), H_DESC), Spacer(0, 5 * mm),
             Score(items, BLAU), Spacer(0, 1 * mm), Paragraph(f'Pro 100 g, {esc(e["bezug"])}. Übliche Portion: {esc(e["portion"])}', P_SMALL), Spacer(0, 4 * mm),
             Paragraph('<font name="C-BoldIt" size="13">Steckt drin </font>  ' + '<font color="#c9cfda">  /  </font>'.join(f'<font name="A-SemiBold" color="#1f5bff">{esc(x)}</font>' for x in e['naehrstoffe']), st('ch', fontSize=10.5, leading=15)),
             Spacer(0, 2.5 * mm), Paragraph(f'<font name="C-BoldIt" size="13">Eiweißqualität </font>  {esc(e["eiweissqualitaet"])}', st('eq', fontSize=10.5, leading=15)), Spacer(0, 6 * mm)]
        left = [Paragraph('Stärken', H_SEC), Spacer(0, 2 * mm), blist([esc(x) for x in e['staerken']], BLAU, 10.3, cw), Spacer(0, 3 * mm),
                Paragraph('Gut geeignet für', H_SEC), Spacer(0, 2 * mm), blist([esc(x) for x in e['gut_fuer']], BLAU, 10.3, cw)]
        right = [Paragraph('Weniger geeignet', st('wg', fontName='C-BoldIt', fontSize=16, leading=18, textColor=GRAU)), Spacer(0, 2 * mm), blist([esc(x) for x in e['weniger_geeignet']], colors.HexColor('#b4bdd0'), 10.3, cw),
                 Spacer(0, 3 * mm), Paragraph('Tipps', H_SEC), Spacer(0, 2 * mm), blist([esc(x) for x in e['tipps']], BLAU, 10.3, cw), Spacer(0, 1.5 * mm),
                 Paragraph(f'<font name="A-SemiBold">Lagerung:</font> {esc(e["lagerung"])}', st('lg', fontSize=9.5, leading=13.5, textColor=GRAU))]
        g = Table([[left, '', right]], colWidths=[cw, 9 * mm, cw])
        g.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
        s += [g, Spacer(0, 5 * mm)]
        if e.get('hinweis'): s += [callout('Hinweis', esc(e['hinweis']), colors.HexColor('#ffb020'), label_color=colors.HexColor('#9a6400')), Spacer(0, 4 * mm)]
        s += [callout('Im Alpha5-Plan', esc(e['alpha5']), BLAU)]
        return [b.Anchor(f'lex-{e["id"]}', e['kategorie'].replace('&', '&amp;'), e['name']), KeepInFrame(W - 2 * M, H - FRAME_TOP_GAP - 16 * mm - 3 * mm, s, mode='shrink')]
    L.entry = lex_entry
except ImportError:
    L = None

# ---------- Einleitung und Inhalt ----------
import ast
def _intro_points():
    tree = ast.parse(open(b.__file__).read())
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == 'intro':
            for n in ast.walk(node):
                if isinstance(n, ast.Assign) and any(getattr(t, 'id', '') == 'pts' for t in n.targets):
                    return ast.literal_eval(n.value)
    return []

def intro_pages():
    pts = _intro_points()
    s = [Spacer(0, 2 * mm), Paragraph('So nutzt du dieses Buch', st('it', fontName='C-XBIt', fontSize=38, leading=40)), Spacer(0, 7 * mm)]
    cw = (W - 2 * M - 10 * mm) / 2
    cells = []
    for i, (h, t) in enumerate(pts, 1):
        cells.append([Paragraph(f'<font name="C-XBIt" size="26" color="#1f5bff">{i}</font>', st('nn', leading=26)),
                      [Paragraph(esc(h), st('ih', fontName='C-BoldIt', fontSize=15, leading=17)), Spacer(0, 1 * mm), Paragraph(t, st('itx', fontSize=10, leading=14.2, textColor=GRAU))]])
    half = (len(cells) + 1) // 2
    def col(cs):
        t = Table(cs, colWidths=[10 * mm, cw - 10 * mm])
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                               ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
        return t
    g = Table([[col(cells[:half]), '', col(cells[half:])]], colWidths=[cw, 10 * mm, cw])
    g.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    s.append(g)
    out = [KeepInFrame(W - 2 * M, H - 16 * mm - 26 * mm - 2 * mm, s, mode='shrink'), PageBreak()]
    rows = []
    for i, (k, n, txt) in enumerate(b.ALL, 1):
        a = f'div-{k}'
        rows.append([Mark(ACC.get(k, BLAU), w=3.4 * mm, h=8 * mm, dy=0.5 * mm),
                     Paragraph(f'<font name="C-XBIt" size="22">{i}</font>', st('cn', leading=22)),
                     Paragraph(f'<a href="#{a}" color="#0a0c10"><font name="C-BoldIt" size="15">{n}</font></a><br/><font size="9" color="#5b6475">{esc(b.COVER_TXT.get(k, ""))}</font>', st('cnm', leading=14)),
                     Paragraph(f'<a href="#{a}" color="#1f5bff">{b.PREV_PAGES.get(a, "")}</a>', st('cp', fontName='C-XBIt', fontSize=17, leading=20, alignment=2))])
    t = Table(rows, colWidths=[7 * mm, 13 * mm, W - 2 * M - 40 * mm, 20 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LINEBELOW', (0, 0), (-1, -1), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 2.2), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    out += [Paragraph('Inhalt', st('ih2', fontName='C-XBIt', fontSize=38, leading=40)), Spacer(0, 6 * mm),
            KeepInFrame(W - 2 * M, H - 16 * mm - 26 * mm - 22 * mm, [t], mode='shrink')]
    return out
b.INTRO_PAGES = intro_pages
