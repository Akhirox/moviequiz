// ==========================================
// ETAT GLOBAL DU JEU
// ==========================================
let searchIndex = [];
let namesIndex = [];
let titlesIndex = []; // Pour l'autocomplétion des titres

let sessionMovies = [];
let currentRound = 0;
let currentMovie = null;
let totalScore = 0;
let maxPossibleScore = 0; // Calculé dynamiquement selon les infos dispos
let selectedMode = ''; // 'fill', 'guess', 'pixel'

let chosenActors = [];
let pixelInterval;
let currentPixelScale = 0.01;
const API_KEY = "5dc5083a717529577dfea77fd9a4a0e0";

// ==========================================
// 1. INITIALISATION & NAVIGATION
// ==========================================
Promise.all([
    fetch('api/search_index.json').then(r => r.json()),
    fetch('api/names.json').then(r => r.json())
]).then(([searchData, namesData]) => {
    searchIndex = searchData;
    namesIndex = namesData;
    // On extrait tous les titres uniques pour l'autocomplétion Mode Guess & Pixel
    titlesIndex = [...new Set(searchIndex.map(m => m.title))]; 
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

document.querySelectorAll('.go-home-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        clearInterval(pixelInterval);
        showScreen('screen-home');
    });
});
document.getElementById('mainTitle').addEventListener('click', () => {
    clearInterval(pixelInterval);
    showScreen('screen-home');
});

// Choix du Mode
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedMode = e.target.dataset.mode;
        showScreen('screen-difficulty');
    });
});

// Choix de la Difficulté -> Lancement de la Session
document.querySelectorAll('.btn-diff').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const min = parseInt(e.target.dataset.min);
        const max = parseInt(e.target.dataset.max);
        startSession(min, max);
    });
});

// ==========================================
// 2. GESTION DE LA SESSION (10 Rounds)
// ==========================================
function startSession(minVotes, maxVotes) {
    let pool = searchIndex.filter(m => m.votes >= minVotes && m.votes <= maxVotes);
    if (pool.length < 10) pool = searchIndex; // Sécurité si pas assez de films
    
    // Mélanger le pool et prendre 10 films
    pool = pool.sort(() => 0.5 - Math.random());
    sessionMovies = pool.slice(0, 10);
    
    currentRound = 0;
    totalScore = 0;
    maxPossibleScore = 0;
    
    playNextRound();
}

function playNextRound() {
    if (currentRound >= 10) {
        showRecap();
        return;
    }
    
    const movieMeta = sessionMovies[currentRound];
    currentRound++;
    document.getElementById('roundNumber').textContent = currentRound;
    
    fetch(`api/movies/${movieMeta.id}.json`)
        .then(response => response.json())
        .then(movie => {
            currentMovie = movie;
            setupGameUI();
        });
}

// ==========================================
// 3. PRÉPARATION DE L'INTERFACE DE JEU
// ==========================================
function setupGameUI() {
    showScreen('screen-game');
    document.querySelectorAll('.game-variant').forEach(v => v.classList.add('hidden'));
    document.getElementById('roundResult').classList.add('hidden');
    document.getElementById('validateBtn').classList.remove('hidden');
    
    const poster = document.getElementById('moviePoster');
    const title = document.getElementById('movieTitle');
    
    // Reset général des inputs
    document.querySelectorAll('.input-group input').forEach(input => {
        input.value = '';
        input.classList.remove('correct-field', 'wrong-field', 'almost-field');
        input.disabled = false;
    });

    if (selectedMode === 'fill') {
        document.getElementById('game-fill').classList.remove('hidden');
        title.style.display = 'block';
        title.textContent = currentMovie.title;
        loadPoster(poster, true);
        
        const budgetGroup = document.getElementById('budgetGroup');
        if(currentMovie.budget && parseInt(currentMovie.budget) > 0) budgetGroup.classList.remove('hidden');
        else budgetGroup.classList.add('hidden');
        
        chosenActors = []; 
        renderTags();
        
    } else if (selectedMode === 'guess') {
        document.getElementById('game-guess').classList.remove('hidden');
        title.style.display = 'none'; // On cache le titre !
        poster.src = "https://placehold.co/300x450/1a1a1a/ff8c00?text=Affiche+Masquée"; // On cache l'affiche !
        
        document.getElementById('guess-dir-clue').textContent = currentMovie.directors.join(', ') || "?";
        document.getElementById('guess-cast-clue').textContent = currentMovie.actors.join(', ') || "?";
        document.getElementById('guess-year-clue').textContent = currentMovie.release_date !== "Inconnue" ? currentMovie.release_date.split('-')[0] : "?";
        document.getElementById('guess-genre-clue').textContent = currentMovie.genres.join(', ') || "?";
        
    } else if (selectedMode === 'pixel') {
        document.getElementById('game-pixel').classList.remove('hidden');
        title.style.display = 'none';
        poster.style.display = 'none'; // On utilise le canvas
        document.getElementById('validateBtn').classList.add('hidden'); // Géré en temps réel
        startPixelAnimation();
    }
}

