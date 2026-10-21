import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pdf as b
from build_pdf import *  # noqa

LEX = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/daten/lexikon'
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/ausgabe/Alpha5-Zutatenlexikon.pdf'
SIGNAL_C = colors.HexColor('#ffb020')

PARTS = ['teil-kohlenhydrate.json', 'teil-huelsen-nuesse.json', 'teil-eiweiss-fette.json']
ENTRIES = []
for p in PARTS:
    ENTRIES += json.load(open(f'{LEX}/{p}'))['eintraege']
CATS = []
for e in ENTRIES:
    if e['kategorie'] not in CATS: CATS.append(e['kategorie'])
CAT_TXT = {
    'Kartoffeln & Knollen': 'Sättigende Stärkelieferanten mit wenig Fett und vielen Mineralstoffen – unterschätzt in der Fitness-Küche.',
    'Reis': 'Leicht verdauliche Kohlenhydrate, ideal rund ums Training. Vollkornreis bringt mehr Ballaststoffe, weißer Reis ist schneller verfügbar.',
    'Getreide': 'Die Basis vieler Mahlzeiten: Kohlenhydrate für Energie, je nach Ausmahlung mit mehr oder weniger Ballaststoffen und Mineralstoffen.',
    'Pseudogetreide': 'Samen, die wie Getreide verwendet werden, aber von Natur aus glutenfrei sind – mit vergleichsweise viel Eiweiß.',
    'Hülsenfrüchte': 'Die wichtigsten pflanzlichen Eiweißquellen: viel Eiweiß und Ballaststoffe, kombiniert mit Getreide besonders wertvoll.',
    'Nüsse': 'Energiedicht mit wertvollen Fetten, Vitamin E und Mineralstoffen. Eine Handvoll am Tag ist ein guter Richtwert.',
    'Saaten & Kerne': 'Kleine Mengen, große Wirkung: Ballaststoffe, ungesättigte Fettsäuren und Mineralstoffe zum Darüberstreuen.',
    'Eiweiß-Basics': 'Die Eiweißlieferanten für Muskelaufbau und Sättigung – tierisch und pflanzlich.',
    'Öle & Fette': 'Fette sind lebenswichtig. Entscheidend ist die Auswahl: welches Öl wofür und in welcher Menge.',
}
STATE = b.STATE

def page_lex(c, doc):
    c.saveState()
    c.setFillColor(SCHWARZ); c.rect(0, H - 14 * mm, W, 14 * mm, fill=1, stroke=0)
    lw = b.draw_logo(c, M, H - 9.6 * mm, 5 * mm)
    c.setFont('A-Bold', 9.5); c.setFillColor(WEISS); c.drawString(M + lw + 3 * mm, H - 8.6 * mm, 'Zutatenlexikon')
    c.setFont('A-SemiBold', 9); c.setFillColor(HIMMEL)
    c.drawRightString(W - M, H - 8.6 * mm, f"{STATE['group']}  ·  {STATE['meal']}".replace('&amp;', '&').strip(' ·'))
    c.setStrokeColor(LINIE); c.setLineWidth(0.6); c.line(M, 12 * mm, W - M, 12 * mm)
    c.setFont('A-Regular', 8); c.setFillColor(GRAU)
    c.drawString(M, 7.5 * mm, 'Alpha5 · Allgemeine Informationen, keine individuelle Ernährungs- oder Gesundheitsberatung.')
    c.drawRightString(W - M, 7.5 * mm, str(doc.page))
    c.restoreState()

def page_light_lex(c, doc):
    c.saveState()
    b.draw_logo(c, M, H - 15 * mm, 5.5 * mm)
    c.setStrokeColor(LINIE); c.setLineWidth(0.6); c.line(M, 12 * mm, W - M, 12 * mm)
    c.setFont('A-Regular', 8); c.setFillColor(GRAU)
    c.drawString(M, 7.5 * mm, 'Alpha5 Zutatenlexikon'); c.drawRightString(W - M, 7.5 * mm, str(doc.page))
    c.restoreState()

