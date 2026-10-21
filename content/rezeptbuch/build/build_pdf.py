import json, os, sys
from collections import OrderedDict, defaultdict
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, NextPageTemplate, KeepInFrame, FrameBreak, KeepTogether, Flowable, Image as RLImage)

S = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/daten'
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/ausgabe/Alpha5-Rezeptbuch.pdf'

for n in ['Regular', 'SemiBold', 'Bold', 'Black']:
    pdfmetrics.registerFont(TTFont(f'A-{n}', f'{S}/fonts/Archivo-{n}.ttf'))

SCHWARZ = colors.HexColor('#0a0c10'); GRAPHIT = colors.HexColor('#151922'); GRAPHIT_H = colors.HexColor('#262c3a')
BLAU = colors.HexColor('#1f5bff'); BLAU_D = colors.HexColor('#1747cc'); HIMMEL = colors.HexColor('#8db0ff')
EIS = colors.HexColor('#e3ebff'); HELL = colors.HexColor('#f4f6fa'); GRAU = colors.HexColor('#586173')
GRAU_D = colors.HexColor('#b4bdd0'); LINIE = colors.HexColor('#dfe4ee'); WEISS = colors.white

# Logo (transparent, blau) zuschneiden
logo_src = Image.open(S + '/adaptive-icon.png').convert('RGBA')
logo = logo_src.crop(logo_src.getbbox())
LOGO = f'{S}/logo.png'; logo.save(LOGO)
LW, LH = logo.size

GROUPS = [
    ('vegan', 'Vegan', 'Rein pflanzlich: ohne Fleisch, Fisch, Milch, Ei und Honig.'),
    ('vegetarisch', 'Vegetarisch', 'Ohne Fleisch und Fisch, mit Eiern und Milchprodukten.'),
    ('fleisch', 'Mit Fleisch', 'Für Fleischesser, mit magerem Schweinefleisch, Geflügel, Rind und Fisch.'),
    ('ohne-schwein', 'Ohne Schweinefleisch', 'Fleisch und Fisch, aber nichts vom Schwein, auch keine Gelatine.'),
]
MEALS = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack']
MEAL_PL = {'Frühstück': 'Frühstück', 'Mittagessen': 'Mittagessen', 'Abendessen': 'Abendessen', 'Snack': 'Snacks'}
DEPT_ORDER = ["Obst & Gemüse", "Fleisch & Fisch", "Kühlregal & Molkerei", "Pflanzliche Alternativen", "Brot & Backwaren",
              "Getreide, Nudeln & Hülsenfrüchte", "Konserven & Gläser", "Nüsse, Samen & Trockenfrüchte", "Tiefkühl",
              "Gewürze, Öle & Saucen", "Sonstiges"]

def de(x, d=0):
    s = f'{x:.{d}f}'
    return s.replace('.', ',')

def macros(r, ing):
    t = dict(kcal=0, p=0, c=0, f=0)
    for z in r['zutaten']:
        v = ing[z['name']]; g = z['menge_g'] / 100
        for k in t: t[k] += v[k] * g
    n = r.get('portionen', 1)
    return {k: v / n for k, v in t.items()}

data = {}
for key, *_ in GROUPS:
    fix = lambda t: t.replace('⅓', '1/3').replace('⅔', '2/3')
    d = json.loads(fix(open(f'{WORK}/{key}.json').read()))
    d2 = json.loads(fix(open(f'{WORK}/{key}-2.json').read()))
    for n, v in d2['ingredients'].items(): d['ingredients'].setdefault(n, v)
    d['recipes'] += d2['recipes']
    order = {m: i for i, m in enumerate(MEALS)}
    d['recipes'].sort(key=lambda r: order[r['mahlzeit']])
    for i, r in enumerate(d['recipes']):
        r['m'] = macros(r, d['ingredients'])
        r['anchor'] = f'{key}-{i}'
    data[key] = d

SCHNELL = ('schnell', 'Fertig in 10 Minuten', 'Vom Kühlschrank auf den Teller in höchstens 10 Minuten. Gemischt für alle Ernährungsformen.')
DIET_LABEL = {'vegan': 'Vegan', 'vegetarisch': 'Vegetarisch', 'fleisch': 'Mit Schweinefleisch', 'ohne-schwein': 'Ohne Schweinefleisch'}
def diet_of(r):
    pf = r.get('passt_fuer', [])
    for k in ['vegan', 'vegetarisch', 'ohne-schwein']:
        if k in pf: return DIET_LABEL[k]
    return DIET_LABEL['fleisch']
_fix = lambda t: t.replace('⅓', '1/3').replace('⅔', '2/3')
d = json.loads(_fix(open(f'{WORK}/schnell.json').read()))
_order = {m: i for i, m in enumerate(MEALS)}
d['recipes'].sort(key=lambda r: _order[r['mahlzeit']])
for i, r in enumerate(d['recipes']):
    r['m'] = macros(r, d['ingredients']); r['anchor'] = f'schnell-{i}'
data['schnell'] = d
# Rezepte unter 10 Minuten in den übrigen Kapiteln markieren
for key, *_ in GROUPS:
    for r in data[key]['recipes']:
        if r['zeit_min'] <= 10 and 'Unter 10 Minuten' not in r.get('tags', []):
            r['tags'] = ['Unter 10 Minuten'] + r.get('tags', [])
TRAINING = [
    ('pre', 'Pre-Workout', 'Kleine Mahlzeiten vor dem Training: leicht verdauliche Kohlenhydrate für Energie, wenig Fett und Ballaststoffe, damit nichts schwer im Magen liegt.',
     'Faustregel: Eine kleine Mahlzeit 60 bis 90 Minuten vorher, ein leichter Snack bis etwa 30 Minuten vorher. Probiere neue Rezepte zuerst an einem lockeren Trainingstag aus.'),
    ('post', 'Post-Workout', 'Kleine Mahlzeiten nach dem Training: viel Eiweiß für die Muskeln und Kohlenhydrate, um die Speicher wieder aufzufüllen.',
     'Faustregel: Direkt danach ein Shake oder schneller Snack, wenn die nächste Mahlzeit noch dauert. Innerhalb von etwa 2 Stunden eine kleine, vollwertige Mahlzeit.'),
    ('cardio', 'Cardio &amp; Ausdauer', 'Für Läufer, Radfahrer, Schwimmer und Triathleten bei langen Einheiten: Kohlenhydrate vorher, unterwegs und danach, dazu Flüssigkeit und etwas Salz.',
     'Faustregel: Ab etwa 60 bis 90 Minuten Belastung lohnt sich Verpflegung unterwegs, meist 30 bis 60 g Kohlenhydrate pro Stunde. Mehr nur, wenn du es im Training geübt hast.'),
]
for key, *_ in TRAINING:
    d = json.loads(_fix(open(f'{WORK}/{key}.json').read()))
    sec = []
    for r in d['recipes']:
        if r['mahlzeit'] not in sec: sec.append(r['mahlzeit'])
    d['recipes'].sort(key=lambda r: sec.index(r['mahlzeit']))
    d['sections'] = sec
    for i, r in enumerate(d['recipes']):
        r['m'] = macros(r, d['ingredients']); r['anchor'] = f'{key}-{i}'
    data[key] = d
