import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pdf as b
import design as D
import build_lexikon as L
from build_pdf import *  # noqa

def overview():
    sections = [('Kategorien', [(c, f'lexcat-{i}', f'{sum(1 for e in L.ENTRIES if e["kategorie"] == c)} Einträge') for i, c in enumerate(L.CATS)])]
    extra = D.callout('So liest du die Seiten', 'Nährwerte gelten pro 100 g (Reis, Nudeln und Hülsenfrüchte trocken). Gelbe Hinweise betreffen Sicherheit und Qualität, blaue zeigen den Einsatz im Alpha5-Plan. Das Lexikon gibt allgemeine Informationen und ersetzt keine individuelle Beratung.', D.ACC['lexikon'], label_color=D.SCHWARZ)
    return D.opener('lexikon', 'Zutatenlexikon', b.LEXIKON_CH[2] + ' Mit Nährwerten, Eiweißqualität und Hinweisen, für wen sich ein Lebensmittel besonders eignet und für wen weniger.', sections, (), extra)

def lex_story():
    story = [NextPageTemplate('divider'), PageBreak()] + overview()
    for i, cat in enumerate(L.CATS):
        story += [NextPageTemplate('divider'), PageBreak()] + L.divider(i, cat)
        for e in [x for x in L.ENTRIES if x['kategorie'] == cat]:
            story += [NextPageTemplate('lex'), PageBreak()] + L.entry(e)
    return story

b.LEX_HOOK = lex_story
b.LEX_PAGE = L.page_lex
b.build(); b.PREV_PAGES.update(b.PAGES); b.PAGES.clear(); b.build()
assert b.PAGES == b.PREV_PAGES, 'Seitenzahlen nicht stabil'
print('ok', b.OUT, len(b.PAGES))
