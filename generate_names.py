import csv
import json
import ast
import sys

csv.field_size_limit(sys.maxsize)

CREDITS_FILE = 'credits.csv' # Assure-toi que ton gros fichier s'appelle bien comme ça
OUTPUT_FILE = 'api/names.json'

noms_uniques = set() # Le "set" en Python permet d'ignorer automatiquement les doublons

print("Extraction des noms en cours... (ça prend environ 30 secondes)")

with open(CREDITS_FILE, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            # Acteurs
            cast = ast.literal_eval(row['cast'])
            for actor in cast[:5]:
                noms_uniques.add(actor['name'])
            
            # Réalisateurs
            crew = ast.literal_eval(row['crew'])
            for c in crew:
                if c.get('job') == 'Director':
                    noms_uniques.add(c['name'])
        except Exception:
            pass

# On transforme le set en liste triée par ordre alphabétique
liste_noms = sorted(list(noms_uniques))

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(liste_noms, f, ensure_ascii=False)

print(f"BIM ! {len(liste_noms)} noms uniques ont été extraits et sauvegardés dans api/names.json")