MORE = [
    ('wettkampf', 'Wettkampftag', 'Für Halbmarathon, Marathon, Triathlon und lange Radrennen: Carb-Loading, das Abendessen davor, Frühstück am Renntag, Verpflegung im Rennen und Erholung nach dem Ziel.',
     'Wichtigste Regel: Nichts Neues am Wettkampftag. Teste jedes Rezept und jede Menge vorher bei einer langen Trainingseinheit.'),
    ('mealprep', 'Meal-Prep-Wochenpläne', 'Einmal am Sonntag rund 2 Stunden kochen, von Montag bis Freitag versorgt: Frühstück, Mittagessen und Snack für 5 Tage. Vier Pläne, einer für jede Ernährungsform.',
     'So funktioniert es: Jeder Plan hat einen Kochtag-Ablauf mit Uhrzeiten, drei Rezepte für je 5 Portionen und eine eigene Einkaufsliste. Abends kochst du frisch, zum Beispiel aus „Fertig in 10 Minuten“.'),
    ('fastfood', 'Fitness-Fast-Food', 'Pizza, Burger, Hot Dog, Döner und Mac &amp; Cheese in Fitness-Version: mindestens 35 g Eiweiß, deutlich weniger Fett und trotzdem echtes Cheat-Day-Gefühl.',
     'Tipp: Fast Food passt gut an Trainingstagen als Mahlzeit nach dem Training. Rezepte mit dem Hinweis „Heißluftfritteuse“ gelingen auch im Backofen, die Alternative steht jeweils im Tipp.'),
    ('airfryer', 'Heißluftfritteuse', 'Knusprig mit wenig Öl, schnell und mit wenig Abwasch: Hauptgerichte, Beilagen und Snacks, die in der Heißluftfritteuse besonders gut gelingen.',
     'Gut zu wissen: Zeiten und Temperaturen sind Richtwerte für einen mittelgroßen Korb. Jedes Gerät heizt etwas anders, prüfe deshalb beim ersten Mal früher nach.'),
    ('dessert', 'Protein-Desserts', 'Süßes, das zum Ziel passt: Cremes, Kuchen aus Ofen oder Mikrowelle und Eis, alle mit mindestens 15 g Eiweiß und wenig Zucker.',
     'Tipp: Ein Dessert mit viel Eiweiß ist auch ein guter Abend-Snack. Rezepte mit Casein oder Quark halten besonders lange satt.'),
    ('eis', 'Sommer-Eis', 'Protein-Eis, Frozen Joghurt und Sorbets für heiße Tage – gemacht in der Eismaschine mit Gefrierbecher. Jedes Rezept ergibt einen Becher mit mindestens 25 g Eiweiß.',
     'So geht es: Masse mixen, im Gefrierbecher 24 Stunden einfrieren, mit dem Programm für leichtes Eis verarbeiten. Bei veganen Rezepten darauf achten, dass Proteinpulver und Geschmackspulver als vegan gekennzeichnet sind.'),
    ('budget', 'Spar-Küche', 'Fitnessgerecht essen für unter 2 € pro Portion: mit Haferflocken, Linsen, Eiern, Quark, TK-Gemüse und Eigenmarken.',
     'Zu den Preisen: Die Kosten sind geschätzte Richtwerte für Discounter-Eigenmarken in Deutschland, Stand 2026. Sie schwanken je nach Markt, Region und Saison.'),
]
for key, *_ in MORE:
    d = json.loads(_fix(open(f'{WORK}/{key}.json').read()))
    if os.path.exists(f'{WORK}/{key}-2.json'):
        d2 = json.loads(_fix(open(f'{WORK}/{key}-2.json').read()))
        for n, v in d2['ingredients'].items(): d['ingredients'].setdefault(n, v)
        d['recipes'] += d2['recipes']
    if key == 'mealprep':
        plans = {pl['plan']: pl for pl in d['plaene']}
        order = ['vegan', 'vegetarisch', 'fleisch', 'ohne-schwein']
        mo = {m: i for i, m in enumerate(MEALS)}
        d['recipes'].sort(key=lambda r: (order.index(r['plan']), mo[r['mahlzeit']]))
        for r in d['recipes']: r['sec'] = plans[r['plan']]['titel']
        d['sections'] = [plans[k]['titel'] for k in order]
        d['plans'] = [plans[k] for k in order]
    else:
        sec = []
        for r in d['recipes']:
            if r['mahlzeit'] not in sec: sec.append(r['mahlzeit'])
        d['recipes'].sort(key=lambda r: sec.index(r['mahlzeit']))
        d['sections'] = sec
    for i, r in enumerate(d['recipes']):
        r['m'] = macros(r, d['ingredients']); r['anchor'] = f'{key}-{i}'
    data[key] = d
GUIDES = {'wettkampf': ('So planst du deine Wettkampf-Ernährung', 'Richtwerte für Wettkämpfe über etwa 90 Minuten. Jeder Körper reagiert anders, deshalb gilt: alles vorher im Training ausprobieren.', 'Ratgeber: So planst du deine Wettkampf-Ernährung'),
          'airfryer': ('So gelingt Fitness-Essen aus der Heißluftfritteuse', 'Allgemeine Tipps für Heißluftfritteusen. Beachte zusätzlich immer die Anleitung deines Geräts.', 'Anleitung: So gelingt Fitness-Essen aus der Heißluftfritteuse'),
          'eis': ('So gelingt Protein-Eis aus der Eismaschine', 'Allgemeine Tipps für Eismaschinen mit Gefrierbecher. Beachte zusätzlich immer die Anleitung deines Geräts.', 'Anleitung: So gelingt Protein-Eis aus der Eismaschine')}
UNTERWEGS = json.loads(open(f'{WORK}/unterwegs.json').read())
data['schnell']['sections'] = MEALS
SPECIAL = {'schnell', 'pre', 'post', 'cardio', 'wettkampf', 'mealprep', 'fastfood', 'airfryer', 'dessert', 'eis', 'budget'}
FAUST = {k: f for k, _, _, f in TRAINING + MORE}
COVER_TXT = {'schnell': 'In höchstens 10 Minuten auf dem Teller, für alle Ernährungsformen.',
             'pre': 'Kleine Mahlzeiten für Energie vor dem Training.',
             'post': 'Eiweiß und Kohlenhydrate für die Erholung danach.',
             'cardio': 'Vorher, unterwegs und danach bei langen Einheiten.',
             'wettkampf': 'Carb-Loading, Renntag-Frühstück, Verpflegung.',
             'mealprep': 'Sonntags vorkochen, Mo–Fr versorgt.',
             'dessert': 'Süßes mit mindestens 15 g Eiweiß.',
             'budget': 'Fitnessgerecht für unter 2 € pro Portion.',
             'eis': 'Protein-Eis und Frozen Joghurt für heiße Tage.',
             'fastfood': 'Pizza, Burger und Co. mit viel Eiweiß.',
             'airfryer': 'Knusprig mit wenig Öl, schnell gemacht.',
             'vegan': 'Rein pflanzlich.', 'vegetarisch': 'Mit Eiern und Milchprodukten.',
             'fleisch': 'Mit magerem Schweinefleisch, Geflügel, Fisch.',
             'ohne-schwein': 'Fleisch und Fisch, nichts vom Schwein.',
             'unterwegs': 'Gut essen beim Bäcker, Döner, im Hotel.'}
