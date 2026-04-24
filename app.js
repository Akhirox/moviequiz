let searchIndex = [];
let currentMovie = null;

// 1. Charger l'index de recherche au lancement
fetch('api/search_index.json')
    .then(response => response.json())
    .then(data => { searchIndex = data; });

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const randomBtn = document.getElementById('randomBtn');

// 2. Mécanique de la barre de recherche
searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    searchResults.innerHTML = ''; 
    if (query.length < 2) { searchResults.classList.add('hidden'); return; }

    const filteredMovies = searchIndex.filter(m => m.title.toLowerCase().includes(query)).slice(0, 8);
    if (filteredMovies.length > 0) {
        searchResults.classList.remove('hidden');
        filteredMovies.forEach(movie => {
            const li = document.createElement('li');
            li.textContent = `${movie.title} (${movie.year})`;
            li.addEventListener('click', () => selectMovie(movie.id));
            searchResults.appendChild(li);
        });
    } else {
        searchResults.classList.add('hidden');
    }
});

// 3. Mécanique du Film au Hasard
randomBtn.addEventListener('click', () => {
    if(searchIndex.length === 0) return;
    const randomIndex = Math.floor(Math.random() * searchIndex.length);
    const randomMovie = searchIndex[randomIndex];
    selectMovie(randomMovie.id);
});

// 4. Charger et afficher le film
function selectMovie(movieId) {
    document.getElementById('homeMenu').classList.add('hidden');
    
    fetch(`api/movies/${movieId}.json`)
        .then(response => response.json())
        .then(movie => {
            currentMovie = movie;
            startQuiz();
        })
        .catch(error => console.error("Erreur", error));
}

function startQuiz() {
    document.getElementById('quizContainer').classList.remove('hidden');
    document.getElementById('movieTitle').textContent = currentMovie.title;
    
    const poster = document.getElementById('moviePoster');
    if(currentMovie.poster_path) {
        poster.src = "https://image.tmdb.org/t/p/w300" + currentMovie.poster_path;
    } else {
        poster.src = "invalid_path"; // Forcera l'attribut onerror du HTML
    }

    // Réinitialiser les champs textes pour une nouvelle partie
    document.querySelectorAll('.input-group input').forEach(input => {
        input.value = '';
        input.classList.remove('correct-field', 'wrong-field');
        input.disabled = false;
    });
    
    document.getElementById('validateBtn').classList.remove('hidden');
    document.getElementById('resultArea').classList.add('hidden');
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('correctionArea').innerHTML = '';
}

// Fonction utilitaire : vérifie si le texte tapé est contenu dans la vraie réponse (ex: "nolan" dans "Christopher Nolan")
function checkAnswer(userInput, correctAnswersArray) {
    if(!userInput.trim()) return false;
    const user = userInput.toLowerCase().trim();
    return correctAnswersArray.some(ans => ans.toLowerCase().includes(user));
}

// 5. Validation des 5 champs
document.getElementById('validateBtn').addEventListener('click', () => {
    let score = 0;
    let total = 5; // Note sur 5 points maximum
    let corrections = [];

    const iDir = document.getElementById('ans-director');
    const iAct1 = document.getElementById('ans-actor1');
    const iAct2 = document.getElementById('ans-actor2');
    const iYear = document.getElementById('ans-year');
    const iGenre = document.getElementById('ans-genre');

    // Bloquer les champs
    [iDir, iAct1, iAct2, iYear, iGenre].forEach(i => i.disabled = true);
    document.getElementById('validateBtn').classList.add('hidden');

    // -- 1. Vérification du Réalisateur
    if(currentMovie.directors && currentMovie.directors.length > 0) {
        if(checkAnswer(iDir.value, currentMovie.directors)) {
            iDir.classList.add('correct-field'); score++;
        } else {
            iDir.classList.add('wrong-field');
            corrections.push(`Réalisateur : <span class="text-green">${currentMovie.directors.join(', ')}</span>`);
        }
    } else { total--; } // Si le film n'a pas de réal dans la base, on retire ce point du total

    // -- 2 et 3. Vérification des Acteurs
    let validActors = currentMovie.actors || [];
    if(validActors.length > 0) {
        // Acteur 1
        if(checkAnswer(iAct1.value, validActors)) {
            iAct1.classList.add('correct-field'); score++;
        } else { iAct1.classList.add('wrong-field'); }
        
        // Acteur 2 (Il faut vérifier que le joueur n'a pas tapé 2 fois le même nom)
        let v1 = iAct1.value.trim().toLowerCase();
        let v2 = iAct2.value.trim().toLowerCase();
        if(v2 !== "" && v1 !== v2 && checkAnswer(iAct2.value, validActors)) {
            iAct2.classList.add('correct-field'); score++;
        } else { iAct2.classList.add('wrong-field'); }
        
        if(!iAct1.classList.contains('correct-field') || !iAct2.classList.contains('correct-field')) {
            corrections.push(`Acteurs possibles : <span class="text-green">${validActors.slice(0,4).join(', ')}</span>`);
        }
    } else { total -= 2; }

    // -- 4. Vérification de l'Année
    if(currentMovie.release_date && currentMovie.release_date !== "Inconnue") {
        const realYear = currentMovie.release_date.split('-')[0]; // Extrait juste l'année
        if(iYear.value.trim() === realYear) {
            iYear.classList.add('correct-field'); score++;
        } else {
            iYear.classList.add('wrong-field');
            corrections.push(`Année de sortie : <span class="text-green">${realYear}</span>`);
        }
    } else { total--; }

    // -- 5. Vérification du Genre
    if(currentMovie.genres && currentMovie.genres.length > 0) {
        if(checkAnswer(iGenre.value, currentMovie.genres)) {
            iGenre.classList.add('correct-field'); score++;
        } else {
            iGenre.classList.add('wrong-field');
            corrections.push(`Genres : <span class="text-green">${currentMovie.genres.join(', ')}</span>`);
        }
    } else { total--; }

    // -- Affichage du bilan final
    const resArea = document.getElementById('resultArea');
    resArea.classList.remove('hidden');
    document.getElementById('scoreText').textContent = `Score : ${score} / ${total}`;
    
    const corrArea = document.getElementById('correctionArea');
    if(corrections.length > 0) {
        corrArea.innerHTML = `<p>Corrections :</p>` + corrections.map(c => `<p>👉 ${c}</p>`).join('');
    } else {
        corrArea.innerHTML = `<p class="text-green" style="font-size: 1.2em;">Un sans-faute, bravo ! 🍿</p>`;
    }

    document.getElementById('nextBtn').classList.remove('hidden');
});

// 6. Retour à l'accueil
document.getElementById('nextBtn').addEventListener('click', () => {
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('homeMenu').classList.remove('hidden');
});