def cover(c, doc):
    b.page_dark(c, doc); c.saveState()
    b.draw_logo(c, M, H - 75 * mm, 30 * mm)
    c.setFillColor(WEISS); c.setFont('A-Black', 50); c.drawString(M, H - 112 * mm, 'Zutatenlexikon')
    c.setFillColor(HIMMEL); c.setFont('A-SemiBold', 15); c.drawString(M, H - 125 * mm, 'Die Basics der Fitness-Küche – was sie können und für wen sie passen')
    y = H - 150 * mm
    for i, cat in enumerate(CATS):
        n = sum(1 for e in ENTRIES if e['kategorie'] == cat)
        x = M + (0 if i < 5 else (W - 2 * M) / 2); yy = y - (i % 5) * 11 * mm
        c.setFillColor(BLAU); c.roundRect(x, yy - 1 * mm, 2.6 * mm, 6.5 * mm, 1 * mm, fill=1, stroke=0)
        c.setFillColor(WEISS); c.setFont('A-Bold', 12.5); c.drawString(x + 6 * mm, yy + 0.6 * mm, cat)
        c.setFillColor(GRAU_D); c.setFont('A-Regular', 9); c.drawString(x + 6 * mm + pdfmetrics.stringWidth(cat, 'A-Bold', 12.5) + 3 * mm, yy + 0.8 * mm, f'{n} Einträge')
    c.setFillColor(GRAU_D); c.setFont('A-Regular', 9.5)
    c.drawString(M, 20 * mm, f'{len(ENTRIES)} Grundnahrungsmittel · Nährwerte pro 100 g · allgemeine Informationen, keine Ernährungsberatung')
    c.restoreState()

def intro():
    s = [Spacer(0, 6 * mm), Paragraph('So liest du das Lexikon', st('in', fontName='A-Black', fontSize=24, leading=27)), Spacer(0, 5 * mm)]
    pts = [('Nährwerte pro 100 g', 'Oben auf jeder Seite stehen Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe pro 100 g. Wichtig ist der Bezug darunter: Reis, Nudeln und Hülsenfrüchte sind trocken angegeben, gegart wiegen sie etwa das Zwei- bis Dreifache.'),
           ('Eiweißqualität', 'Pflanzliches Eiweiß hat oft eine „begrenzende“ Aminosäure. Kombinierst du über den Tag Getreide mit Hülsenfrüchten, ergänzen sie sich gut. Tierische Eiweißquellen enthalten alle unentbehrlichen Aminosäuren in guten Anteilen.'),
           ('Gut geeignet und weniger geeignet', 'Hier steht, für welche Ziele und Situationen ein Lebensmittel besonders passt – und wann es weniger passt, zum Beispiel direkt vor dem Training, bei Unverträglichkeiten oder bestimmten Erkrankungen.'),
           ('Hinweise', 'Gelb markierte Kästen enthalten Sicherheits- oder Qualitätshinweise, zum Beispiel warum Hülsenfrüchte immer gegart werden müssen.'),
           ('Im Alpha5-Plan', 'Der blaue Kasten zeigt, wie du das Lebensmittel in deinem Plan einsetzt: vor oder nach dem Training, für Ausdauereinheiten oder zum Vorkochen.'),
           ('Wichtig', 'Das Lexikon gibt allgemeine Informationen. Bei Erkrankungen, Allergien, in Schwangerschaft und Stillzeit oder bei besonderen Ernährungsformen stimme deine Ernährung mit deinem Arzt oder einer Ernährungsfachkraft ab.')]
    rows = [[Paragraph(f'<font name="A-Black" size="16" color="#1f5bff">{i}</font>', st('x', leading=18)),
             [Paragraph(h, st('ih', fontName='A-Bold', fontSize=12, leading=15)), Spacer(0, 1 * mm), Paragraph(t, st('it', fontSize=10.5, leading=15, textColor=GRAU))]]
            for i, (h, t) in enumerate(pts, 1)]
    t = Table(rows, colWidths=[12 * mm, W - 2 * M - 12 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('LINEBELOW', (0, 0), (-1, -2), 0.5, LINIE), ('TOPPADDING', (0, 0), (-1, -1), 6)]))
    s += [t, Spacer(0, 6 * mm), Paragraph('Kategorien', H_SEC), Spacer(0, 2 * mm)]
    rows = [[Paragraph(f'<a href="#lexcat-{i}" color="#0a0c10">{c}</a>', st('kn', fontName='A-Bold', fontSize=11)),
             Paragraph(f'<a href="#lexcat-{i}" color="#1f5bff">S. {b.PREV_PAGES.get(f"lexcat-{i}", "")}</a>', st('kp', fontName='A-SemiBold', alignment=2, textColor=BLAU))]
            for i, c in enumerate(CATS)]
    t = Table(rows, colWidths=[W - 2 * M - 30 * mm, 30 * mm])
    t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    s.append(t)
    return [KeepInFrame(W - 2 * M, H - 16 * mm - 26 * mm - 2 * mm, s, mode='shrink')]

