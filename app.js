// ==========================================
// ETAT GLOBAL DU JEU
// ==========================================
let searchIndex = [];
let namesIndex = [];
let titlesIndex = [];

let sessionMovies = [];
let currentRound = 0;
let currentMovie = null;
let totalScore = 0;
let maxPossibleScore = 0;
let selectedMode = '';

let chosenActors = [];
const API_KEY = "5dc5083a717529577dfea77fd9a4a0e0";

// Variables spécifiques au Mode Pixel
let pixelTimerInterval;
let pixelTimeLeft = 60;
let currentPixelLevel = 0;
let currentPixelImage = null; // Stocke l'image brute pour pouvoir la redessiner
// Les 10 paliers de netteté (de 10 pts à 1 pt)
const pixelScales = [0.015, 0.025, 0.04, 0.06, 0.09, 0.13, 0.20, 0.35, 0.60, 1.0];

// ==========================================
// 1. INITIALISATION
// ==========================================
Promise.all([
    fetch('api/search_index.json').then(r => r.json()),
    fetch('api/names.json').then(r => r.json())
]).then(([searchData, namesData]) => {
    searchIndex = searchData;
    namesIndex = namesData;
    titlesIndex = [...new Set(searchIndex.map(m => m.title))]; 
    console.log("Données prêtes :", searchIndex.length, "films chargés.");
}).catch(err => {
    console.error("Erreur de chargement des JSON :", err);
    alert("Erreur de chargement des données. Le jeu ne pourra pas se lancer.");
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

document.querySelectorAll('.go-home-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        clearInterval(pixelTimerInterval);
        showScreen('screen-home');
    });
});
document.getElementById('mainTitle').addEventListener('click', () => {
    clearInterval(pixelTimerInterval);
    showScreen('screen-home');
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedMode = e.currentTarget.dataset.mode;
        showScreen('screen-difficulty');
    });
});

document.querySelectorAll('.btn-diff').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (searchIndex.length === 0) {
            alert("Les films sont encore en cours de chargement, patiente une seconde !");
            return;
        }
        const min = parseInt(e.currentTarget.dataset.min);
        const max = parseInt(e.currentTarget.dataset.max);
        startSession(min, max);
    });
});

// ==========================================
// 2. GESTION DE LA SESSION
// ==========================================
function startSession(minVotes, maxVotes) {
    let pool = searchIndex.filter(m => m.votes >= minVotes && m.votes <= maxVotes);
    if (pool.length < 10) pool = searchIndex; 
    
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
        })
        .catch(err => {
            console.error("Erreur de chargement", err);
            playNextRound(); 
        });
}

// ==========================================
// 3. PRÉPARATION DE L'INTERFACE
// ==========================================
function setupGameUI() {
    showScreen('screen-game');
    document.querySelectorAll('.game-variant').forEach(v => v.classList.add('hidden'));
    document.getElementById('roundResult').classList.add('hidden');
    document.getElementById('validateBtn').classList.remove('hidden'); 
    
    const poster = document.getElementById('moviePoster');
    const title = document.getElementById('movieTitle');
    
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
        title.style.display = 'none'; 
        poster.src = "https://placehold.co/300x450/1a1a1a/ff8c00?text=Affiche+Masquée"; 
        
        document.getElementById('guess-dir-clue').textContent = currentMovie.directors.join(', ') || "?";
        document.getElementById('guess-cast-clue').textContent = currentMovie.actors.join(', ') || "?";
        document.getElementById('guess-year-clue').textContent = currentMovie.release_date !== "Inconnue" ? currentMovie.release_date.split('-')[0] : "?";
        document.getElementById('guess-genre-clue').textContent = currentMovie.genres.join(', ') || "?";
        
    } else if (selectedMode === 'pixel') {
        document.getElementById('game-pixel').classList.remove('hidden');
        title.style.display = 'none';
        poster.style.display = 'none'; 
        startPixelGame();
    }
}