function loadPoster(imgElement, showReal) {
    if(!showReal) return;
    imgElement.style.display = 'inline';
    fetch(`https://api.themoviedb.org/3/movie/${currentMovie.id}?api_key=${API_KEY}&language=fr-FR`)
        .then(response => response.json())
        .then(data => {
            if (data.poster_path) imgElement.src = "https://image.tmdb.org/t/p/w300" + data.poster_path;
            else imgElement.src = "https://placehold.co/300x450/1a1a1a/ff8c00?text=Introuvable";
        }).catch(() => imgElement.src = "https://placehold.co/300x450/1a1a1a/ff8c00?text=Introuvable");
}

// ==========================================
// 4. VALIDATION GÉNÉRALE
// ==========================================
document.getElementById('validateBtn').addEventListener('click', () => {
    document.getElementById('validateBtn').classList.add('hidden');
    let roundPoints = 0;
    let roundMax = 0;
    let details = [];

    if (selectedMode === 'fill') {
        const iDir = document.getElementById('fill-director');
        const iYear = document.getElementById('fill-year');
        const iBudget = document.getElementById('fill-budget');
        const iActor = document.getElementById('fill-actor');
        [iDir, iYear, iBudget, iActor].forEach(i => i.disabled = true);

        // Dir
        if(currentMovie.directors && currentMovie.directors.length > 0) {
            roundMax += 1;
            if(checkAnswer(iDir.value, currentMovie.directors)) { iDir.classList.add('correct-field'); roundPoints++; details.push(`✅ Réalisateur : +1`); }
            else { iDir.classList.add('wrong-field'); details.push(`❌ Réal : c'était <span class="text-green">${currentMovie.directors.join(', ')}</span>`); }
        }
        // Year
        if(currentMovie.release_date && currentMovie.release_date !== "Inconnue") {
            roundMax += 1;
            const realYear = currentMovie.release_date.split('-')[0];
            if(iYear.value.trim() === realYear) { iYear.classList.add('correct-field'); roundPoints++; details.push(`✅ Année : +1`); }
            else { iYear.classList.add('wrong-field'); details.push(`❌ Année : c'était <span class="text-green">${realYear}</span>`); }
        }
        // Budget
        if(currentMovie.budget && parseInt(currentMovie.budget) > 0) {
            roundMax += 1;
            const realBudget = parseInt(currentMovie.budget);
            const userBudgetMillions = parseFloat(iBudget.value) || 0;
            const userBudget = userBudgetMillions * 1000000;
            const diffPercent = Math.abs(userBudget - realBudget) / realBudget;

            if(diffPercent <= 0.03) { iBudget.classList.add('correct-field'); roundPoints++; details.push(`✅ Budget EXACT : +1`); }
            else if(diffPercent <= 0.10) { iBudget.classList.add('almost-field'); roundPoints++; details.push(`⚠️ Budget (presque) : +1 (C'était ${(realBudget/1000000).toFixed(1)} M$)`); }
            else { iBudget.classList.add('wrong-field'); details.push(`❌ Budget : c'était <span class="text-green">${(realBudget/1000000).toFixed(1)} M$</span>`); }
        }
        // Actors
        let validActors = currentMovie.actors || [];
        if(validActors.length > 0) {
            roundMax += validActors.length > 5 ? 5 : validActors.length; // Max théorique arbitraire de 5 pour les acteurs
            let actorScore = 0;
            const tagElements = document.querySelectorAll('.actor-tag');
            chosenActors.forEach((actor, index) => {
                if(checkAnswer(actor, validActors)) { tagElements[index].classList.add('correct'); actorScore++; }
                else { tagElements[index].classList.add('wrong'); actorScore--; }
            });
            roundPoints += actorScore;
            details.push(`🎭 Acteurs : ${actorScore > 0 ? '+' : ''}${actorScore} pt(s). (Casting : <span class="text-green">${validActors.slice(0,5).join(', ')}</span>)`);
        }

    } else if (selectedMode === 'guess') {
        roundMax = 1;
        const iGuess = document.getElementById('guess-title');
        iGuess.disabled = true;
        if(iGuess.value.toLowerCase().trim() === currentMovie.title.toLowerCase().trim()) {
            iGuess.classList.add('correct-field'); roundPoints++;
            details.push(`✅ Bien joué !`);
        } else {
            iGuess.classList.add('wrong-field');
            details.push(`❌ Faux ! C'était <span class="text-green">${currentMovie.title}</span>`);
        }
        loadPoster(document.getElementById('moviePoster'), true); // On dévoile l'affiche !
        document.getElementById('movieTitle').style.display = 'block';
        document.getElementById('movieTitle').textContent = currentMovie.title;
    }

    // Mise à jour Score
    totalScore += roundPoints;
    maxPossibleScore += roundMax;
    
    // Affichage résultat Round
    const res = document.getElementById('roundResult');
    res.classList.remove('hidden');
    document.getElementById('roundScoreText').textContent = `Points gagnés : ${roundPoints}`;
    document.getElementById('roundCorrection').innerHTML = details.map(d => `<p>${d}</p>`).join('');
    
    if(currentRound >= 10) document.getElementById('nextRoundBtn').textContent = "🏆 Voir le score final";
    else document.getElementById('nextRoundBtn').textContent = "🍿 Film Suivant";
});

