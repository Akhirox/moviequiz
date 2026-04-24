let searchIndex = [];
let namesIndex = [];
let currentMovie = null;
let chosenActors = []; // Tableau pour stocker les acteurs tapés

// 1. Initialisation
fetch('api/search_index.json').then(r => r.json()).then(data => searchIndex = data);
fetch('api/names.json').then(r => r.json()).then(data => namesIndex = data);

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase().trim();
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
    } else { searchResults.classList.add('hidden'); }
});

document.getElementById('randomBtn').addEventListener('click', () => {
    if(searchIndex.length === 0) return;
    const randomMovie = searchIndex[Math.floor(Math.random() * searchIndex.length)];
    selectMovie(randomMovie.id);
});

// 2. Lancement du Quiz
function selectMovie(movieId) {
    document.getElementById('homeMenu').classList.add('hidden');
    fetch(`api/movies/${movieId}.json`)
        .then(r => r.json())
        .then(movie => { currentMovie = movie; startQuiz(); });
}

function startQuiz() {
    document.getElementById('quizContainer').classList.remove('hidden');
    document.getElementById('movieTitle').textContent = currentMovie.title;
    
    const poster = document.getElementById('moviePoster');
    if(currentMovie.poster_path) poster.src = "https://image.tmdb.org/t/p/w300" + currentMovie.poster_path;
    else poster.src = "https://placehold.co/300x450/1a1a1a/ff8c00?text=Affiche+Introuvable";

    // Gestion du Budget (on le cache si = 0)
    const budgetGroup = document.getElementById('budgetGroup');
    if(currentMovie.budget && parseInt(currentMovie.budget) > 0) {
        budgetGroup.classList.remove('hidden');
    } else {
        budgetGroup.classList.add('hidden');
    }

    // Réinitialisation de l'interface
    document.querySelectorAll('.input-group input').forEach(input => {
        input.value = '';
        input.classList.remove('correct-field', 'wrong-field', 'almost-field');
        input.disabled = false;
    });
    
    chosenActors = []; // Vider les acteurs
    renderTags(); // Effacer les tags visuels
    
    document.getElementById('validateBtn').classList.remove('hidden');
    document.getElementById('resultArea').classList.add('hidden');
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('correctionArea').innerHTML = '';
}

// 3. Mécanique des Tags Acteurs
function addActorTag(name) {
    if(!name.trim()) return;
    // Vérifier si l'acteur est déjà dans la liste
    if(!chosenActors.some(a => a.toLowerCase() === name.toLowerCase().trim())) {
        chosenActors.push(name.trim());
        renderTags();
    }
    document.getElementById('ans-actor').value = ''; // On vide le champ
}

function renderTags() {
    const container = document.getElementById('actorTags');
    container.innerHTML = '';
    chosenActors.forEach((actor, index) => {
        const span = document.createElement('span');
        span.className = 'actor-tag';
        span.innerHTML = `${actor} <span class="remove-tag">✖</span>`;
        
        span.querySelector('.remove-tag').addEventListener('click', () => {
            if(!document.getElementById('ans-actor').disabled) { // Si le quiz n'est pas encore validé
                chosenActors.splice(index, 1);
                renderTags();
            }
        });
        container.appendChild(span);
    });
}

// 4. Autocomplétion intelligente
function setupAutocomplete(inputId, isTagSystem = false) {
    const input = document.getElementById(inputId);
    const list = document.createElement('ul');
    list.className = 'results-list hidden';
    list.style.zIndex = "1000"; list.style.top = "70px"; 
    input.parentNode.appendChild(list);

    input.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        list.innerHTML = ''; 
        if (query.length < 2) { list.classList.add('hidden'); return; }

        const matches = namesIndex.filter(n => n.toLowerCase().includes(query)).slice(0, 5);
        if (matches.length > 0) {
            list.classList.remove('hidden');
            matches.forEach(name => {
                const li = document.createElement('li');
                li.textContent = name;
                li.addEventListener('click', () => {
                    if(isTagSystem) addActorTag(name);
                    else input.value = name;
                    list.classList.add('hidden');
                });
                list.appendChild(li);
            });
        } else list.classList.add('hidden');
    });

    // Écouter la touche Entrée pour les acteurs
    input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && isTagSystem) {
            e.preventDefault();
            addActorTag(input.value);
            list.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => { if (e.target !== input) list.classList.add('hidden'); });
}

