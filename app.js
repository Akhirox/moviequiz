let searchIndex = [];

// 1. Charger l'index de recherche au lancement de la page
fetch('api/search_index.json')
    .then(response => response.json())
    .then(data => {
        searchIndex = data;
        console.log("Index chargé avec succès :", searchIndex.length, "films.");
    });

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

// 2. Écouter ce que l'utilisateur tape
searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    searchResults.innerHTML = ''; // On vide les résultats précédents
    
    if (query.length < 2) {
        searchResults.classList.add('hidden');
        return;
    }

    // Chercher les films qui correspondent
    const filteredMovies = searchIndex.filter(movie => 
        movie.title.toLowerCase().includes(query)
    ).slice(0, 10); // On garde les 10 premiers résultats pour ne pas surcharger

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

let currentMovie = null;

// 3. Quand on clique sur un film
function selectMovie(movieId) {
    searchResults.classList.add('hidden');
    searchInput.value = ''; // On vide la barre
    
    // On cache la zone de recherche pour laisser place au jeu
    document.querySelector('.search-container').classList.add('hidden'); 

    // On va chercher le fichier JSON unique de CE film
    fetch(`api/movies/${movieId}.json`)
        .then(response => response.json())
        .then(movie => {
            currentMovie = movie;
            startQuiz();
        })
        .catch(error => console.error("Erreur de chargement des données du film", error));
}

// 4. Initialisation de l'interface du quiz
function startQuiz() {
    document.getElementById('quizContainer').classList.remove('hidden');
    document.getElementById('movieTitle').textContent = currentMovie.title;
    
    const poster = document.getElementById('moviePoster');
    // On utilise l'URL de base de l'API TMDb pour afficher les affiches
    if(currentMovie.poster_path) {
        poster.src = "https://image.tmdb.org/t/p/w300" + currentMovie.poster_path;
        poster.style.display = "inline";
    } else {
        poster.style.display = "none";
    }

    // On lance la première question !
    askDirectorQuestion();
}

// 5. Génération d'une question sur le réalisateur
function askDirectorQuestion() {
    const questionText = document.getElementById('questionText');
    const answersContainer = document.getElementById('answersContainer');
    const nextBtn = document.getElementById('nextBtn');
    
    answersContainer.innerHTML = ''; // Nettoyer les anciens boutons
    nextBtn.classList.add('hidden');

    // Sécurité : si le film n'a pas de réalisateur dans la base
    if (!currentMovie.directors || currentMovie.directors.length === 0) {
        questionText.textContent = "Mince, le réalisateur n'est pas renseigné pour ce film.";
        nextBtn.textContent = "Chercher un autre film";
        nextBtn.classList.remove('hidden');
        return;
    }

    const realDirector = currentMovie.directors[0];
    questionText.textContent = `Qui a réalisé "${currentMovie.title}" ?`;

    // On crée des fausses réponses arbitraires pour l'exemple (tu pourras les complexifier plus tard)
    let choices = [realDirector, "Steven Spielberg", "Christopher Nolan", "Martin Scorsese"];
    
    // Petite astuce pour mélanger le tableau (pour que la bonne réponse ne soit pas toujours la première)
    choices = choices.sort(() => Math.random() - 0.5);

    // On crée les 4 boutons
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.textContent = choice;
        
        btn.addEventListener('click', function() {
            // Désactiver tous les boutons après le clic du joueur
            Array.from(answersContainer.children).forEach(b => b.disabled = true);
            
            if (choice === realDirector) {
                this.classList.add('correct'); // Devient vert
            } else {
                this.classList.add('wrong'); // Devient rouge
                // On montre quand même la bonne réponse en vert
                Array.from(answersContainer.children).find(b => b.textContent === realDirector).classList.add('correct');
            }
            
            nextBtn.textContent = "Rejouer avec un autre film";
            nextBtn.classList.remove('hidden');
        });
        
        answersContainer.appendChild(btn);
    });
}

// 6. Action du bouton "Suivant"
document.getElementById('nextBtn').addEventListener('click', () => {
    // Pour l'instant, on recharge simplement la page pour recommencer
    location.reload(); 
});