COVER_TXT['schnell'] = 'Auf dem Teller in höchstens 10 Minuten.'
COVER_TXT['pre'] = 'Energie vor dem Training.'
COVER_TXT['post'] = 'Erholung nach dem Training.'
UNTERWEGS_CH = ('unterwegs', 'Unterwegs essen', 'Kein Rezept, sondern ein Ratgeber: So triffst du beim Bäcker, an der Tankstelle, im Restaurant oder auf Reisen eine gute Wahl.')
LEXIKON_CH = ('lexikon', 'Zutatenlexikon', 'Die Basics der Fitness-Küche: was Kartoffeln, Reis, Getreide, Hülsenfrüchte, Nüsse, Saaten, Eiweißquellen und Öle können und für wen sie passen.')
COVER_TXT['lexikon'] = '59 Grundnahrungsmittel kurz erklärt.'
LEX_HOOK = None; LEX_PAGE = None; INTRO_PAGES = None
ALL = [SCHNELL] + [t[:3] for t in TRAINING] + [t[:3] for t in MORE] + GROUPS + [UNTERWEGS_CH, LEXIKON_CH]
def n_recipes(k): return len(data[k]['recipes']) if k in data else 0

# ---------- Styles ----------
def st(name, **kw):
    base = dict(fontName='A-Regular', fontSize=9.5, leading=13.5, textColor=SCHWARZ)
    base.update(kw); return ParagraphStyle(name, **base)
H_TITLE = st('t', fontName='A-Black', fontSize=27, leading=29)
H_DESC = st('d', fontSize=11, leading=15.5, textColor=GRAU)
H_SEC = st('s', fontName='A-Bold', fontSize=13, leading=16, textColor=BLAU_D)
P_BODY = st('b')
P_ING = st('i', fontSize=11, leading=14.5)
P_STEP = st('st', fontSize=11.5, leading=16.5)
P_TIP = st('tip', fontSize=11, leading=15.5)
P_SMALL = st('sm', fontSize=8.5, leading=11.5, textColor=GRAU)

# ---------- Page decoration ----------
W, H = A4
M = 16 * mm
STATE = {'group': '', 'meal': ''}

def draw_logo(c, x, y, h):
    w = h * LW / LH
    c.drawImage(LOGO, x, y, w, h, mask='auto')
    return w

def page_recipe(c, doc):
    c.saveState()
    c.setFillColor(SCHWARZ); c.rect(0, H - 14 * mm, W, 14 * mm, fill=1, stroke=0)
    lw = draw_logo(c, M, H - 9.6 * mm, 5 * mm)
    c.setFont('A-Bold', 9.5); c.setFillColor(WEISS)
    c.drawString(M + lw + 3 * mm, H - 8.6 * mm, 'Rezeptbuch')
    c.setFont('A-SemiBold', 9); c.setFillColor(HIMMEL)
    c.drawRightString(W - M, H - 8.6 * mm, f"{STATE['group']}  ·  {STATE['meal']}".replace('&amp;', '&'))
    c.setStrokeColor(LINIE); c.setLineWidth(0.6); c.line(M, 12 * mm, W - M, 12 * mm)
    c.setFont('A-Regular', 8); c.setFillColor(GRAU)
    c.drawString(M, 7.5 * mm, 'Alpha5 · Nährwerte sind berechnete Richtwerte pro Portion.')
    c.drawRightString(W - M, 7.5 * mm, str(doc.page))
    c.restoreState()

def page_dark(c, doc):
    c.saveState(); c.setFillColor(SCHWARZ); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BLAU); c.setFillAlpha(0.10); c.circle(W * 0.85, H * 0.88, 95 * mm, fill=1, stroke=0)
    c.restoreState()

def page_cover(c, doc):
    page_dark(c, doc)
    c.saveState()
    draw_logo(c, M, H - 75 * mm, 30 * mm)
    c.setFillColor(WEISS); c.setFont('A-Black', 50); c.drawString(M, H - 112 * mm, 'Rezeptbuch')
    c.setFillColor(HIMMEL); c.setFont('A-SemiBold', 15)
    c.drawString(M, H - 125 * mm, f'{sum(n_recipes(k) for k, *_ in ALL)} Rezepte für Training, Alltag und Meal-Prep')
    half = (len(ALL) + 1) // 2
    for i, (key, name, txt) in enumerate(ALL):
        x = M + (0 if i < half else (W - 2 * M) / 2 + 2 * mm); y = H - 142 * mm - (i % half) * 13 * mm
        c.setFillColor(BLAU); c.roundRect(x, y - 1.5 * mm, 2.6 * mm, 8.5 * mm, 1 * mm, fill=1, stroke=0)
        c.setFillColor(WEISS); c.setFont('A-Bold', 12.5); c.drawString(x + 6 * mm, y + 2.5 * mm, name.replace('&amp;', '&'))
        c.setFillColor(GRAU_D); c.setFont('A-Regular', 8.8); c.drawString(x + 6 * mm, y - 2 * mm, COVER_TXT.get(key, txt))
    c.setFillColor(GRAU_D); c.setFont('A-Regular', 9.5)
    c.drawString(M, 20 * mm, f'{len(ALL)} Kapitel · Nährwerte pro Portion berechnet')
    c.restoreState()

def page_divider(c, doc):
    page_dark(c, doc)
    c.saveState(); draw_logo(c, M, H - 22 * mm, 7 * mm)
    c.setFont('A-Regular', 8); c.setFillColor(GRAU_D); c.drawRightString(W - M, 7.5 * mm, str(doc.page))
    c.restoreState()

def page_light(c, doc):
    c.saveState()
    lw = draw_logo(c, M, H - 15 * mm, 5.5 * mm)
    c.setStrokeColor(LINIE); c.setLineWidth(0.6); c.line(M, 12 * mm, W - M, 12 * mm)
    c.setFont('A-Regular', 8); c.setFillColor(GRAU)
    c.drawString(M, 7.5 * mm, 'Alpha5 Rezeptbuch'); c.drawRightString(W - M, 7.5 * mm, str(doc.page))
    c.restoreState()

