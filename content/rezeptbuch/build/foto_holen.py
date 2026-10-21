"""Lädt ein fertiges Higgsfield-Bild herunter und legt es als fotos/<datei>.jpg ab.
Aufruf: python3 foto_holen.py <datei-id> <bild-url>"""
import sys, os, io, urllib.request
from PIL import Image
fid, url = sys.argv[1], sys.argv[2]
dst = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fotos', fid + '.jpg')
img = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert('RGB')
if img.width > 1800: img = img.resize((1800, round(img.height * 1800 / img.width)), Image.LANCZOS)
img.save(dst, 'JPEG', quality=84, optimize=True)
print('ok', dst, img.size)
