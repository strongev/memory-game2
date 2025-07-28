// Game state variables
let gameState = {
    cards: [],
    flippedCards: [],
    matchedPairs: 0,
    moves: 0,
    timer: 0,
    isGameActive: false,
    timerInterval: null,
    currentPlayer: {
        nickname: '',
        email: '',
        attempt: 1
    }
};

// Google Apps Script endpoint
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzSCuAnhGBYzVRoKEgVJaahxGoi6u_a_8RFbMifaizYugkucOykLCa0gc8B_c25Gsifbg/exec';

// Card types (8 pairs for 4x4 grid)
const CARD_TYPES = [
    '1', '2', '3', '4',
    '5', '6', '7', '8'
];

// DOM elements
const elements = {
    leaderboardSection: document.getElementById('leaderboard-section'),
    startSection: document.getElementById('start-section'),
    gameSection: document.getElementById('game-section'),
    startForm: document.getElementById('start-form'),
    gameGrid: document.getElementById('game-grid'),
    timer: document.getElementById('timer'),
    moves: document.getElementById('moves'),
    leaderboardLoading: document.getElementById('leaderboard-loading'),
    leaderboardTable: document.getElementById('leaderboard-table'),
    leaderboardBody: document.getElementById('leaderboard-body'),
    gameCompleteModal: document.getElementById('game-complete-modal'),
    loadingOverlay: document.getElementById('loading-overlay'),
    backToMenu: document.getElementById('back-to-menu'),
    tryAgain: document.getElementById('try-again'),
    backToLeaderboard: document.getElementById('back-to-leaderboard'),
    finalTime: document.getElementById('final-time'),
    finalMoves: document.getElementById('final-moves'),
    attemptNumber: document.getElementById('attempt-number')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Memory Game initialized');
    
    // Load leaderboard on page load
    loadLeaderboard();
    
    // Setup event listeners
    setupEventListeners();
});

/**
 * Setup all event listeners for the game
 */
function setupEventListeners() {
    // Start form submission
    elements.startForm.addEventListener('submit', handleStartGame);
    
    // Navigation buttons
    elements.backToMenu.addEventListener('click', showStartScreen);
    elements.tryAgain.addEventListener('click', handleTryAgain);
    elements.backToLeaderboard.addEventListener('click', handleBackToLeaderboard);
    
    // Prevent form submission on Enter key in game
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && gameState.isGameActive) {
            e.preventDefault();
        }
    });
}

/**
 * Load and display leaderboard from Google Sheets
 */