class Anchor(Flowable):
    """Unsichtbar: merkt Seitenzahl und setzt Kopfzeilen-Status."""
    def __init__(self, key=None, group=None, meal=None):
        super().__init__(); self.key, self.group, self.meal = key, group, meal
    def wrap(self, *a): return (0, 0)
    def draw(self):
        if self.group is not None: STATE['group'] = self.group
        if self.meal is not None: STATE['meal'] = self.meal
        if self.key:
            PAGES[self.key] = self.canv.getPageNumber()
            self.canv.bookmarkPage(self.key)

class Box(Flowable):
    def __init__(self, w, h, color): super().__init__(); self.w, self.h, self.color = w, h, color
    def wrap(self, *a): return (self.w, self.h)
    def draw(self):
        self.canv.setStrokeColor(self.color); self.canv.setLineWidth(0.9)
        self.canv.roundRect(0, 0, self.w, self.h, 1.2, stroke=1, fill=0)

PAGES = {}
PREV_PAGES = {}

def fmt_menge(g):
    if g >= 1000: return de(g / 1000, 2 if g % 100 else 1).rstrip('0').rstrip(',') + ' kg'
    return f'{round(g)} g'

def tile(label, value, unit):
    return Paragraph(f'<font name="A-Black" size="15" color="#0a0c10">{value}</font>'
                     f'<font name="A-SemiBold" size="8.5" color="#586173"> {unit}</font><br/>'
                     f'<font name="A-Regular" size="8" color="#586173">{label}</font>', st('tl', leading=16))

def recipe_page(key, gname, r, ing):
    s = []
    tags = ''.join(f'<font name="A-SemiBold" size="8.5" color="#1747cc">  ·  {t.upper()}</font>' for t in r.get('tags', []))
    diet = f'<font name="A-Bold" size="9" color="#0a0c10">{diet_of(r).upper()}  ·  </font>' if 'passt_fuer' in r else ''
    por = f'<font name="A-Bold" size="9" color="#0a0c10">  ·  {r["portionen"]} PORTIONEN</font>' if r.get('portionen', 1) > 1 else ''
    s.append(Paragraph(f'{diet}<font name="A-Bold" size="9" color="#1f5bff">{r["mahlzeit"].upper()}</font>{por}{tags}', st('k', leading=12)))
    s.append(Spacer(0, 2 * mm))
    s.append(Paragraph(r['name'], H_TITLE))
    s.append(Spacer(0, 2.5 * mm))
    s.append(Paragraph(r['beschreibung'], H_DESC))
    s.append(Spacer(0, 5 * mm))
    m = r['m']
    pp = ' / Portion' if r.get('portionen', 1) > 1 else ''
    row = [tile('Aktive Zeit' if pp else 'Zubereitung', r['zeit_min'], 'Min.'), tile('Energie' + pp, round(m['kcal']), 'kcal'),
           tile('Eiweiß' + pp, round(m['p']), 'g'), tile('Kohlenhydrate', round(m['c']), 'g'), tile('Fett', round(m['f']), 'g')]
    if 'kosten_eur' in r: row.append(tile('Kosten ca.', de(r['kosten_eur'], 2), '€'))
    tiles = [row]
    tw = (W - 2 * M) / len(row)
    t = Table(tiles, colWidths=[tw] * len(row), rowHeights=[16 * mm])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), HELL), ('LINEBEFORE', (1, 0), (-1, 0), 0.6, LINIE),
                           ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 4 * mm),
                           ('BACKGROUND', (2, 0), (2, 0), EIS)]))
    s.append(t)
    s.append(Spacer(0, 7 * mm))

    # linke Spalte: Einkaufsliste mit Kästchen
    lw = 82 * mm; rw = W - 2 * M - lw - 8 * mm
    rows = []
    for z in r['zutaten']:
        rows.append([Box(3.6 * mm, 3.6 * mm, BLAU), Paragraph(z['name'], P_ING),
                     Paragraph(f'<font color="#586173">{z["anzeige"]}</font>', st('a', fontSize=10.5, leading=14, alignment=2))])
    it = Table(rows, colWidths=[7 * mm, lw - 7 * mm - 34 * mm, 34 * mm])
    it.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), 0.5, LINIE),
                            ('TOPPADDING', (0, 0), (-1, -1), 2.6), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.4),
                            ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                            ('TOPPADDING', (0, 0), (0, -1), 5)]))
    head = f'Zutaten für {r["portionen"]} Portionen' if r.get('portionen', 1) > 1 else 'Einkaufen &amp; Zutaten'
    left = [Paragraph(head, H_SEC), Spacer(0, 2.5 * mm), it]

    steps = []
    for i, txt in enumerate(r['zubereitung'], 1):
        steps.append([Paragraph(f'<font name="A-Black" size="13" color="#1f5bff">{i}</font>', st('n', leading=15)),
                      Paragraph(txt, P_STEP)])
    stt = Table(steps, colWidths=[8 * mm, rw - 8 * mm])
    stt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
                             ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    right = [Paragraph('Zubereitung', H_SEC), Spacer(0, 2.5 * mm), stt]
    if r.get('tipp'):
        tip = Table([[Paragraph(f'<font name="A-Bold" color="#1747cc">Tipp: </font>{r["tipp"]}', P_TIP)]], colWidths=[rw])
        tip.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), EIS), ('LEFTPADDING', (0, 0), (-1, -1), 4 * mm),
                                 ('RIGHTPADDING', (0, 0), (-1, -1), 4 * mm), ('TOPPADDING', (0, 0), (-1, -1), 3 * mm),
                                 ('BOTTOMPADDING', (0, 0), (-1, -1), 3.4 * mm), ('LINEBEFORE', (0, 0), (0, -1), 2.5, BLAU)]))
        right += [Spacer(0, 3 * mm), tip]
    body = Table([[KeepInFrame(lw, 185 * mm, left, mode='shrink'), '', KeepInFrame(rw, 185 * mm, right, mode='shrink')]],
                 colWidths=[lw, 8 * mm, rw])
    body.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                              ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    s.append(body)
    return [Anchor(r['anchor'], gname, r['mahlzeit']), KeepInFrame(W - 2 * M, H - 14 * mm - 12 * mm - 18 * mm, s, mode='shrink')]