setupAutocomplete('ans-director', false);
setupAutocomplete('ans-actor', true); // True = active le système de tags au clic/entrée

function checkAnswer(userInput, correctAnswersArray) {
    if(!userInput.trim()) return false;
    const user = userInput.toLowerCase().trim();
    return correctAnswersArray.some(ans => ans.toLowerCase().includes(user));
}

// 5. Validation et Calcul des points
document.getElementById('validateBtn').addEventListener('click', () => {
    let score = 0;
    let details = [];

    const iDir = document.getElementById('ans-director');
    const iYear = document.getElementById('ans-year');
    const iBudget = document.getElementById('ans-budget');
    const iActor = document.getElementById('ans-actor');

    // Bloquer les champs
    [iDir, iYear, iBudget, iActor].forEach(i => i.disabled = true);
    document.getElementById('validateBtn').classList.add('hidden');

    // --- Réalisateur (+1 pt)
    if(currentMovie.directors && currentMovie.directors.length > 0) {
        if(checkAnswer(iDir.value, currentMovie.directors)) {
            iDir.classList.add('correct-field'); score++;
            details.push(`<span class="text-green">✅ Réalisateur : +1</span>`);
        } else {
            iDir.classList.add('wrong-field');
            details.push(`❌ Réalisateur : c'était <span class="text-green">${currentMovie.directors.join(', ')}</span>`);
        }
    }

    // --- Année (+1 pt)
    if(currentMovie.release_date && currentMovie.release_date !== "Inconnue") {
        const realYear = currentMovie.release_date.split('-')[0];
        if(iYear.value.trim() === realYear) {
            iYear.classList.add('correct-field'); score++;
            details.push(`<span class="text-green">✅ Année : +1</span>`);
        } else {
            iYear.classList.add('wrong-field');
            details.push(`❌ Année : c'était <span class="text-green">${realYear}</span>`);
        }
    }

    // --- Budget (+1 pt)
    if(currentMovie.budget && parseInt(currentMovie.budget) > 0) {
        const realBudget = parseInt(currentMovie.budget);
        const userBudget = parseInt(iBudget.value) || 0;
        const diffPercent = Math.abs(userBudget - realBudget) / realBudget;

        if(diffPercent <= 0.03) { // 3% -> Exact
            iBudget.classList.add('correct-field'); score++;
            details.push(`<span class="text-green">✅ Budget EXACT : +1</span>`);
        } else if(diffPercent <= 0.10) { // 10% -> Presque
            iBudget.classList.add('almost-field'); score++;
            details.push(`<span style="color: #ffc107;">⚠️ Budget (presque) : +1 (C'était ${realBudget.toLocaleString()}$)</span>`);
        } else {
            iBudget.classList.add('wrong-field');
            details.push(`❌ Budget : c'était <span class="text-green">${realBudget.toLocaleString()}$</span>`);
        }
    }

    // --- Acteurs (+1/-1 par tag)
    let validActors = currentMovie.actors || [];
    let actorScore = 0;
    
    // On met à jour visuellement les tags
    const tagElements = document.querySelectorAll('.actor-tag');
    chosenActors.forEach((actor, index) => {
        if(checkAnswer(actor, validActors)) {
            tagElements[index].classList.add('correct');
            actorScore++;
        } else {
            tagElements[index].classList.add('wrong');
            actorScore--;
        }
    });

    score += actorScore;
    
    if (chosenActors.length > 0) {
        let color = actorScore > 0 ? "text-green" : (actorScore < 0 ? "wrong-field" : "");
        details.push(`<span class="${color}">🎭 Acteurs : ${actorScore > 0 ? '+' : ''}${actorScore} point(s)</span>`);
    } else {
        details.push(`❌ Aucun acteur renseigné.`);
    }
    
    details.push(`Casting principal : <span class="text-green">${validActors.slice(0,5).join(', ')}</span>`);

    // --- Affichage final
    document.getElementById('resultArea').classList.remove('hidden');
    document.getElementById('scoreText').textContent = `Score Total : ${score} pt(s)`;
    document.getElementById('correctionArea').innerHTML = details.map(d => `<p>${d}</p>`).join('');
    
    document.getElementById('nextBtn').classList.remove('hidden');
});

document.getElementById('nextBtn').addEventListener('click', () => {
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('homeMenu').classList.remove('hidden');
});