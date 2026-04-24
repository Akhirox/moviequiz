import csv
import json
import os
import ast
import sys

# Pour éviter les erreurs avec les très gros champs de texte
csv.field_size_limit(sys.maxsize)

# Noms de tes fichiers
CREDITS_FILE = 'credits.csv'
METADATA_FILE = 'metadata.csv'
OUTPUT_DIR = 'api/movies'
INDEX_FILE = 'api/search_index.json'

# Création des dossiers
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Étape 1/2 : Lecture du casting en mémoire (ça peut prendre une minute)...")
credits_data = {}

# On lit d'abord le fichier des acteurs/réalisateurs
with open(CREDITS_FILE, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        movie_id = row['id']
        try:
            # On prend les 5 premiers acteurs maximum
            cast_list = ast.literal_eval(row['cast'])
            actors = [actor['name'] for actor in cast_list[:5]]
            
            # On récupère le(s) réalisateur(s)
            crew_list = ast.literal_eval(row['crew'])
            directors = [crew['name'] for crew in crew_list if crew.get('job') == 'Director']
            
            # On stocke ça dans un dictionnaire avec l'ID du film comme clé
            credits_data[movie_id] = {
                "actors": actors,
                "directors": directors
            }
        except Exception:
            # S'il y a un souci sur une ligne, on crée des listes vides
            credits_data[movie_id] = {"actors": [], "directors": []}

print("Étape 2/2 : Croisement avec les métadonnées et création des fichiers JSON...")
search_index = []
films_crees = 0

# On lit ensuite le fichier principal
with open(METADATA_FILE, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        movie_id = row['id']
        title = row.get('title', '')
        
        # On ignore les lignes cassées (sans titre ou sans ID)
        if not title or not movie_id:
            continue
            
        try:
            # Extraction des infos utiles pour le quiz
            release_date = row.get('release_date', 'Inconnue')
            overview = row.get('overview', '')
            poster_path = row.get('poster_path', '')
            budget = row.get('budget', '0')
            vote_average = row.get('vote_average', '0')
            vote_count = row.get('vote_count', '0')
            
            # Récupération propre des genres
            try:
                genres_list = ast.literal_eval(row.get('genres', '[]'))
                genres = [g['name'] for g in genres_list]
            except:
                genres = []

            # On va chercher le casting qu'on a mis de côté à l'étape 1
            movie_credits = credits_data.get(movie_id, {"actors": [], "directors": []})
            
            # On assemble le profil complet du film !
            movie_data = {
                "id": movie_id,
                "title": title,
                "release_date": release_date,
                "overview": overview,
                "poster_path": poster_path,
                "budget": budget,
                "genres": genres,
                "vote_average": vote_average,
                "vote_count": vote_count,
                "directors": movie_credits["directors"],
                "actors": movie_credits["actors"]
            }
            
            # Sauvegarde du petit fichier JSON de ce film
            with open(f"{OUTPUT_DIR}/{movie_id}.json", "w", encoding="utf-8") as out_file:
                json.dump(movie_data, out_file, ensure_ascii=False)
                
            # Sécurité pour parser le nombre de votes (sert pour les niveaux de difficulté)
            try:
                votes = int(float(vote_count))
            except:
                votes = 0

            # Ajout à l'index de recherche (on y met l'année et les votes)
            annee = release_date.split('-')[0] if release_date != 'Inconnue' else ''
            search_index.append({
                "id": movie_id,
                "title": title,
                "year": annee,
                "votes": votes
            })
            films_crees += 1
            
        except Exception as e:
            continue

# Sauvegarde du grand index final
with open(INDEX_FILE, "w", encoding="utf-8") as f:
    json.dump(search_index, f, ensure_ascii=False)

print(f"BIM ! Terminé avec succès. {films_crees} films ont été générés pour ton API.")