def divider(key, gname, gtxt, recs):
    s = [Anchor(f'div-{key}', gname, ''), Spacer(0, 26 * mm)]
    s.append(Paragraph(gname, st('dv', fontName='A-Black', fontSize=40, leading=42, textColor=WEISS)))
    s.append(Spacer(0, 4 * mm))
    s.append(Paragraph(gtxt, st('dvt', fontSize=12, leading=16, textColor=GRAU_D)))
    s.append(Spacer(0, 10 * mm))
    for meal in MEALS:
        s.append(Paragraph(MEAL_PL[meal].upper(), st('ml', fontName='A-Bold', fontSize=9, leading=12, textColor=HIMMEL)))
        s.append(Spacer(0, 1.5 * mm))
        rows = []
        for r in [x for x in recs if x['mahlzeit'] == meal]:
            pg = PREV_PAGES.get(r['anchor'], '')
            rows.append([Paragraph(f'<a href="#{r["anchor"]}" color="#ffffff">{r["name"]}</a>', st('dn', textColor=WEISS, fontSize=10, leading=13)),
                         Paragraph(f'{round(r["m"]["kcal"])} kcal · {round(r["m"]["p"])} g Eiweiß', st('dk', textColor=GRAU_D, fontSize=9, leading=13)),
                         Paragraph(f'<a href="#{r["anchor"]}" color="#8db0ff">S. {pg}</a>', st('dp', fontName='A-SemiBold', textColor=HIMMEL, fontSize=9, leading=13, alignment=2))])
        t = Table(rows, colWidths=[100 * mm, 52 * mm, W - 2 * M - 152 * mm])
        t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.5, GRAPHIT_H), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                               ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 1.6),
                               ('BOTTOMPADDING', (0, 0), (-1, -1), 2.4), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
        s += [t, Spacer(0, 4 * mm)]
    sl = PREV_PAGES.get(f'shop-{key}', '')
    s.append(Paragraph(f'<a href="#shop-{key}" color="#8db0ff">Gesamt-Einkaufsliste für alle {len(recs)} Rezepte: S. {sl}</a>',
                       st('sl', fontName='A-SemiBold', fontSize=10, textColor=HIMMEL)))
    return s

def divider_schnell(key, gname, gtxt, recs):
    s = [Anchor(f'div-{key}', gname, ''), Spacer(0, 26 * mm)]
    s.append(Paragraph(gname, st('dv', fontName='A-Black', fontSize=40, leading=42, textColor=WEISS)))
    s.append(Spacer(0, 4 * mm))
    extra = ' Ohne Ofen, ohne Wartezeit, mit cleveren Zutaten aus dem Supermarkt wie Express-Reis, Bohnen aus der Dose oder Aufschnitt.' if key == 'schnell' else ''
    s.append(Paragraph(gtxt + extra, st('dvt', fontSize=12, leading=16, textColor=GRAU_D)))
    if key in FAUST:
        s.append(Spacer(0, 5 * mm))
        ft = Table([[Paragraph(FAUST[key], st('fs', fontSize=10.5, leading=15, textColor=WEISS))]], colWidths=[W - 2 * M])
        ft.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), GRAPHIT), ('LINEBEFORE', (0, 0), (0, -1), 2.5, BLAU),
                                ('LEFTPADDING', (0, 0), (-1, -1), 4 * mm), ('RIGHTPADDING', (0, 0), (-1, -1), 4 * mm),
                                ('TOPPADDING', (0, 0), (-1, -1), 3 * mm), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.4 * mm)]))
        s.append(ft)
    s.append(Spacer(0, 10 * mm))
    for meal in data[key]['sections']:
        s.append(Paragraph(MEAL_PL.get(meal, meal).upper(), st('ml', fontName='A-Bold', fontSize=9, leading=12, textColor=HIMMEL)))
        s.append(Spacer(0, 1.5 * mm))
        rows = []
        for r in [x for x in recs if x.get('sec', x['mahlzeit']) == meal]:
            pg = PREV_PAGES.get(r['anchor'], '')
            rows.append([Paragraph(f'<a href="#{r["anchor"]}" color="#ffffff">{r["name"]}</a>', st('dn', textColor=WEISS, fontSize=10, leading=13)),
                         Paragraph(f'{r["mahlzeit"]} · {round(r["m"]["kcal"])} kcal' if key == 'mealprep' else f'{diet_of(r)} · {de(r["kosten_eur"], 2)} €' if key == 'budget' else f'{diet_of(r)} · {r["zeit_min"]} Min.' if key == 'schnell' else f'{diet_of(r)} · {round(r["m"]["kcal"])} kcal', st('dk', textColor=GRAU_D, fontSize=9, leading=13)),
                         Paragraph(f'<a href="#{r["anchor"]}" color="#8db0ff">S. {pg}</a>', st('dp', fontName='A-SemiBold', textColor=HIMMEL, fontSize=9, leading=13, alignment=2))])
        t = Table(rows, colWidths=[100 * mm, 52 * mm, W - 2 * M - 152 * mm])
        t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.5, GRAPHIT_H), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                               ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 1.6),
                               ('BOTTOMPADDING', (0, 0), (-1, -1), 2.4), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
        s += [t, Spacer(0, 4 * mm)]
    n_more = sum(1 for k, *_ in GROUPS for r in data[k]['recipes'] if r['zeit_min'] <= 10)
    if key == 'schnell': s.append(Paragraph(f'<a href="#mehr-schnell" color="#8db0ff">Noch {n_more} weitere Rezepte unter 10 Minuten aus den anderen Kapiteln: S. {PREV_PAGES.get("mehr-schnell", "")}</a>',
                       st('sl', fontName='A-SemiBold', fontSize=10, textColor=HIMMEL)))
    s.append(Spacer(0, 2 * mm))
    if key in GUIDES:
        s.append(Paragraph(f'<a href="#guide-{key}" color="#8db0ff">{GUIDES[key][2]}: S. {PREV_PAGES.get("guide-"+key, "")}</a>', st('sl3', fontName='A-SemiBold', fontSize=10, textColor=HIMMEL)))
        s.append(Spacer(0, 2 * mm))
    if key != 'mealprep': s.append(Paragraph(f'<a href="#shop-{key}" color="#8db0ff">Einkaufsliste für alle {len(recs)} Rezepte dieses Kapitels: S. {PREV_PAGES.get("shop-"+key, "")}</a>',
                       st('sl2', fontName='A-SemiBold', fontSize=10, textColor=HIMMEL)))
    return s

def mehr_schnell():
    s = [Anchor('mehr-schnell', SCHNELL[1], 'Weitere schnelle Rezepte')]
    s.append(Paragraph('Noch mehr unter 10 Minuten', st('ms', fontName='A-Black', fontSize=24, leading=27)))
    s.append(Spacer(0, 2 * mm))
    s.append(Paragraph('Diese Rezepte aus den anderen Kapiteln sind ebenfalls in höchstens 10 Minuten fertig. Tippe auf einen Namen, um zum Rezept zu springen.', H_DESC))
    s.append(Spacer(0, 5 * mm))
    s.append(FrameBreak()); s.append(NextPageTemplate('shop'))
    colw = (W - 2 * M - 8 * mm) / 2
    for key, gname, _ in GROUPS:
        recs = [r for r in data[key]['recipes'] if r['zeit_min'] <= 10]
        rows = [[Paragraph(gname, H_SEC), '']]
        for r in recs:
            rows.append([Paragraph(f'<a href="#{r["anchor"]}" color="#0a0c10">{r["name"]}</a><br/><font size="8.5" color="#586173">{r["mahlzeit"]} · {r["zeit_min"]} Min. · {round(r["m"]["kcal"])} kcal</font>', st('mr', fontSize=10.5, leading=13.5)),
                         Paragraph(f'<a href="#{r["anchor"]}" color="#1f5bff">S. {PREV_PAGES.get(r["anchor"], "")}</a>', st('mp', fontName='A-SemiBold', fontSize=9.5, leading=13, alignment=2, textColor=BLAU))])
        t = Table(rows, colWidths=[colw - 14 * mm, 14 * mm], repeatRows=1)
        t.setStyle(TableStyle([('SPAN', (0, 0), (-1, 0)), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 1), (-1, -1), 0.5, LINIE),
                               ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                               ('TOPPADDING', (0, 0), (-1, -1), 2.6), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.4)]))
        s += [t, Spacer(0, 6 * mm)]
    return s