// Plus de &language=fr-FR : on veut les affiches originales !
function loadPoster(imgElement, showReal) {
    if(!showReal) return;
    imgElement.style.display = 'inline';
    fetch(`https://api.themoviedb.org/3/movie/${currentMovie.id}?api_key=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            if (data.poster_path) imgElement.src = "https://image.tmdb.org/t/p/w300" + data.poster_path;
            else imgElement.src = "https://placehold.co/300x450/1a1a1a/ff8c00?text=Introuvable";
        }).catch(() => imgElement.src = "https://placehold.co/300x450/1a1a1a/ff8c00?text=Introuvable");
}

// ==========================================
// 4. VALIDATION GLOBALE
// ==========================================
document.getElementById('validateBtn').addEventListener('click', () => {
    document.getElementById('validateBtn').classList.add('hidden');
    let roundPoints = 0;
    let roundMax = 0;
    let details = [];

    // --- MODE PIXEL ---
    if (selectedMode === 'pixel') {
        const iPixel = document.getElementById('pixel-title');
        if(iPixel.value.toLowerCase().trim() === currentMovie.title.toLowerCase().trim()) {
            finishPixelRound(true);
        } else {
            finishPixelRound(false); 
        }
        return; 
    }

    // --- MODE FILL ---
    if (selectedMode === 'fill') {
        const iDir = document.getElementById('fill-director');
        const iYear = document.getElementById('fill-year');
        const iBudget = document.getElementById('fill-budget');
        const iActor = document.getElementById('fill-actor');
        [iDir, iYear, iBudget, iActor].forEach(i => i.disabled = true);

        if(currentMovie.directors && currentMovie.directors.length > 0) {
            roundMax += 1;
            if(checkAnswer(iDir.value, currentMovie.directors)) { iDir.classList.add('correct-field'); roundPoints++; details.push(`✅ Réalisateur : +1`); }
            else { iDir.classList.add('wrong-field'); details.push(`❌ Réal : c'était <span class="text-green">${currentMovie.directors.join(', ')}</span>`); }
        }
        if(currentMovie.release_date && currentMovie.release_date !== "Inconnue") {
            roundMax += 1;
            const realYear = currentMovie.release_date.split('-')[0];
            if(iYear.value.trim() === realYear) { iYear.classList.add('correct-field'); roundPoints++; details.push(`✅ Année : +1`); }
            else { iYear.classList.add('wrong-field'); details.push(`❌ Année : c'était <span class="text-green">${realYear}</span>`); }
        }
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
        let validActors = currentMovie.actors || [];
        if(validActors.length > 0) {
            roundMax += validActors.length > 5 ? 5 : validActors.length; 
            let actorScore = 0;
            const tagElements = document.querySelectorAll('.actor-tag');
            chosenActors.forEach((actor, index) => {
                if(checkAnswer(actor, validActors)) { tagElements[index].classList.add('correct'); actorScore++; }
                else { tagElements[index].classList.add('wrong'); actorScore--; }
            });
            roundPoints += actorScore;
            details.push(`🎭 Acteurs : ${actorScore > 0 ? '+' : ''}${actorScore} pt(s). (Casting : <span class="text-green">${validActors.slice(0,5).join(', ')}</span>)`);
        }
    } 
    // --- MODE GUESS ---
    else if (selectedMode === 'guess') {
        roundMax = 10;
        const iGuess = document.getElementById('guess-title');
        iGuess.disabled = true;
        if(iGuess.value.toLowerCase().trim() === currentMovie.title.toLowerCase().trim()) {
            iGuess.classList.add('correct-field'); roundPoints += 10;
            details.push(`✅ Bien joué ! (+10 pts)`);
        } else {
            iGuess.classList.add('wrong-field');
            details.push(`❌ Faux ! C'était <span class="text-green">${currentMovie.title}</span>`);
        }
        loadPoster(document.getElementById('moviePoster'), true); 
        document.getElementById('movieTitle').style.display = 'block';
        document.getElementById('movieTitle').textContent = currentMovie.title;
    }

    totalScore += roundPoints;
    maxPossibleScore += roundMax;
    
    const res = document.getElementById('roundResult');
    res.classList.remove('hidden');
    document.getElementById('roundScoreText').textContent = `Points gagnés : ${roundPoints}`;
    document.getElementById('roundCorrection').innerHTML = details.map(d => `<p>${d}</p>`).join('');
    
    if(currentRound >= 10) document.getElementById('nextRoundBtn').textContent = "🏆 Voir le score final";
    else document.getElementById('nextRoundBtn').textContent = "🍿 Film Suivant";
});

document.getElementById('nextRoundBtn').addEventListener('click', playNextRound);

['guess-title', 'pixel-title'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', function(e) {
        if(e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('validateBtn').click();
        }
    });
});

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

function setupAutocomplete(inputId, listType, isTagSystem = false) {
    const input = document.getElementById(inputId);
    const list = document.createElement('ul');
    list.className = 'results-list hidden';
    list.style.zIndex = "1000"; list.style.top = "70px"; 
    input.parentNode.appendChild(list);

    input.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        list.innerHTML = ''; 
        if (query.length < 2) { list.classList.add('hidden'); return; }

        let currentData = listType === 'names' ? namesIndex : titlesIndex;
        const matches = currentData.filter(n => n.toLowerCase().includes(query)).slice(0, 5);
        
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
        if(e.key === 'Enter' && isTagSystem) {
            e.preventDefault();
            addActorTag(input.value);
            list.classList.add('hidden');
        }
    });
    document.addEventListener('click', (e) => { if (e.target !== input) list.classList.add('hidden'); });
}

