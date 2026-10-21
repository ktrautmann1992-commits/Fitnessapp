import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pdf as b
import design as D

SKIP_DEPT = {'Gewürze, Öle & Saucen'}
SKIP = re.compile(r'^(salz|pfeffer|wasser|eiswürfel|backpulver|erythrit|johannisbrotkernmehl|speisestärke|natron|hefe)|pulver|whey|casein|isolat|instantkaffee', re.I)
def vessel(key, r):
    n = r['name'].lower(); m = r['mahlzeit'].lower()
    if key == 'eis': return 'served as scoops in a small bowl, with the frozen pint container beside it, a few of the toppings from the recipe scattered around'
    if re.search(r'shake|drink|lassi|kakao|smoothie(?!-bowl)|milch(?!reis)|eistee|gel ', n): return 'in a tall clear glass, condensation on the glass'
    if 'gel' in n and 'soft' in n: return 'in a small soft flask next to a running watch, energy-gel style, outdoor bench'
    if re.search(r'im glas|overnight|chia|pudding|mousse|creme|cheesecake|tiramisu', n): return 'layered in a clear glass jar, spoon beside it'
    if re.search(r'pizza|flammkuchen', n): return 'whole on a dark wooden board, one slice slightly pulled out'
    if re.search(r'burger|hot dog', n): return 'on a small board with a parchment sheet, cut in half to show the layers'
    if re.search(r'bowl|salat|curry|dal|chili|suppe|eintopf|porridge|oats|grießbrei|reis', n): return 'in a wide ceramic bowl'
    if re.search(r'wrap|burrito|quesadilla|toast|brot|brötchen|stulle', n): return 'on a plate, cut open so the filling is visible'
    if re.search(r'muffin|bällchen|balls|kugel|riegel|bites|nuggets|schnecken|waffel|pancake|pfannkuchen', n): return 'several pieces arranged on a plate or baking paper'
    if key == 'mealprep': return 'portioned into 5 meal-prep glass containers lined up, one open in front'
    return 'on a matte ceramic plate'

STYLE = ('Professional food photography for a sporty fitness cookbook. Natural soft daylight from the side, appetizing, fresh, '
         'realistic portion size for one person, shallow depth of field, 45-degree angle. Surface: light grey concrete or dark slate. '
         'Small blue linen napkin as accent. Clean, modern, energetic look. Wide landscape format 16:9, dish centered with space above and below '
         '(the image will be cropped to a wide banner). No text, no logos, no brand packaging, no hands, no people.')

lines = ['# Alpha5 – Foto-Prompts für Gemini', '',
         'Für jedes Rezept ein fertiger Prompt. So gehst du vor:', '',
         '1. Prompt kopieren und in Gemini einfügen (Bildgenerierung).',
         '2. Foto prüfen: Passt es zum Rezept? Sonst kurz nachschärfen, z. B. „mehr Gemüse sichtbar“ oder „heller“.',
         '3. Foto speichern und mir hier im Chat schicken, zusammen mit dem **Dateinamen** aus der Liste. Ich baue es dann ins Rezeptbuch ein.', '',
         'Die Prompts sind auf Englisch, weil Bildmodelle damit meist die besten Ergebnisse liefern. Rezeptname und Beschreibung stehen zusätzlich auf Deutsch drin.',
         'Alle Prompts enden mit demselben Stil-Block. So sehen alle Fotos im Buch einheitlich aus.', '',
         'Hinweis: KI-Bilder zeigen ein Beispiel-Gericht, kein exaktes Foto eures Rezepts. Achtet darauf, dass keine Zutaten zu sehen sind, die im Rezept nicht vorkommen (z. B. Fleisch bei veganen Gerichten).', '']
count = 0
for key, gname, _ in b.ALL:
    if key not in b.data: continue
    recs = b.data[key]['recipes']; ing = b.data[key]['ingredients']
    lines += ['', f'## {gname.replace("&amp;", "&")}', '']
    for r in recs:
        count += 1
        zs = sorted([z for z in r['zutaten'] if not SKIP.search(z['name']) and ing.get(z['name'], {}).get('abteilung') not in SKIP_DEPT], key=lambda z: -z['menge_g'])[:6]
        names = ', '.join(z['name'] for z in zs)
        diet = ''
        pf = r.get('passt_fuer') or {'vegan': ['vegan'], 'vegetarisch': ['vegetarisch']}.get(key, [])
        if 'vegan' in pf: diet = ' The dish is fully vegan: no meat, fish, eggs or dairy visible.'
        elif 'vegetarisch' in pf: diet = ' The dish is vegetarian: no meat or fish visible.'
        prompt = (f'Food photo of "{r["name"]}" ({r["beschreibung"]}). Visible main ingredients: {names}. '
                  f'Presentation: {vessel(key, r)}.{diet} {STYLE}')
        fid = D.foto_id(key, r)
        lines += [f'### {count}. {r["name"]}', f'Dateiname: `{fid}.jpg`', '', '```', prompt, '```', '']
out = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/ausgabe/Alpha5-Foto-Prompts-Gemini.md'
open(out, 'w').write('\n'.join(lines))
print(count, out)

# Maschinenlesbare Auftragsliste für die automatische Bildgenerierung (Higgsfield, 21:9)
import json
jobs = []
n = 0
for key, gname, _ in b.ALL:
    if key not in b.data: continue
    ing = b.data[key]['ingredients']
    for r in b.data[key]['recipes']:
        n += 1
        zs = sorted([z for z in r['zutaten'] if not SKIP.search(z['name']) and ing.get(z['name'], {}).get('abteilung') not in SKIP_DEPT], key=lambda z: -z['menge_g'])[:6]
        pf = r.get('passt_fuer') or {'vegan': ['vegan'], 'vegetarisch': ['vegetarisch']}.get(key, [])
        diet = ' The dish is fully vegan: no meat, fish, eggs or dairy visible.' if 'vegan' in pf else (' The dish is vegetarian: no meat or fish visible.' if 'vegetarisch' in pf else '')
        st = STYLE.replace('Wide landscape format 16:9', 'Ultra-wide landscape format 21:9')
        jobs.append({'nr': n, 'kapitel': key, 'rezept': r['name'], 'datei': D.foto_id(key, r),
                     'prompt': f'Food photo of "{r["name"]}" ({r["beschreibung"]}). Visible main ingredients: {", ".join(z["name"] for z in zs)}. Presentation: {vessel(key, r)}.{diet} {st}'})
jp = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/foto-auftraege.json'
json.dump(jobs, open(jp, 'w'), ensure_ascii=False, indent=1)
print(len(jobs), jp)