def shopping(key, gname, d, note=None):
    tot = OrderedDict(); used = defaultdict(int)
    for r in d['recipes']:
        for z in r['zutaten']:
            if z['name'].lower() == 'wasser': continue
            tot[z['name']] = tot.get(z['name'], 0) + z['menge_g']; used[z['name']] += 1
    by = defaultdict(list)
    for n, g in tot.items(): by[d['ingredients'][n]['abteilung']].append((n, g))
    s = [Anchor(f'shop-{key}', gname, 'Einkaufsliste')]
    s.append(Paragraph('Gesamt-Einkaufsliste', st('sh', fontName='A-Black', fontSize=24, leading=27)))
    s.append(Spacer(0, 2 * mm))
    s.append(Paragraph(note or (f'{gname}: alle {len(d["recipes"])} Rezepte je 1 Portion. Die Mengen sind die Summe aller Rezepte. '
                       'Für einzelne Rezepte nutzt du die Liste auf der Rezeptseite. „Vorrat“ heißt: kleine Menge, '
                       'die du meist schon im Schrank hast.'), H_DESC))
    s.append(Spacer(0, 5 * mm))
    s.append(FrameBreak())
    s.append(NextPageTemplate('shop'))
    colw = (W - 2 * M - 8 * mm) / 2
    for dep in DEPT_ORDER:
        if dep not in by: continue
        items = sorted(by[dep], key=lambda x: x[0].lower())
        rows = [[Paragraph(dep, H_SEC), '', '']]
        for n, g in items:
            amount = 'Vorrat' if g < 5 else fmt_menge(g)
            rows.append([Box(3.4 * mm, 3.4 * mm, BLAU), Paragraph(f'{n} <font color="#586173" size="8.5">({used[n]}×)</font>', st('si', fontSize=10.5, leading=13.5)),
                         Paragraph(f'<font color="#586173">{amount}</font>', st('am', fontSize=10, leading=13.5, alignment=2))])
        t = Table(rows, colWidths=[6.5 * mm, colw - 6.5 * mm - 20 * mm, 20 * mm], repeatRows=1)
        t.setStyle(TableStyle([('SPAN', (0, 0), (-1, 0)), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                               ('LINEBELOW', (0, 1), (-1, -1), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                               ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 2.6),
                               ('BOTTOMPADDING', (0, 0), (-1, -1), 3.2), ('TOPPADDING', (0, 1), (0, -1), 4.4),
                               ('BOTTOMPADDING', (0, 0), (-1, 0), 4)]))
        s += [t, Spacer(0, 6 * mm)]
    return s

def box(text, w=None, bg=None, line=None, style=None):
    t = Table([[Paragraph(text, style or P_TIP)]], colWidths=[w or (W - 2 * M)])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), bg or EIS), ('LEFTPADDING', (0, 0), (-1, -1), 4 * mm),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 4 * mm), ('TOPPADDING', (0, 0), (-1, -1), 3 * mm),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 3.4 * mm), ('LINEBEFORE', (0, 0), (0, -1), 2.5, line or BLAU)]))
    return t

def plan_page(gname, pl, recs):
    s = [Paragraph(f'<font name="A-Bold" size="9" color="#0a0c10">{DIET_LABEL[pl["plan"]].upper()}  ·  </font><font name="A-Bold" size="9" color="#1f5bff">MEAL-PREP-WOCHENPLAN</font>', st('k', leading=12)),
         Spacer(0, 2 * mm), Paragraph(pl['titel'], H_TITLE), Spacer(0, 2.5 * mm), Paragraph(pl['beschreibung'], H_DESC), Spacer(0, 5 * mm)]
    rows = [[Paragraph(f'<font name="A-Bold" color="#1f5bff">{r["mahlzeit"]}</font>', P_ING),
             Paragraph(f'<a href="#{r["anchor"]}" color="#0a0c10">{r["name"]}</a>', st('pn', fontName='A-SemiBold', fontSize=11, leading=14.5)),
             Paragraph(f'{round(r["m"]["kcal"])} kcal · {round(r["m"]["p"])} g Eiweiß', st('pk', fontSize=9.5, leading=14.5, textColor=GRAU)),
             Paragraph(f'<a href="#{r["anchor"]}" color="#1f5bff">S. {PREV_PAGES.get(r["anchor"], "")}</a>', st('pp', fontName='A-SemiBold', alignment=2, textColor=BLAU, leading=14.5))] for r in recs]
    t = Table(rows, colWidths=[30 * mm, 88 * mm, 42 * mm, W - 2 * M - 160 * mm])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), HELL), ('LINEBELOW', (0, 0), (-1, -2), 0.6, LINIE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                           ('LEFTPADDING', (0, 0), (-1, -1), 3 * mm), ('TOPPADDING', (0, 0), (-1, -1), 2.4 * mm), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.6 * mm)]))
    s += [Paragraph('Montag bis Freitag', H_SEC), Spacer(0, 2 * mm), t, Spacer(0, 6 * mm)]
    rows = [[Paragraph(f'<font name="A-Black" size="11" color="#1f5bff">{k["min"]}</font><font size="8" color="#586173"> Min.</font>', st('km', leading=14.5)),
             Paragraph(k['schritt'], st('ks', fontSize=10.5, leading=14.5))] for k in pl['kochtag']]
    kt = Table(rows, colWidths=[18 * mm, W - 2 * M - 18 * mm])
    kt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -2), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                            ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 2.4), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    s += [Paragraph('Ablauf am Kochtag', H_SEC), Spacer(0, 2 * mm), kt, Spacer(0, 6 * mm)]
    s += [Paragraph('Aufbewahrung', H_SEC), Spacer(0, 2 * mm)]
    s += [Paragraph('·  ' + a, st('au', fontSize=10.5, leading=15)) for a in pl['aufbewahrung']]
    s += [Spacer(0, 5 * mm), box(f'<font name="A-Bold" color="#1747cc">Abends: </font>{pl["abendessen_hinweis"]} '
                                  f'<a href="#shop-mealprep-{pl["plan"]}" color="#1f5bff">Einkaufsliste für diesen Plan: S. {PREV_PAGES.get("shop-mealprep-" + pl["plan"], "")}</a>')]
    return [Anchor(f'plan-{pl["plan"]}', gname, pl['titel']), KeepInFrame(W - 2 * M, H - 14 * mm - 12 * mm - 18 * mm, s, mode='shrink')]