def num(v):
    return de(v, 0) if v >= 10 or float(v).is_integer() else de(v, 1)

def divider(i, cat):
    ents = [e for e in ENTRIES if e['kategorie'] == cat]
    s = [Anchor(f'lexcat-{i}', cat, ''), Spacer(0, 24 * mm),
         Paragraph(cat.replace('&', '&amp;'), st('dv', fontName='A-Black', fontSize=38, leading=40, textColor=WEISS)), Spacer(0, 4 * mm),
         Paragraph(CAT_TXT.get(cat, ''), st('dvt', fontSize=12, leading=16, textColor=GRAU_D)), Spacer(0, 9 * mm),
         Paragraph('IM VERGLEICH, PRO 100 G', st('ml', fontName='A-Bold', fontSize=9, leading=12, textColor=HIMMEL)), Spacer(0, 2 * mm)]
    hs = st('hh', fontName='A-SemiBold', fontSize=8.5, leading=11, textColor=GRAU_D, alignment=2)
    rows = [[Paragraph('', hs), Paragraph('kcal', hs), Paragraph('Eiweiß', hs), Paragraph('KH', hs), Paragraph('Fett', hs), Paragraph('Ballastst.', hs), Paragraph('', hs)]]
    cs = st('cv', fontSize=9.5, leading=13, textColor=GRAU_D, alignment=2)
    for e in ents:
        n = e['naehrwerte_100g']
        rows.append([Paragraph(f'<a href="#lex-{e["id"]}" color="#ffffff">{e["name"]}</a><br/><font size="8" color="#8db0ff">{e["bezug"]}</font>', st('dn', textColor=WEISS, fontSize=10.5, leading=13)),
                     Paragraph(num(n['kcal']), cs), Paragraph(num(n['eiweiss_g']) + ' g', cs), Paragraph(num(n['kohlenhydrate_g']) + ' g', cs),
                     Paragraph(num(n['fett_g']) + ' g', cs), Paragraph(num(n['ballaststoffe_g']) + ' g', cs),
                     Paragraph(f'<a href="#lex-{e["id"]}" color="#8db0ff">S. {b.PREV_PAGES.get("lex-" + e["id"], "")}</a>', st('dp', fontName='A-SemiBold', textColor=HIMMEL, fontSize=9, leading=13, alignment=2))])
    t = Table(rows, colWidths=[70 * mm, 16 * mm, 18 * mm, 18 * mm, 16 * mm, 22 * mm, W - 2 * M - 160 * mm])
    t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.5, GRAPHIT_H), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    s.append(KeepInFrame(W - 2 * M, H - 120 * mm, [t], mode='shrink'))
    return s

def bullets(items, color='#1f5bff', size=10.5):
    return [Paragraph(f'<font name="A-Black" color="{color}">•</font>  {x}', st('bl', fontSize=size, leading=size * 1.42, leftIndent=4 * mm, firstLineIndent=-4 * mm, spaceAfter=2.5)) for x in items]