document.getElementById('nextRoundBtn').addEventListener('click', playNextRound);

// ==========================================
// 5. AUTOCOMPLÉTION & TAGS
// ==========================================
function checkAnswer(userInput, correctAnswersArray) {
    if(!userInput.trim()) return false;
    const user = userInput.toLowerCase().trim();
    return correctAnswersArray.some(ans => ans.toLowerCase().includes(user));
}

function addActorTag(name) {
    if(!name.trim()) return;
    if(!chosenActors.some(a => a.toLowerCase() === name.toLowerCase().trim())) {
        chosenActors.push(name.trim()); renderTags();
    }
    document.getElementById('fill-actor').value = ''; 
}

function renderTags() {
    const container = document.getElementById('actorTags');
    container.innerHTML = '';
    chosenActors.forEach((actor, index) => {
        const span = document.createElement('span');
        span.className = 'actor-tag';
        span.innerHTML = `${actor} <span class="remove-tag">✖</span>`;
        span.querySelector('.remove-tag').addEventListener('click', () => {
            if(!document.getElementById('fill-actor').disabled) {
                chosenActors.splice(index, 1); renderTags();
            }
        });
        container.appendChild(span);
    });
}

function setupAutocomplete(inputId, dataSource, isTagSystem = false) {
    const input = document.getElementById(inputId);
    const list = document.createElement('ul');
    list.className = 'results-list hidden';
    list.style.zIndex = "1000"; list.style.top = "70px"; 
    input.parentNode.appendChild(list);

    input.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        list.innerHTML = ''; 
        if (query.length < 2) { list.classList.add('hidden'); return; }

        const matches = dataSource.filter(n => n.toLowerCase().includes(query)).slice(0, 5);
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

    input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            if(isTagSystem) addActorTag(input.value);
            list.classList.add('hidden');
        }
    });
    document.addEventListener('click', (e) => { if (e.target !== input) list.classList.add('hidden'); });
}