def guide_page(key, gname, title, intro_txt, items):
    s = [Anchor(f'guide-{key}', gname, 'Ratgeber'), Paragraph(title, st('gt', fontName='A-Black', fontSize=24, leading=27)), Spacer(0, 2 * mm)]
    if intro_txt: s += [Paragraph(intro_txt, H_DESC)]
    s.append(Spacer(0, 5 * mm))
    rows = [[Paragraph(f'<font name="A-Black" size="16" color="#1f5bff">{i}</font>', st('x', leading=18)),
             [Paragraph(it['titel'], st('gh', fontName='A-Bold', fontSize=12, leading=15)), Spacer(0, 1 * mm), Paragraph(it['text'], st('gx', fontSize=11, leading=15.5, textColor=GRAU))]]
            for i, it in enumerate(items, 1)]
    t = Table(rows, colWidths=[12 * mm, W - 2 * M - 12 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('LINEBELOW', (0, 0), (-1, -2), 0.5, LINIE), ('TOPPADDING', (0, 0), (-1, -1), 6)]))
    s.append(t)
    return s

def unterwegs_chapter():
    U = UNTERWEGS; key, gname, gtxt = UNTERWEGS_CH
    s = [Anchor(f'div-{key}', gname, ''), Spacer(0, 26 * mm),
         Paragraph(gname, st('dv', fontName='A-Black', fontSize=40, leading=42, textColor=WEISS)), Spacer(0, 4 * mm),
         Paragraph(U['einleitung'], st('dvt', fontSize=12, leading=16, textColor=GRAU_D)), Spacer(0, 9 * mm),
         Paragraph('GRUNDREGELN', st('ml', fontName='A-Bold', fontSize=9, leading=12, textColor=HIMMEL)), Spacer(0, 2 * mm)]
    rows = [[Paragraph(f'<font name="A-Black" size="13" color="#1f5bff">{i}</font>', st('n', leading=15)), Paragraph(g, st('gr', fontSize=11, leading=15, textColor=WEISS))]
            for i, g in enumerate(U['grundregeln'], 1)]
    t = Table(rows, colWidths=[9 * mm, W - 2 * M - 9 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -2), 0.5, GRAPHIT_H), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5)]))
    s += [t, Spacer(0, 8 * mm), Paragraph('ORTE', st('ml', fontName='A-Bold', fontSize=9, leading=12, textColor=HIMMEL)), Spacer(0, 2 * mm)]
    rows = []
    for i, o in enumerate(U['orte']):
        rows.append([Paragraph(f'<a href="#ort-{i}" color="#ffffff">{o["ort"]}</a>', st('dn', textColor=WEISS, fontSize=10, leading=13)),
                     Paragraph(f'<a href="#ort-{i}" color="#8db0ff">S. {PREV_PAGES.get(f"ort-{i}", "")}</a>', st('dp', fontName='A-SemiBold', textColor=HIMMEL, fontSize=9, leading=13, alignment=2))])
    t = Table(rows, colWidths=[W - 2 * M - 20 * mm, 20 * mm])
    t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.5, GRAPHIT_H), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 1.6), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.4)]))
    s.append(t)
    return s

def ort_block(i, o):
    cw = (W - 2 * M - 8 * mm) / 2
    def col(title, items, color):
        out = [Paragraph(title, st('oc', fontName='A-Bold', fontSize=11.5, leading=15, textColor=color)), Spacer(0, 1.5 * mm)]
        out += [Paragraph(f'<font name="A-Black" color="{color.hexval().replace("0x", "#")}">•</font>  {x}', st('oi', fontSize=10.5, leading=14.5, leftIndent=4 * mm, firstLineIndent=-4 * mm, spaceAfter=3)) for x in items]
        return out
    g = Table([[col('Gute Wahl', o['gut'], BLAU), '', col('Lieber seltener', o['lieber_seltener'], GRAU)]], colWidths=[cw, 8 * mm, cw])
    g.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    return KeepTogether([Anchor(f'ort-{i}', UNTERWEGS_CH[1], 'Ratgeber'), Paragraph(o['ort'], st('ot', fontName='A-Black', fontSize=20, leading=23)), Spacer(0, 3 * mm), g,
                         Spacer(0, 3 * mm), box(f'<font name="A-Bold" color="#1747cc">Trick: </font>{o["trick"]}'), Spacer(0, 9 * mm)])

