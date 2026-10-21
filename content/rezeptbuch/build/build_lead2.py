import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pdf as b
import design as D
from build_pdf import *  # noqa
from design import Table, st, esc, ChapterHero, callout, ACC, SCHWARZ, BLAU, GRAU, LINIE, WEISS, para, blist

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/ausgabe/Alpha5-Gratis-Rezepte.pdf'
PICK = [('schnell', 0), ('schnell', 5), ('pre', 0), ('pre', 5), ('post', 1), ('post', 9), ('cardio', 4), ('wettkampf', 7),
        ('vegan', 0), ('vegan', 11), ('vegetarisch', 5), ('vegetarisch', 15), ('fleisch', 10), ('fleisch', 23),
        ('ohne-schwein', 17), ('ohne-schwein', 21), ('fastfood', 0), ('airfryer', 0), ('dessert', 0), ('eis', 0)]
NAMES = {k: n for k, n, *_ in b.ALL}
ITEMS = [(k, NAMES[k], b.data[k]['recipes'][i], b.data[k]['ingredients']) for k, i in PICK]
DIET = {'vegan': 'Vegan', 'vegetarisch': 'Vegetarisch', 'fleisch': 'Mit Fleisch', 'ohne-schwein': 'Ohne Schweinefleisch'}

def cover(c, doc):
    c.saveState(); c.setFillColor(SCHWARZ); c.rect(0, 0, W, H, fill=1, stroke=0)
    p = c.beginPath(); p.moveTo(0, H * 0.22); p.lineTo(W, H * 0.40); p.lineTo(W, H * 0.40 - 30 * mm); p.lineTo(0, H * 0.22 - 30 * mm); p.close()
    c.setFillColor(BLAU); c.drawPath(p, fill=1, stroke=0)
    b.draw_logo(c, M, H - 52 * mm, 24 * mm)
    c.setFillColor(WEISS); c.setFont('C-XBIt', 72); c.drawString(M - 1 * mm, H - 88 * mm, '20 Lieblings-')
    c.drawString(M - 1 * mm, H - 112 * mm, 'rezepte')
    c.setFont('C-BoldIt', 19); c.setFillColor(colors.HexColor('#8db0ff')); c.drawString(M, H - 126 * mm, 'Gratis-Auszug aus dem Alpha5 Rezeptbuch')
    c.setFillColor(colors.HexColor('#b4bdd0')); c.setFont('A-Regular', 11)
    for i, line in enumerate(['Vor und nach dem Training, für lange Läufe, schnell in 10 Minuten,', 'Fitness-Pizza, Heißluftfritteuse, Protein-Dessert und Sommer-Eis.',
                              'Vegan, vegetarisch, mit Fleisch und ohne Schweinefleisch.']):
        c.drawString(M, H - 142 * mm - i * 6.5 * mm, line)
    c.setFont('A-Regular', 9.5); c.drawString(M, 16 * mm, 'Alle Mengen für 1 Portion, Nährwerte pro Portion berechnet')
    c.restoreState()

def overview():
    rows = [(r['name'], r['anchor'], (cname.replace("&amp;", "&") if k in DIET else f'{cname.replace("&amp;", "&")}, {D.b.diet_of(r)}')) for k, cname, r, _ in ITEMS]
    s = D.opener('gratis', 'Deine 20 Rezepte', 'Eine Auswahl aus allen Kapiteln des Rezeptbuchs. Tippe auf einen Namen, um direkt zum Rezept zu springen.', [('Die Auswahl', rows)], kicker='Gratis-Auszug')
    return s

def outro():
    s = [b.Anchor('outro', 'Gratis-Auszug', ''), ChapterHero('gratis', 'Das war erst der Anfang', kicker='Alpha5', bg=''), Spacer(0, 9 * mm),
         Paragraph('In der Alpha5-App warten fast 300 Rezepte, passend zu deinem Ziel, deinem Training und deiner Ernährungsform.', st('ot', fontSize=13, leading=18)), Spacer(0, 6 * mm),
         blist(['Rezepte vor und nach jeder Trainingseinheit, automatisch passend zu deinem Plan', 'Portionen, die zu deinem Körpergewicht und Ziel passen',
                'Einkaufslisten nach Supermarkt-Bereichen zum Abhaken', 'Meal-Prep-Wochenpläne mit Kochtag-Ablauf',
                'Zutatenlexikon mit 59 Grundnahrungsmitteln', 'Filter für vegan, vegetarisch, ohne Schweinefleisch und „Unter 10 Minuten“'], BLAU, 12, W - 2 * M),
         Spacer(0, 8 * mm), callout('Du stehst auf der Warteliste', 'Wir melden uns per E-Mail, sobald Alpha5 startet. Als eine der Ersten bekommst du Zugang.', BLAU, label_color=SCHWARZ),
         Spacer(0, 8 * mm), Paragraph('Die Rezepte ersetzen keine individuelle Ernährungsberatung. Bei Allergien, Unverträglichkeiten oder Vorerkrankungen prüfe die Zutaten selbst und sprich bei Bedarf mit deinem Arzt.', st('oh', fontSize=9, leading=13, textColor=GRAU))]
    return s

def build():
    b.STATE.update(group='', meal='')
    doc = BaseDocTemplate(OUT, pagesize=A4, title='Alpha5 – 20 Lieblingsrezepte', author='Alpha5', subject='Gratis-Auszug aus dem Alpha5 Rezeptbuch', leftMargin=M, rightMargin=M)
    full = Frame(M, 16 * mm, W - 2 * M, H - 16 * mm - 26 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    rec = Frame(M, 16 * mm, W - 2 * M, H - 14 * mm - 12 * mm - 16 * mm, id='r', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate('cover', [full], onPage=cover), PageTemplate('divider', [full], onPageEnd=D.page_divider),
                          PageTemplate('recipe', [rec], onPageEnd=D.page_recipe)])
    story = [Spacer(0, 1), NextPageTemplate('divider'), PageBreak()] + overview()
    for k, cname, r, ing in ITEMS:
        story += [NextPageTemplate('recipe'), PageBreak()] + D.recipe_page(k, cname, r, ing)
    story += [NextPageTemplate('divider'), PageBreak()] + outro()
    doc.build(story)

D.NAME2KEY['Gratis-Auszug'] = 'gratis'
build(); b.PREV_PAGES.update(b.PAGES); b.PAGES.clear(); build()
print('ok', OUT)
