import json,re,unicodedata,os
from collections import Counter
W=os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/daten/'
files=[('vegan','vegan'),('vegan-2','vegan'),('vegetarisch','vegetarisch'),('vegetarisch-2','vegetarisch'),('fleisch','fleisch'),('fleisch-2','fleisch'),
       ('ohne-schwein','ohne-schwein'),('ohne-schwein-2','ohne-schwein'),('schnell','schnell'),('pre','pre-workout'),('post','post-workout'),
       ('cardio','cardio'),('wettkampf','wettkampf'),('mealprep','meal-prep'),('fastfood','fitness-fast-food'),('airfryer','heissluftfritteuse'),('airfryer-2','heissluftfritteuse'),('dessert','protein-dessert'),('eis','sommer-eis'),('budget','spar-kueche')]
fix=lambda t:t.replace('⅓','1/3').replace('⅔','2/3')
def slug(s):
    s=s.lower().replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss').replace('&','und')
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')
ing={}; raw=[]
for f,cat in files:
    d=json.loads(fix(open(W+f+'.json').read()))
    for n,v in d['ingredients'].items(): ing.setdefault(n,v)
    raw.append((f,cat,d))
alias_groups=[['Petersilie (frisch)','Petersilie'],['Basmatireis (trocken)','Basmatireis'],['Couscous (trocken)','Couscous'],['Rote Linsen (trocken)','Rote Linsen'],
 ['Gemüsebrühe (Instantpulver)','Gemüsebrühe (Pulver)'],['Senf','Senf (mittelscharf)','Senf mittelscharf'],['Zimt','Zimt gemahlen','Zimt (gemahlen)'],['Kreuzkümmel','Kreuzkümmel (gemahlen)'],
 ['Oregano (getrocknet)','Oregano getrocknet'],['Reisnudeln (trocken)','Reisnudeln'],['Bulgur (trocken)','Bulgur'],['Datteln (getrocknet, entsteint)','Datteln getrocknet','Datteln (getrocknet)'],
 ['Schwarze Oliven (Glas)','Schwarze Oliven'],['Schnittlauch (frisch)','Schnittlauch'],['Gouda','Gouda (gerieben)'],['Garnelen (TK, roh, geschält)','Garnelen (TK, roh)'],['Toastbrot (Weizen)','Toastbrot']]
alias={}
for g in alias_groups:
    for n in g[1:]:
        if n in ing and g[0] in ing:
            a,b=ing[g[0]]['kcal'],ing[n]['kcal']
            if max(a,b)==0 or abs(a-b)/max(a,b)<=0.35: alias[n]=g[0]
            else: print('NICHT zusammengeführt',n,a,b)
PORK=re.compile(r'schwein|(?<!puten)schinken|speck|kassler|salami|mett\b|bacon',re.I)
def diets(cat,r):
    if 'passt_fuer' in r: return r['passt_fuer']
    zs=' '.join(z['name'] for z in r['zutaten'])
    if cat in ('fleisch','ohne-schwein') and not any(ing[alias.get(z['name'],z['name'])]['abteilung']=='Fleisch & Fisch' or re.search('gelatine|thunfisch|lachs|schinken|hähnchen|pute|rind|garnele|krabbe|fisch',z['name'],re.I) for z in r['zutaten']):
        return ['vegetarisch','fleisch','ohne-schwein']
    return {'vegan':['vegan','vegetarisch','fleisch','ohne-schwein'],'vegetarisch':['vegetarisch','fleisch','ohne-schwein'],
            'ohne-schwein':['fleisch','ohne-schwein'],'fleisch':['fleisch'] if PORK.search(zs) else ['fleisch','ohne-schwein']}[cat]
CAT={'vegan':'Vegan','vegetarisch':'Vegetarisch','fleisch':'Mit Fleisch','ohne-schwein':'Ohne Schweinefleisch','schnell':'Fertig in 10 Minuten','pre-workout':'Pre-Workout',
     'post-workout':'Post-Workout','cardio':'Cardio & Ausdauer','wettkampf':'Wettkampftag','meal-prep':'Meal-Prep-Wochenpläne','fitness-fast-food':'Fitness-Fast-Food','heissluftfritteuse':'Heißluftfritteuse','protein-dessert':'Protein-Desserts','sommer-eis':'Sommer-Eis','spar-kueche':'Spar-Küche'}