async function loadLeaderboard() {
    try {
        console.log('Loading leaderboard...');
        elements.leaderboardLoading.textContent = 'Завантаження...';
        elements.leaderboardTable.style.display = 'none';
        
        const response = await fetch(`${GAS_ENDPOINT}?action=getLeaderboard`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Leaderboard data received:', data);
        
        displayLeaderboard(data.leaderboard || []);
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        elements.leaderboardLoading.textContent = 'Помилка завантаження таблиці лідерів';
    }
}

/**
 * Display leaderboard data in the table
 */
function displayLeaderboard(leaderboardData) {
    elements.leaderboardLoading.style.display = 'none';
    elements.leaderboardTable.style.display = 'table';
    
    const tbody = elements.leaderboardBody;
    tbody.innerHTML = '';
    
    if (leaderboardData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Поки що немає результатів</td></tr>';
        return;
    }
    
    // Display top 10 results
    leaderboardData.slice(0, 10).forEach((player, index) => {
        const row = document.createElement('tr');
        
        // Add special styling for top 3
        if (index < 3) {
            row.classList.add(`rank-${index + 1}`);
        }
        
        // Format time display
        const timeDisplay = formatTime(player.seconds);
        
        // Add medal emoji for top 3
        let rankDisplay = index + 1;
        if (index === 0) rankDisplay = '🏆';
        else if (index === 1) rankDisplay = '🥈';
        else if (index === 2) rankDisplay = '🥉';
        
        row.innerHTML = `
            <td>${rankDisplay}</td>
            <td>${escapeHtml(player.nickname)}</td>
            <td>${timeDisplay}</td>
            <td>${player.tries}</td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * Handle start game form submission
 */
function handleStartGame(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const nickname = formData.get('nickname').trim();
    const email = formData.get('email').trim();
    
    // Validate input
    if (!nickname || nickname.length < 2) {
        alert('Будь ласка, введіть нікнейм (мінімум 2 символи)');
        return;
    }
    
    if (!email || !isValidEmail(email)) {
        alert('Будь ласка, введіть дійсну email адресу');
        return;
    }
    
    // Store player info and get attempt number
    gameState.currentPlayer.nickname = nickname;
    gameState.currentPlayer.email = email;
    
    // Get attempt number from localStorage
    const playerKey = `${nickname}_${email}`;
    const storedAttempt = localStorage.getItem(playerKey);
    gameState.currentPlayer.attempt = storedAttempt ? parseInt(storedAttempt) + 1 : 1;
    localStorage.setItem(playerKey, gameState.currentPlayer.attempt.toString());
    
    console.log('Starting game for:', gameState.currentPlayer);
    
    // Start the game
    startGame();
}

/**
 * Initialize and start a new game
 */
function startGame() {
    console.log('Initializing new game...');
    
    // Reset game state
    gameState.moves = 0;
    gameState.timer = 0;
    gameState.matchedPairs = 0;
    gameState.flippedCards = [];
    gameState.isGameActive = true;
    
    // Update UI
    elements.moves.textContent = '0';
    elements.timer.textContent = '0с';
    
    // Generate and shuffle cards
    generateCards();
    
    // Show game section
    showGameScreen();
    
    // Start timer
    startTimer();
}

/**
 * Generate and shuffle cards for the game grid
 */
function generateCards() {
    console.log('Generating and shuffling cards...');
    
    // Create pairs of cards
    const cardPairs = [];
    CARD_TYPES.forEach(cardType => {
        cardPairs.push(cardType, cardType); // Add each card type twice
    });
    
    // Shuffle the cards using Fisher-Yates algorithm
    gameState.cards = shuffleArray(cardPairs);
    
    // Create card elements
    const gameGrid = elements.gameGrid;
    gameGrid.innerHTML = '';
    
    gameState.cards.forEach((cardType, index) => {
        const cardElement = createCardElement(cardType, index);
        gameGrid.appendChild(cardElement);
    });
}

/**
 * Create a single card element
 */
function createCardElement(cardType, index) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.cardType = cardType;
    card.dataset.cardIndex = index;
    
    card.innerHTML = `
        <div class="card-inner">
            <div class="card-front">❓</div>
            <div class="card-back">
                <img src="assets/${cardType}.png" alt="${cardType}" onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=&quot;font-size:2rem;&quot;>${getCardEmoji(cardType)}</div>'">
            </div>
        </div>
    `;
    
    // Add click listener
    card.addEventListener('click', () => handleCardClick(card, index));
    
    return card;
}

/**
 * Get emoji fallback for card types
 */
function getCardEmoji(cardType) {
    const emojiMap = {
        'card-1': '🌟',
        'card-2': '🎯',
        'card-3': '🎨',
        'card-4': '🎵',
        'card-5': '🏆',
        'card-6': '🌈',
        'card-7': '⚡',
        'card-8': '🔥'
    };
    return emojiMap[cardType] || '🎮';
}

/**
 * Handle card click events
 */
function handleCardClick(cardElement, cardIndex) {
    // Ignore clicks if game is not active or card is already flipped/matched
    if (!gameState.isGameActive || 
        cardElement.classList.contains('flipped') || 
        cardElement.classList.contains('matched') ||
        gameState.flippedCards.length >= 2) {
        return;
    }
    
    console.log('Card clicked:', cardIndex, cardElement.dataset.cardType);
    
    // Flip the card
    flipCard(cardElement, cardIndex);
}

/**
 * Flip a card and handle matching logic
 */
function flipCard(cardElement, cardIndex) {
    // Add flipped class for animation
    cardElement.classList.add('flipped');
    
    // Add to flipped cards array
    gameState.flippedCards.push({
        element: cardElement,
        index: cardIndex,
        type: cardElement.dataset.cardType
    });
    
    // Check for match when 2 cards are flipped
    if (gameState.flippedCards.length === 2) {
        gameState.moves++;
        elements.moves.textContent = gameState.moves;
        
        setTimeout(() => {
            checkForMatch();
        }, 600); // Wait for flip animation to complete
    }
}

/**
 * Check if two flipped cards match
 */
function checkForMatch() {
    const [card1, card2] = gameState.flippedCards;
    
    console.log('Checking match:', card1.type, 'vs', card2.type);
    
    if (card1.type === card2.type) {
        // Cards match!
        console.log('Match found!');
        handleMatch(card1.element, card2.element);
    } else {
        // Cards don't match
        console.log('No match');
        handleNoMatch(card1.element, card2.element);
    }
    
    // Clear flipped cards array
    gameState.flippedCards = [];
}

/**
 * Handle matched cards
 */
function handleMatch(card1, card2) {
    card1.classList.add('matched');
    card2.classList.add('matched');
    
    gameState.matchedPairs++;
    
    console.log(`Matched pairs: ${gameState.matchedPairs}/8`);
    
    // Check if game is complete (all 8 pairs matched)
    if (gameState.matchedPairs === 8) {
        setTimeout(() => {
            completeGame();
        }, 500);
    }
}

/**
 * Handle non-matching cards
 */
function handleNoMatch(card1, card2) {
    // Add wrong animation
    card1.classList.add('wrong');
    card2.classList.add('wrong');
    
    // Flip cards back after a delay
    setTimeout(() => {
        card1.classList.remove('flipped', 'wrong');
        card2.classList.remove('flipped', 'wrong');
    }, 1000);
}

/**
 * Complete the game and show results
 */
function completeGame() {
    console.log('Game completed!');
    
    // Stop timer and game
    gameState.isGameActive = false;
    stopTimer();
    
    // Show completion modal with results
    showGameCompleteModal();
    
    // Submit score to Google Sheets
    submitScore();
}

/**
 * Show game completion modal
 */
function showGameCompleteModal() {
    elements.finalTime.textContent = formatTime(gameState.timer);
    elements.finalMoves.textContent = gameState.moves;
    elements.attemptNumber.textContent = gameState.currentPlayer.attempt;
    
    elements.gameCompleteModal.style.display = 'flex';
}

/**
 * Submit score to Google Sheets
 */
async function submitScore() {
    try {
        console.log('Submitting score to Google Sheets...');
        elements.loadingOverlay.style.display = 'flex';
        
        const scoreData = {
            action: 'submitScore',
            nickname: gameState.currentPlayer.nickname,
            email: gameState.currentPlayer.email,
            attempt: gameState.currentPlayer.attempt,
            tries: gameState.moves,
            seconds: gameState.timer
        };
        
        console.log('Score data:', scoreData);
        
        const response = await fetch(GAS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(scoreData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Score submitted successfully:', result);
        
        // Reload leaderboard to show updated results
        await loadLeaderboard();
        
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Не вдалося зберегти результат. Спробуйте ще раз.');
    } finally {
        elements.loadingOverlay.style.display = 'none';
    }
}

/**
 * Start the game timer
 */
function startTimer() {
    gameState.timerInterval = setInterval(() => {
        gameState.timer++;
        elements.timer.textContent = formatTime(gameState.timer);
    }, 1000);
}

/**
 * Stop the game timer
 */
function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

/**
 * Handle try again button click
 */
function handleTryAgain() {
    elements.gameCompleteModal.style.display = 'none';
    
    // Increment attempt number
    const playerKey = `${gameState.currentPlayer.nickname}_${gameState.currentPlayer.email}`;
    gameState.currentPlayer.attempt++;
    localStorage.setItem(playerKey, gameState.currentPlayer.attempt.toString());
    
    // Start new game with same player
    startGame();
}

/**
 * Handle back to leaderboard button click
 */
function handleBackToLeaderboard() {
    elements.gameCompleteModal.style.display = 'none';
    showStartScreen();
    
    // Reload leaderboard to show latest results
    loadLeaderboard();
}

/**
 * Show start screen (hide game, show form and leaderboard)
 */
function showStartScreen() {
    stopTimer();
    gameState.isGameActive = false;
    
    elements.leaderboardSection.style.display = 'block';
    elements.startSection.style.display = 'block';
    elements.gameSection.style.display = 'none';
    elements.gameCompleteModal.style.display = 'none';
}

/**
 * Show game screen (hide form and leaderboard, show game)
 */
function showGameScreen() {
    elements.leaderboardSection.style.display = 'none';
    elements.startSection.style.display = 'none';
    elements.gameSection.style.display = 'block';
}

/**
 * Utility function to shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Format time in seconds to readable format
 */
function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds}с`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}х ${remainingSeconds}с`;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global error handling
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});