def intro():
    s = [Spacer(0, 6 * mm), Paragraph('So nutzt du dieses Buch', st('in', fontName='A-Black', fontSize=24, leading=27)), Spacer(0, 5 * mm)]
    pts = INTRO_POINTS = [
        ('Fertig in 10 Minuten', 'Wenig Zeit? Das erste Kapitel sammelt 10 Rezepte, die in höchstens 10 Minuten auf dem Teller sind, für alle Ernährungsformen. Auch in den anderen Kapiteln sind schnelle Rezepte mit „Unter 10 Minuten“ markiert.'),
        ('Rund ums Training', 'Drei Kapitel mit kleinen Mahlzeiten: Pre-Workout für Energie vor dem Training, Post-Workout für die Erholung danach und Cardio &amp; Ausdauer für lange Lauf-, Rad- oder Schwimmeinheiten. Bei jedem Rezept steht, für welche Ernährungsform es passt.'),
        ('Weitere Themen-Kapitel', 'Wettkampftag, vier Meal-Prep-Wochenpläne mit Kochtag-Ablauf, Fitness-Fast-Food, Rezepte für die Heißluftfritteuse, Protein-Desserts, Sommer-Eis aus der Eismaschine und günstige Rezepte unter 2 € pro Portion. Am Ende helfen der Ratgeber „Unterwegs essen“ und das Zutatenlexikon mit 59 Grundnahrungsmitteln.'),
        ('Vier Ernährungsformen', 'Vegan, vegetarisch, mit Fleisch und ohne Schweinefleisch. Jede Form hat ihr eigenes Kapitel mit je 10 Rezepten für Frühstück, Mittagessen, Abendessen und Snacks.'),
        ('Alle Mengen für 1 Portion', 'Kochst du für zwei oder für die Woche vor, nimmst du die Mengen einfach mal 2 oder mal die Anzahl der Tage. In der App passt Alpha5 die Portion später automatisch an dein Ziel an.'),
        ('Einkaufen leicht gemacht', 'Auf jeder Rezeptseite steht links die Einkaufsliste zum Abhaken. Am Ende jedes Kapitels findest du eine Gesamt-Einkaufsliste, sortiert nach den Bereichen im Supermarkt.'),
        ('Nährwerte', 'Kalorien, Eiweiß, Kohlenhydrate und Fett sind aus den Zutatenmengen berechnet. Sie sind Richtwerte, denn Produkte und Marken unterscheiden sich.'),
        ('Markierungen', '„Vor dem Training“ heißt: leicht verdauliche Kohlenhydrate. „Nach dem Training“ heißt: viel Eiweiß zur Erholung. „Meal-Prep“ heißt: hält sich 2 bis 3 Tage im Kühlschrank.'),
        ('Proteinpulver', 'Einige Rezepte nutzen Proteinpulver (Whey, Casein oder vegan) für Pancakes, Shakes, Pudding und Snacks. Ein Messlöffel sind etwa 25 bis 30 g. Im Tipp steht meist, wie es auch ohne Pulver geht, etwa mit mehr Quark oder Skyr.'),
        ('Hinweis', 'Bei Allergien, Unverträglichkeiten oder Vorerkrankungen prüfe die Zutaten selbst und sprich bei Bedarf mit deinem Arzt oder einer Ernährungsfachkraft.'),
    ]
    rows = [[Paragraph(f'<font name="A-Black" size="16" color="#1f5bff">{i}</font>', st('x', leading=18)),
             [Paragraph(h, st('ih', fontName='A-Bold', fontSize=12, leading=15)), Spacer(0, 1 * mm), Paragraph(t, st('it', fontSize=10, leading=14, textColor=GRAU))]]
            for i, (h, t) in enumerate(pts, 1)]
    t = Table(rows, colWidths=[12 * mm, W - 2 * M - 12 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 6), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('LINEBELOW', (0, 0), (-1, -2), 0.5, LINIE), ('TOPPADDING', (0, 0), (-1, -1), 5)]))
    s.append(t); s.append(Spacer(0, 5 * mm))
    s.append(Paragraph('Kapitel', H_SEC)); s.append(Spacer(0, 2 * mm))
    cells = [[Paragraph(f'<a href="#div-{k}" color="#0a0c10">{n}</a>', st('kn', fontName='A-Bold', fontSize=10.5)),
              Paragraph(f'<a href="#div-{k}" color="#1f5bff">S. {PREV_PAGES.get("div-"+k, "")}</a>', st('kp', fontName='A-SemiBold', alignment=2, textColor=BLAU))]
             for k, n, _ in ALL]
    half = (len(cells) + 1) // 2
    rows = [cells[i] + [''] + (cells[i + half] if i + half < len(cells) else ['', '']) for i in range(half)]
    cw = (W - 2 * M - 10 * mm) / 2
    t = Table(rows, colWidths=[cw - 18 * mm, 18 * mm, 10 * mm, cw - 18 * mm, 18 * mm])
    t.setStyle(TableStyle([('LINEBELOW', (0, 0), (1, -1), 0.5, LINIE), ('LINEBELOW', (3, 0), (4, -1), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    s.append(t)
    return s

def build():
    STATE.update(group='', meal='')
    doc = BaseDocTemplate(OUT, pagesize=A4, title='Alpha5 Rezeptbuch', author='Alpha5',
                          subject='Fitness-Rezepte: vegan, vegetarisch, mit Fleisch, ohne Schweinefleisch',
                          leftMargin=M, rightMargin=M)
    full = Frame(M, 16 * mm, W - 2 * M, H - 16 * mm - 26 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    rec = Frame(M, 16 * mm, W - 2 * M, H - 14 * mm - 12 * mm - 16 * mm, id='r', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate('cover', [full], onPage=page_cover), PageTemplate('light', [full], onPageEnd=page_light),
                          PageTemplate('divider', [full], onPageEnd=page_divider), PageTemplate('recipe', [rec], onPageEnd=page_recipe),
                          PageTemplate('shophead', [Frame(M, H - 26 * mm - 34 * mm, W - 2 * M, 34 * mm, id='sh', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0), Frame(M, 16 * mm, (W - 2 * M - 8 * mm) / 2, H - 26 * mm - 34 * mm - 16 * mm, id='c1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0), Frame(M + (W - 2 * M + 8 * mm) / 2, 16 * mm, (W - 2 * M - 8 * mm) / 2, H - 26 * mm - 34 * mm - 16 * mm, id='c2', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPageEnd=page_recipe),
                          PageTemplate('shop', [Frame(M, 16 * mm, (W - 2 * M - 8 * mm) / 2, H - 26 * mm - 16 * mm, id='c3', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0), Frame(M + (W - 2 * M + 8 * mm) / 2, 16 * mm, (W - 2 * M - 8 * mm) / 2, H - 26 * mm - 16 * mm, id='c4', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPageEnd=page_recipe)])
    if LEX_PAGE: doc.addPageTemplates([PageTemplate('lex', [Frame(M, 16 * mm, W - 2 * M, H - 14 * mm - 12 * mm - 16 * mm, id='lx', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPageEnd=LEX_PAGE)])
    story = [Spacer(0, 1), NextPageTemplate('light'), PageBreak(), ] + (INTRO_PAGES() if INTRO_PAGES else [KeepInFrame(W - 2 * M, H - 16 * mm - 26 * mm - 2 * mm, intro(), mode='shrink')])
    for key, gname, gtxt in ALL:
        if key == 'lexikon':
            if LEX_HOOK: story += LEX_HOOK()
            continue
        if key == 'unterwegs':
            story += [NextPageTemplate('divider'), PageBreak()] + unterwegs_chapter()
            story += [NextPageTemplate('recipe'), PageBreak()] + [ort_block(i, o) for i, o in enumerate(UNTERWEGS['orte'])]
            continue
        d = data[key]
        if key == 'mealprep':
            story += [NextPageTemplate('divider'), PageBreak()] + divider_schnell(key, gname, gtxt, d['recipes'])
            for pl in d['plans']:
                recs = [r for r in d['recipes'] if r['plan'] == pl['plan']]
                story += [NextPageTemplate('recipe'), PageBreak()] + plan_page(gname, pl, recs)
                for r in recs:
                    story += [NextPageTemplate('recipe'), PageBreak()] + recipe_page(key, gname, r, d['ingredients'])
                story += [NextPageTemplate('shophead'), PageBreak()] + shopping(f'mealprep-{pl["plan"]}', pl['titel'], {'recipes': recs, 'ingredients': d['ingredients']},
                          note=f'{pl["titel"]}: Einkauf für den Kochtag: alle 3 Rezepte mit je 5 Portionen, also Frühstück, Mittagessen und Snack für Montag bis Freitag. „Vorrat“ heißt: kleine Menge, die du meist schon im Schrank hast.')
            continue
        dv = divider_schnell if key in SPECIAL else divider
        story += [NextPageTemplate('divider'), PageBreak()] + dv(key, gname, gtxt, d['recipes'])
        if key in GUIDES:
            story += [NextPageTemplate('recipe'), PageBreak()] + guide_page(key, gname, GUIDES[key][0], GUIDES[key][1], d['leitfaden'])
        for r in d['recipes']:
            story += [NextPageTemplate('recipe'), PageBreak()] + recipe_page(key, gname, r, d['ingredients'])
        if key == 'schnell':
            story += [NextPageTemplate('shophead'), PageBreak()] + mehr_schnell()
        story += [NextPageTemplate('shophead'), PageBreak()] + shopping(key, gname, d)
    doc.build(story)

if __name__ == '__main__':
    build(); PREV_PAGES.update(PAGES); PAGES.clear(); build()
    assert PAGES == PREV_PAGES, 'Seitenzahlen nicht stabil'
    print('ok', OUT, len(PAGES))
