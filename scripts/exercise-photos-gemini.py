#!/usr/bin/env python3
"""Übungsfotos mit Google Gemini erzeugen (läuft nur in GitHub Actions, Schlüssel GEMINI_API_KEY).

Liest content/exercise-photos/gemini-request.json (Liste von Übungs-IDs) und die Prompts aus
content/exercise-photos/prompts.json. Je Übung: Startbild (mit Referenzfoto der Frau für gleiche Person),
dann Endbild (Startbild als Referenz). Schreibt <id>-start.png / <id>-end.png in den Ausgabeordner.
"""
import base64, json, os, sys, time, urllib.request, urllib.error

API = "https://generativelanguage.googleapis.com/v1beta"
KEY = os.environ["GEMINI_API_KEY"]
out_dir, ref_path = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
PREFIX = ("Identity reference only: use the same woman as in the reference photo (same face, hair, body type, "
          "same black outfit), but a completely new pose, equipment and camera view exactly as described below. "
          "Do not copy the reference pose. Output a 4:3 landscape photo. ")

def call(method, path, body=None):
    url = f"{API}/{path}{'&' if '?' in path else '?'}key={KEY}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)

def pick_model():
    forced = os.environ.get("GEMINI_IMAGE_MODEL", "").strip()
    if forced:
        return forced
    models = call("GET", "models?pageSize=200").get("models", [])
    cands = [m["name"].split("/", 1)[1] for m in models
             if "image" in m["name"] and "generateContent" in m.get("supportedGenerationMethods", [])]
    if not cands:
        sys.exit("Kein Gemini-Bildmodell gefunden: " + ", ".join(m["name"] for m in models))
    cands.sort(key=lambda n: (("flash" not in n), ("preview" in n), n))
    print("Bildmodelle:", cands)
    return cands[0]

def gen(model, prompt, image_path):
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    body = {"contents": [{"parts": [{"text": prompt},
                                    {"inline_data": {"mime_type": "image/png", "data": b64}}]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}}
    for attempt in range(3):
        try:
            res = call("POST", f"models/{model}:generateContent", body)
            for part in res["candidates"][0]["content"]["parts"]:
                inline = part.get("inline_data") or part.get("inlineData")
                if inline:
                    return base64.b64decode(inline["data"])
            print("Antwort ohne Bild:", json.dumps(res)[:500])
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, e.read()[:300])
        time.sleep(10 * (attempt + 1))
    return None

prompts = {p["id"]: p for p in json.load(open("content/exercise-photos/prompts.json"))}
ids = json.load(open("content/exercise-photos/gemini-request.json"))
model = pick_model()
print("Modell:", model)
failed = []
for i in ids:
    p = prompts.get(i)
    if not p:
        failed.append(i); print("Kein Prompt:", i); continue
    start = gen(model, PREFIX + p["start"], ref_path)
    if not start:
        failed.append(i); continue
    sp = os.path.join(out_dir, f"{i}-start.png")
    open(sp, "wb").write(start)
    end = gen(model, p["end"], sp)
    if not end:
        os.remove(sp); failed.append(i); continue
    open(os.path.join(out_dir, f"{i}-end.png"), "wb").write(end)
    print("ok", i)
if failed:
    print("FEHLGESCHLAGEN:", failed)