def entry(e):
    n = e['naehrwerte_100g']
    s = [Paragraph(f'<font name="A-Bold" size="9" color="#1f5bff">{e["kategorie"].upper().replace("&", "&amp;")}</font>', st('k', leading=12)), Spacer(0, 2 * mm),
         Paragraph(e['name'], H_TITLE), Spacer(0, 2 * mm), Paragraph(e['kurz'], H_DESC), Spacer(0, 4 * mm)]
    row = [b.tile('Energie', num(n['kcal']), 'kcal'), b.tile('Eiweiß', num(n['eiweiss_g']), 'g'), b.tile('Kohlenhydrate', num(n['kohlenhydrate_g']), 'g'),
           b.tile('Fett', num(n['fett_g']), 'g'), b.tile('Ballaststoffe', num(n['ballaststoffe_g']), 'g')]
    tw = (W - 2 * M) / 5
    t = Table([row], colWidths=[tw] * 5, rowHeights=[15 * mm])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), HELL), ('LINEBEFORE', (1, 0), (-1, 0), 0.6, LINIE), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                           ('LEFTPADDING', (0, 0), (-1, -1), 4 * mm), ('BACKGROUND', (1, 0), (1, 0), EIS)]))
    s += [t, Spacer(0, 1.5 * mm), Paragraph(f'Pro 100 g, {e["bezug"]} · Übliche Portion: {e["portion"]}', P_SMALL), Spacer(0, 3.5 * mm)]
    chips = '<font color="#586173">, </font>'.join(f'<font name="A-SemiBold" color="#1747cc">{x}</font>' for x in e['naehrstoffe'])
    s += [Paragraph(f'<font name="A-Bold">Steckt drin:</font>  {chips}', st('ch', fontSize=10.5, leading=15)), Spacer(0, 3 * mm),
          Paragraph(f'<font name="A-Bold">Eiweißqualität:</font> {e["eiweissqualitaet"]}', st('eq', fontSize=10.5, leading=15, textColor=SCHWARZ)), Spacer(0, 5 * mm)]
    cw = (W - 2 * M - 8 * mm) / 2
    left = [Paragraph('Stärken', H_SEC), Spacer(0, 1.5 * mm)] + bullets(e['staerken']) + [Spacer(0, 3 * mm), Paragraph('Gut geeignet für', H_SEC), Spacer(0, 1.5 * mm)] + bullets(e['gut_fuer'])
    right = [Paragraph('Weniger geeignet', st('wg', fontName='A-Bold', fontSize=13, leading=16, textColor=GRAU)), Spacer(0, 1.5 * mm)] + bullets(e['weniger_geeignet'], '#586173') + \
            [Spacer(0, 3 * mm), Paragraph('Tipps', H_SEC), Spacer(0, 1.5 * mm)] + bullets(e['tipps']) + \
            [Spacer(0, 2 * mm), Paragraph(f'<font name="A-Bold">Lagerung:</font> {e["lagerung"]}', st('lg', fontSize=10, leading=14, textColor=GRAU))]
    g = Table([[left, '', right]], colWidths=[cw, 8 * mm, cw])
    g.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    s += [g, Spacer(0, 4 * mm)]
    if e.get('hinweis'):
        s += [b.box(f'<font name="A-Bold" color="#8a5a00">Hinweis: </font>{e["hinweis"]}', bg=colors.HexColor('#fff4dc'), line=SIGNAL_C), Spacer(0, 3 * mm)]
    s += [b.box(f'<font name="A-Bold" color="#1747cc">Im Alpha5-Plan: </font>{e["alpha5"]}')]
    return [Anchor(f'lex-{e["id"]}', e['kategorie'].replace('&', '&amp;'), e['name']), KeepInFrame(W - 2 * M, H - 14 * mm - 12 * mm - 18 * mm, s, mode='shrink')]

COVER_FN = [cover]; INTRO_FN = [intro]
def build():
    STATE.update(group='', meal='')
    doc = BaseDocTemplate(OUT, pagesize=A4, title='Alpha5 Zutatenlexikon', author='Alpha5', subject='Grundnahrungsmittel der Fitness-Küche', leftMargin=M, rightMargin=M)
    full = Frame(M, 16 * mm, W - 2 * M, H - 16 * mm - 26 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    rec = Frame(M, 16 * mm, W - 2 * M, H - 14 * mm - 12 * mm - 16 * mm, id='r', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate('cover', [full], onPage=COVER_FN[0]), PageTemplate('light', [full], onPageEnd=page_light_lex),
                          PageTemplate('divider', [full], onPageEnd=b.page_divider), PageTemplate('lex', [rec], onPageEnd=page_lex)])
    story = [Spacer(0, 1), NextPageTemplate('light'), PageBreak()] + INTRO_FN[0]()
    for i, cat in enumerate(CATS):
        story += [NextPageTemplate('divider'), PageBreak()] + divider(i, cat)
        for e in [x for x in ENTRIES if x['kategorie'] == cat]:
            story += [NextPageTemplate('lex'), PageBreak()] + entry(e)
    doc.build(story)

if __name__ == '__main__':
    build(); b.PREV_PAGES.update(b.PAGES); b.PAGES.clear(); build()
    assert b.PAGES == b.PREV_PAGES
    print('ok', OUT, len(ENTRIES))