used=set(); recipes=[]; ids=set()
for f,cat,d in raw:
    for r in d['recipes']:
        rid=slug(r['name'])
        if rid in ids: rid=f'{rid}-{cat}'
        assert rid not in ids; ids.add(rid)
        tot=dict(kcal=0,p=0,c=0,f=0); zl=[]
        for z in r['zutaten']:
            n=alias.get(z['name'],z['name']); used.add(n); v=ing[n]
            for k in tot: tot[k]+=v[k]*z['menge_g']/100
            zl.append({'zutat_id':slug(n),'menge_g':z['menge_g'],'anzeige':z['anzeige']})
        por=r.get('portionen',1)
        tags=list(dict.fromkeys((['Unter 10 Minuten'] if r['zeit_min']<=10 else [])+r.get('tags',[])))
        rec={'id':rid,'name':r['name'],'beschreibung':r['beschreibung'],'kategorie':cat,'abschnitt':r['mahlzeit'],
             'ernaehrungsformen':diets(cat,r),'zeit_min':r['zeit_min'],'portionen':por,'tags':tags,
             'zutaten':zl,'zubereitung':r['zubereitung'],'tipp':r.get('tipp',''),
             'naehrwerte_pro_portion':{'kcal':round(tot['kcal']/por),'eiweiss_g':round(tot['p']/por,1),'kohlenhydrate_g':round(tot['c']/por,1),'fett_g':round(tot['f']/por,1)},
             'status':'draft'}
        if 'kosten_eur' in r: rec['kosten_eur_pro_portion']=r['kosten_eur']
        if 'plan' in r: rec['meal_prep_plan']=slug(r['plan'])
        recipes.append(rec)
zut=[]
for n in sorted(used,key=str.lower):
    v=ing[n]; e={'id':slug(n),'name':n,'abteilung':v['abteilung'],'pro_100g':{'kcal':v['kcal'],'eiweiss_g':v['p'],'kohlenhydrate_g':v['c'],'fett_g':v['f']}}
    if 'preis_eur_kg' in v: e['preis_eur_kg_schaetzung']=v['preis_eur_kg']
    zut.append(e)
assert len({z['id'] for z in zut})==len(zut), [z['id'] for z in zut if [y['id'] for y in zut].count(z['id'])>1]
zids={z['id'] for z in zut}
assert all(z['zutat_id'] in zids for r in recipes for z in r['zutaten'])
mp=json.loads(fix(open(W+'mealprep.json').read()))['plaene']
plans=[{'id':slug(p['plan']),'ernaehrungsform':p['plan'],'titel':p['titel'],'beschreibung':p['beschreibung'],
        'rezepte':[r['id'] for r in recipes if r.get('meal_prep_plan')==slug(p['plan'])],'kochtag':p['kochtag'],'aufbewahrung':p['aufbewahrung'],'abendessen_hinweis':p['abendessen_hinweis']} for p in mp]
seed={'format':'alpha5-rezepte','version':'1.0','stand':'2026-10-11',
      'hinweise':['Nährwerte pro Portion sind aus den Zutatenmengen berechnet (Richtwerte).','Alle Rezepte haben status "draft" und sollen vor Veröffentlichung fachlich geprüft werden.',
                  'preis_eur_kg_schaetzung sind grobe Discounter-Schätzungen (Stand 2026) und nur für die Spar-Küche gedacht.','Erythrit ist mit 0 kcal angesetzt.',
                  'ernaehrungsformen nennt alle Gruppen, für die ein Rezept geeignet ist (ein veganes Rezept passt z. B. für alle vier).'],
      'kategorien':[{'id':k,'name':v,'typ':'ernaehrungsform' if k in ('vegan','vegetarisch','fleisch','ohne-schwein') else 'thema'} for k,v in CAT.items()],
      'ernaehrungsformen':[{'id':'vegan','name':'Vegan'},{'id':'vegetarisch','name':'Vegetarisch'},{'id':'fleisch','name':'Mit Fleisch (inkl. Schwein)'},{'id':'ohne-schwein','name':'Ohne Schweinefleisch'}],
      'abteilungen':["Obst & Gemüse","Fleisch & Fisch","Kühlregal & Molkerei","Pflanzliche Alternativen","Brot & Backwaren","Getreide, Nudeln & Hülsenfrüchte","Konserven & Gläser","Nüsse, Samen & Trockenfrüchte","Tiefkühl","Gewürze, Öle & Saucen","Sonstiges"],
      'zutatenlexikon':[e for f in ['teil-kohlenhydrate.json','teil-huelsen-nuesse.json','teil-eiweiss-fette.json'] for e in json.load(open(W+'lexikon/'+f))['eintraege']],
      'zutaten':zut,'rezepte':recipes,'meal_prep_plaene':plans,
      'ratgeber':{'wettkampf':json.load(open(W+'wettkampf.json'))['leitfaden'],'eismaschine':json.load(open(W+'eis.json'))['leitfaden'],'heissluftfritteuse':json.load(open(W+'airfryer.json'))['leitfaden'],'unterwegs':json.load(open(W+'unterwegs.json'))}}
json.dump(seed,open(os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/ausgabe/alpha5-rezepte.json','w'),ensure_ascii=False,indent=1)
print(len(recipes),'Rezepte,',len(zut),'Zutaten,',len(alias),'Namen zusammengeführt')
print(Counter(r['kategorie'] for r in recipes))
print('fleisch-Rezepte auch ohne Schwein geeignet:',sum(1 for r in recipes if r['kategorie']=='fleisch' and 'ohne-schwein' in r['ernaehrungsformen']))
print(Counter(f for r in recipes for f in r['ernaehrungsformen']))