setupAutocomplete('fill-director', 'names', false);
setupAutocomplete('fill-actor', 'names', true);
setupAutocomplete('guess-title', 'titles', false);
setupAutocomplete('pixel-title', 'titles', false);

// ==========================================
// 6. MODE AFFICHE MYSTÈRE (PIXEL MANUEL)
// ==========================================
let pixelCanvas = document.getElementById('pixelCanvas');
let ctx = pixelCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function startPixelGame() {
    clearInterval(pixelTimerInterval);
    pixelTimeLeft = 60;
    currentPixelLevel = 0;
    
    // Réinitialisation de l'UI
    const titleInput = document.getElementById('pixel-title');
    titleInput.disabled = false;
    titleInput.value = '';
    titleInput.focus();
    
    document.getElementById('pixelTimer').textContent = `⏱️ ${pixelTimeLeft}s`;
    document.getElementById('pixelTimer').style.color = "#dc3545";
    document.getElementById('pixelPoints').textContent = `🏆 10 pts`;
    
    const btnEnhance = document.getElementById('enhanceBtn');
    btnEnhance.disabled = false;
    btnEnhance.innerText = "🔍 ENHANCE ! (-1 pt)";

    currentPixelImage = new Image();
    currentPixelImage.crossOrigin = "Anonymous";
    
    fetch(`https://api.themoviedb.org/3/movie/${currentMovie.id}?api_key=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            if (data.poster_path) {
                // Astuce Cache Buster pour éviter l'erreur CORS
                currentPixelImage.src = "https://image.tmdb.org/t/p/w300" + data.poster_path + "?t=" + new Date().getTime();
            }
            else { playNextRound(); return; } 
        }).catch(() => playNextRound());

    currentPixelImage.onload = () => {
        // Premier affichage hyper pixelisé (Level 0)
        drawPixelated(currentPixelImage, pixelScales[currentPixelLevel]);

        // Lancement du chrono manuel (1 tick par seconde)
        pixelTimerInterval = setInterval(() => {
            pixelTimeLeft--;
            document.getElementById('pixelTimer').textContent = `⏱️ ${pixelTimeLeft}s`;
            
            if(pixelTimeLeft <= 10) document.getElementById('pixelTimer').style.color = "#ff0000";

            if (pixelTimeLeft <= 0) {
                finishPixelRound(false); // Temps écoulé !
            }
        }, 1000); 
    };
    
    currentPixelImage.onerror = () => {
        console.warn("L'image n'a pas pu être chargée, passage au film suivant.");
        playNextRound();
    };
}

function drawPixelated(image, scale) {
    const scaledW = pixelCanvas.width * scale;
    const scaledH = pixelCanvas.height * scale;
    ctx.drawImage(image, 0, 0, scaledW, scaledH);
    ctx.drawImage(pixelCanvas, 0, 0, scaledW, scaledH, 0, 0, pixelCanvas.width, pixelCanvas.height);
}

// Clic sur le bouton ENHANCE
document.getElementById('enhanceBtn').addEventListener('click', () => {
    // Si on n'est pas encore au niveau max (9)
    if (currentPixelLevel < 9 && currentPixelImage) {
        currentPixelLevel++;
        const currentPoints = 10 - currentPixelLevel;
        
        document.getElementById('pixelPoints').textContent = `🏆 ${currentPoints} pts`;
        drawPixelated(currentPixelImage, pixelScales[currentPixelLevel]);
        
        // Si on atteint le max, on bloque le bouton
        if (currentPixelLevel === 9) {
            document.getElementById('enhanceBtn').disabled = true;
            document.getElementById('enhanceBtn').innerText = "Max Resolution !";
        }
    }
});

function finishPixelRound(won) {
    clearInterval(pixelTimerInterval);
    
    const titleInput = document.getElementById('pixel-title');
    titleInput.disabled = true;
    document.getElementById('enhanceBtn').disabled = true;
    
    // On force l'affichage HD
    if(currentPixelImage) drawPixelated(currentPixelImage, 1);

    let roundPoints = 0;
    let details = [];
    maxPossibleScore += 10; 

    if(won) {
        titleInput.classList.add('correct-field');
        roundPoints = 10 - currentPixelLevel; // Les points dépendent du nombre de clics
        details.push(`✅ Bien vu !`);
    } else {
        titleInput.classList.add('wrong-field');
        if (pixelTimeLeft <= 0) {
            details.push(`❌ Temps écoulé (60s) !`);
        } else {
            details.push(`❌ Mauvaise réponse !`);
        }
        roundPoints = 0;
    }
    
    details.push(`C'était : <span class="text-green">${currentMovie.title}</span>`);
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