import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pdf as b
import design as D
import build_lexikon as L
from build_pdf import *  # noqa
from design import Table, st, esc, SCHWARZ, BLAU, GRAU, LINIE, WEISS, para, Mark

def cover(c, doc):
    c.saveState(); c.setFillColor(SCHWARZ); c.rect(0, 0, W, H, fill=1, stroke=0)
    p = c.beginPath(); p.moveTo(0, H * 0.24); p.lineTo(W, H * 0.41); p.lineTo(W, H * 0.41 - 30 * mm); p.lineTo(0, H * 0.24 - 30 * mm); p.close()
    c.setFillColor(BLAU); c.drawPath(p, fill=1, stroke=0)
    b.draw_logo(c, M, H - 52 * mm, 24 * mm)
    c.setFillColor(WEISS); c.setFont('C-XBIt', 74); c.drawString(M - 1 * mm, H - 88 * mm, 'Zutatenlexikon')
    c.setFont('C-BoldIt', 18); c.setFillColor(colors.HexColor('#8db0ff')); c.drawString(M, H - 100 * mm, 'Die Basics der Fitness-Küche – was sie können und für wen sie passen')
    half = (len(L.CATS) + 1) // 2
    for i, cat in enumerate(L.CATS):
        x = M + (0 if i < half else (W - 2 * M) / 2 + 2 * mm); y = H - 118 * mm - (i % half) * 8 * mm
        para(c, x, y - 0.4 * mm, 1.6 * mm, 4.6 * mm, 1.2 * mm, fill=BLAU)
        c.setFillColor(WEISS); c.setFont('C-BoldIt', 14); c.drawString(x + 5 * mm, y, cat)
    c.setFillColor(colors.HexColor('#b4bdd0')); c.setFont('A-Regular', 9.5)
    c.drawString(M, 16 * mm, f'{len(L.ENTRIES)} Grundnahrungsmittel, Nährwerte pro 100 g. Allgemeine Informationen, keine Ernährungsberatung.')
    c.restoreState()

def intro():
    pts = [('Nährwerte pro 100 g', 'Oben auf jeder Seite stehen Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe pro 100 g. Reis, Nudeln und Hülsenfrüchte sind trocken angegeben, gegart wiegen sie etwa das Zwei- bis Dreifache.'),
           ('Eiweißqualität', 'Pflanzliches Eiweiß hat oft eine begrenzende Aminosäure. Kombinierst du über den Tag Getreide mit Hülsenfrüchten, ergänzen sie sich gut.'),
           ('Gut und weniger geeignet', 'Für welche Ziele und Situationen ein Lebensmittel besonders passt – und wann weniger, etwa direkt vor dem Training oder bei Unverträglichkeiten.'),
           ('Hinweise', 'Gelbe Hinweise betreffen Sicherheit und Qualität, blaue zeigen den Einsatz im Alpha5-Plan.'),
           ('Wichtig', 'Allgemeine Informationen. Bei Erkrankungen, Allergien, in Schwangerschaft und Stillzeit stimme deine Ernährung mit Arzt oder Ernährungsfachkraft ab.')]
    s = [Spacer(0, 2 * mm), Paragraph('So liest du das Lexikon', st('it', fontName='C-XBIt', fontSize=38, leading=40)), Spacer(0, 7 * mm)]
    rows = [[Paragraph(f'<font name="C-XBIt" size="26" color="#1f5bff">{i}</font>', st('nn', leading=26)),
             [Paragraph(h, st('ih', fontName='C-BoldIt', fontSize=15, leading=17)), Spacer(0, 1 * mm), Paragraph(t, st('itx', fontSize=10.5, leading=15, textColor=GRAU))]] for i, (h, t) in enumerate(pts, 1)]
    t = Table(rows, colWidths=[12 * mm, W - 2 * M - 12 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    s += [t, Spacer(0, 6 * mm), Paragraph('Kategorien', st('kt', fontName='C-XBIt', fontSize=24, leading=26)), Spacer(0, 3 * mm)]
    rows = [[Mark(BLAU, w=3 * mm, h=5 * mm, dy=0.5 * mm), Paragraph(f'<a href="#lexcat-{i}" color="#0a0c10"><font name="C-BoldIt" size="14">{c}</font></a>', st('kc', leading=16)),
             Paragraph(f'<a href="#lexcat-{i}" color="#1f5bff">{b.PREV_PAGES.get(f"lexcat-{i}", "")}</a>', st('kp', fontName='C-XBIt', fontSize=15, leading=16, alignment=2))] for i, c in enumerate(L.CATS)]
    t = Table(rows, colWidths=[7 * mm, W - 2 * M - 27 * mm, 20 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LINEBELOW', (0, 0), (-1, -1), 0.5, LINIE), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    s.append(t)
    return [KeepInFrame(W - 2 * M, H - 16 * mm - 26 * mm - 2 * mm, s, mode='shrink')]

L.COVER_FN[0] = cover; L.INTRO_FN[0] = intro
b.page_divider = lambda c, d: D.footer(c, d, 'Zutatenlexikon')
L.build(); b.PREV_PAGES.update(b.PAGES); b.PAGES.clear(); L.build()
print('ok', L.OUT)