setupAutocomplete('fill-director', namesIndex, false);
setupAutocomplete('fill-actor', namesIndex, true);
setupAutocomplete('guess-title', titlesIndex, false);
setupAutocomplete('pixel-title', titlesIndex, false);

// ==========================================
// 6. MODE AFFICHE MYSTÈRE (PIXEL)
// ==========================================
let pixelCanvas = document.getElementById('pixelCanvas');
let ctx = pixelCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function startPixelAnimation() {
    clearInterval(pixelInterval);
    currentPixelScale = 0.01; 
    
    const titleInput = document.getElementById('pixel-title');
    titleInput.disabled = false;
    titleInput.focus();

    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    fetch(`https://api.themoviedb.org/3/movie/${currentMovie.id}?api_key=${API_KEY}&language=fr-FR`)
        .then(response => response.json())
        .then(data => {
            if (data.poster_path) img.src = "https://image.tmdb.org/t/p/w300" + data.poster_path;
            else { playNextRound(); return; } // Si pas d'affiche, on skip ce round
        }).catch(() => playNextRound());

    img.onload = () => {
        pixelInterval = setInterval(() => {
            currentPixelScale += 0.01;
            if (currentPixelScale >= 1) {
                currentPixelScale = 1;
                clearInterval(pixelInterval);
                finishPixelRound(false); // Temps écoulé
            }
            drawPixelated(img, currentPixelScale);
        }, 300);
    };
}

function drawPixelated(image, scale) {
    const scaledW = pixelCanvas.width * scale;
    const scaledH = pixelCanvas.height * scale;
    ctx.drawImage(image, 0, 0, scaledW, scaledH);
    ctx.drawImage(pixelCanvas, 0, 0, scaledW, scaledH, 0, 0, pixelCanvas.width, pixelCanvas.height);
}

document.getElementById('pixel-title').addEventListener('input', function() {
    if (this.value.toLowerCase().trim() === currentMovie.title.toLowerCase().trim()) {
        finishPixelRound(true);
    }
});

function finishPixelRound(won) {
    clearInterval(pixelInterval);
    const titleInput = document.getElementById('pixel-title');
    titleInput.disabled = true;
    
    // Dévoilement net
    const img = new Image();
    img.crossOrigin = "Anonymous";
    fetch(`https://api.themoviedb.org/3/movie/${currentMovie.id}?api_key=${API_KEY}&language=fr-FR`)
        .then(r => r.json()).then(d => { img.src = "https://image.tmdb.org/t/p/w300" + d.poster_path; });
    img.onload = () => drawPixelated(img, 1);

    let roundPoints = 0;
    let details = [];
    maxPossibleScore += 1000;

    if(won) {
        titleInput.classList.add('correct-field');
        roundPoints = Math.round((1 - currentPixelScale) * 1000);
        details.push(`✅ Bien vu ! C'était <span class="text-green">${currentMovie.title}</span>`);
    } else {
        titleInput.classList.add('wrong-field');
        details.push(`❌ Trop tard ! C'était <span class="text-green">${currentMovie.title}</span>`);
    }

    totalScore += roundPoints;

    const res = document.getElementById('roundResult');
    res.classList.remove('hidden');
    document.getElementById('roundScoreText').textContent = `Points gagnés : ${roundPoints}`;
    document.getElementById('roundCorrection').innerHTML = details.map(d => `<p>${d}</p>`).join('');
    
    if(currentRound >= 10) document.getElementById('nextRoundBtn').textContent = "🏆 Voir le score final";
    else document.getElementById('nextRoundBtn').textContent = "🍿 Affiche Suivante";
}

// ==========================================
// 7. ÉCRAN DE FIN DE PARTIE
// ==========================================
function showRecap() {
    showScreen('screen-recap');
    document.getElementById('finalScoreText').textContent = `${totalScore} / ${maxPossibleScore}`;
    
    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    let msg = "";
    
    if (percentage > 80) msg = "Incroyable ! Tu es un vrai cinéphile 🍿👑";
    else if (percentage > 50) msg = "Pas mal du tout ! Encore quelques classiques à voir 🎥";
    else msg = "Aïe... Il va falloir reprendre un abonnement au cinéma 🎬";
    
    document.getElementById('finalMessage').textContent = msg;
}