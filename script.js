// ─── CONFIG ───
const WORD = "HAPPY";
const LOVE_WORD = "YES";
const MAX_GUESSES = 6;
const WORD_LEN = 5;
const LOVE_LEN = 3;

// ─── STATE ───
let currentRow = 0;
let currentCol = 0;
let board = Array.from({ length: MAX_GUESSES }, () => Array(WORD_LEN).fill(""));
let gameOver = false;
let activeScreen = "wordle"; // "wordle" | "love"

// Love state
let loveLetters = ["", "", ""];
let loveCol = 0;
let loveOver = false;

// ═══════════════════════════════════════
//  SPLASH SCREEN
// ═══════════════════════════════════════
const splashScreen = document.getElementById("splashScreen");
const splashHeart = document.getElementById("splashHeart");

splashHeart.addEventListener("click", () => {
  // Start music on splash click
  bgMusic.play().catch(() => {});
  
  // Animate splash screen out
  splashScreen.classList.add("fade-out");
  
  // Remove splash screen after animation
  setTimeout(() => {
    splashScreen.classList.remove("active", "fade-out");
    splashScreen.style.display = "none";
  }, 800);
});

// ═══════════════════════════════════════
//  MUSIC
// ═══════════════════════════════════════
const bgMusic = document.getElementById("bgMusic");
const musicBtns = document.querySelectorAll(".music-btn");
let musicPlaying = true; // Start as true so UI shows playing state

function setMusicUI(playing) {
  musicPlaying = playing;
  musicBtns.forEach(btn => {
    btn.textContent = playing ? "🎵" : "🔇";
    btn.classList.toggle("playing", playing);
  });
}

function startMusic() {
  if (musicPlaying && !bgMusic.paused) return;
  bgMusic.play().then(() => setMusicUI(true)).catch(() => setMusicUI(false));
}

function toggleMusic() {
  if (musicPlaying && !bgMusic.paused) {
    bgMusic.pause();
    setMusicUI(false);
  } else {
    startMusic();
  }
}

musicBtns.forEach(btn => btn.addEventListener("click", toggleMusic));

// Set UI to playing state by default
setMusicUI(true);

// Auto-play: browsers require user gesture, so we play on first interaction
function autoPlayOnce() {
  startMusic();
  document.removeEventListener("click", autoPlayOnce);
  document.removeEventListener("touchstart", autoPlayOnce);
  document.removeEventListener("keydown", autoPlayOnce);
}
document.addEventListener("click", autoPlayOnce);
document.addEventListener("touchstart", autoPlayOnce);
document.addEventListener("keydown", autoPlayOnce);

// Also try immediate autoplay (works if user already interacted with domain)
bgMusic.play().catch(() => {});

// ═══════════════════════════════════════
//  BUILD BOARD
// ═══════════════════════════════════════
const boardEl = document.getElementById("board");
for (let r = 0; r < MAX_GUESSES; r++) {
  const row = document.createElement("div");
  row.classList.add("row");
  row.id = `row-${r}`;
  for (let c = 0; c < WORD_LEN; c++) {
    const tile = document.createElement("div");
    tile.classList.add("tile");
    tile.id = `tile-${r}-${c}`;
    row.appendChild(tile);
  }
  boardEl.appendChild(row);
}

// ═══════════════════════════════════════
//  BUILD KEYBOARD (shared builder)
// ═══════════════════════════════════════
const kbLayout = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Enter", "Z", "X", "C", "V", "B", "N", "M", "⌫"]
];

function buildKeyboard(container, handler) {
  const els = {};
  kbLayout.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.classList.add("kb-row");
    row.forEach(k => {
      const btn = document.createElement("button");
      btn.classList.add("key");
      if (k === "Enter" || k === "⌫") btn.classList.add("wide");
      btn.textContent = k;
      btn.setAttribute("data-key", k);
      btn.addEventListener("click", () => handler(k));
      rowDiv.appendChild(btn);
      els[k] = btn;
    });
    container.appendChild(rowDiv);
  });
  return els;
}

const keyEls = buildKeyboard(document.getElementById("keyboard"), handleKey);
const loveKeyEls = buildKeyboard(document.getElementById("loveKeyboard"), handleLoveKey);

// Pre-highlight Y, E, S as yellow (present) on love keyboard
["Y", "E", "S"].forEach(letter => {
  if (loveKeyEls[letter]) {
    loveKeyEls[letter].classList.add("present");
  }
});

// ═══════════════════════════════════════
//  WORDLE INPUT HANDLER
// ═══════════════════════════════════════
function handleKey(key) {
  if (gameOver) return;
  if (key === "⌫" || key === "Backspace") {
    if (currentCol > 0) {
      currentCol--;
      board[currentRow][currentCol] = "";
      updateTile(currentRow, currentCol, "");
    }
    return;
  }
  if (key === "Enter") {
    if (currentCol < WORD_LEN) {
      showToast("Not enough letters");
      shakeRow(currentRow);
      return;
    }
    submitGuess();
    return;
  }
  if (/^[A-Za-z]$/.test(key) && currentCol < WORD_LEN) {
    const letter = key.toUpperCase();
    board[currentRow][currentCol] = letter;
    updateTile(currentRow, currentCol, letter);
    document.getElementById(`tile-${currentRow}-${currentCol}`).classList.add("filled");
    currentCol++;
  }
}

function updateTile(r, c, letter) {
  const tile = document.getElementById(`tile-${r}-${c}`);
  tile.textContent = letter;
  if (!letter) tile.classList.remove("filled");
}

// ═══════════════════════════════════════
//  SUBMIT GUESS
// ═══════════════════════════════════════
function submitGuess() {
  const guess = board[currentRow].join("");
  const result = evaluate(guess, WORD);
  const row = currentRow;
  result.forEach((res, i) => {
    const tile = document.getElementById(`tile-${row}-${i}`);
    setTimeout(() => {
      tile.classList.add("reveal");
      setTimeout(() => {
        tile.classList.add(res);
        updateKeyboard(board[row][i], res);
      }, 250);
    }, i * 300);
  });
  const totalDelay = WORD_LEN * 300 + 300;
  setTimeout(() => {
    if (guess === WORD) {
      gameOver = true;
      showWinBlocks();
    } else if (currentRow >= MAX_GUESSES - 1) {
      gameOver = true;
      showGameOver();
    } else {
      currentRow++;
      currentCol = 0;
    }
  }, totalDelay);
}

// ═══════════════════════════════════════
//  EVALUATE (handles repeated letters)
// ═══════════════════════════════════════
function evaluate(guess, answer) {
  const len = guess.length;
  const result = Array(len).fill("absent");
  const ansArr = answer.split("");
  const guessArr = guess.split("");
  const taken = Array(len).fill(false);
  for (let i = 0; i < len; i++) {
    if (guessArr[i] === ansArr[i]) { result[i] = "correct"; taken[i] = true; }
  }
  for (let i = 0; i < len; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < len; j++) {
      if (!taken[j] && guessArr[i] === ansArr[j]) { result[i] = "present"; taken[j] = true; break; }
    }
  }
  return result;
}

// ═══════════════════════════════════════
//  KEYBOARD COLORING
// ═══════════════════════════════════════
const keyState = {};
function updateKeyboard(letter, state) {
  const priority = { correct: 3, present: 2, absent: 1 };
  const prev = keyState[letter] || 0;
  if (priority[state] > prev) {
    keyState[letter] = priority[state];
    const el = keyEls[letter];
    if (el) { el.classList.remove("correct", "present", "absent"); el.classList.add(state); }
  }
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1400);
}

// ═══════════════════════════════════════
//  SHAKE ROW
// ═══════════════════════════════════════
function shakeRow(r) {
  const row = document.getElementById(`row-${r}`);
  row.classList.add("shake");
  setTimeout(() => row.classList.remove("shake"), 500);
}

// ═══════════════════════════════════════
//  GAME OVER (failed all 6)
// ═══════════════════════════════════════
function showGameOver() {
  setTimeout(() => {
    document.getElementById("gameOverOverlay").classList.add("active");
  }, 400);
}

document.getElementById("btnReveal").addEventListener("click", () => {
  // Hide game over overlay and show win blocks animation
  document.getElementById("gameOverOverlay").classList.remove("active");
  showWinBlocks();
});

document.getElementById("btnPlayAgain").addEventListener("click", () => resetGame());

document.getElementById("btnRevealNext").addEventListener("click", () => {
  document.getElementById("gameOverOverlay").classList.remove("active");
  goToLovePage();
});

function resetGame() {
  document.getElementById("gameOverOverlay").classList.remove("active");
  currentRow = 0; currentCol = 0; gameOver = false;
  board = Array.from({ length: MAX_GUESSES }, () => Array(WORD_LEN).fill(""));
  for (let r = 0; r < MAX_GUESSES; r++) {
    for (let c = 0; c < WORD_LEN; c++) {
      const tile = document.getElementById(`tile-${r}-${c}`);
      tile.textContent = ""; tile.className = "tile";
    }
  }
  Object.keys(keyEls).forEach(k => keyEls[k].classList.remove("correct", "present", "absent"));
  Object.keys(keyState).forEach(k => delete keyState[k]);
  document.getElementById("revealedWord").style.display = "none";
  document.getElementById("btnReveal").style.display = "";
  document.getElementById("btnRevealNext").style.display = "none";
}

// ═══════════════════════════════════════
//  WIN → BLOCK ANIMATION
//  "HAPPY / VALENTINES / MY / PRINCESS"
// ═══════════════════════════════════════
function showWinBlocks() {
  setTimeout(() => {
    const overlay = document.getElementById("winBlockOverlay");
    const container = document.getElementById("winBlockContainer");
    container.innerHTML = "";
    overlay.classList.add("active");
    launchConfetti();

    const words = ["HAPPY", "VALENTINES", "MY", "PRINCESS!"];
    let globalDelay = 0;

    words.forEach((word, wi) => {
      const rowDiv = document.createElement("div");
      rowDiv.classList.add("block-row");

      word.split("").forEach((ch, ci) => {
        const tile = document.createElement("div");
        tile.classList.add("block-tile");
        if (wi > 0) tile.classList.add("pink-tile");
        tile.textContent = ch;

        const delay = globalDelay + ci * 100;
        setTimeout(() => tile.classList.add("visible"), delay);

        rowDiv.appendChild(tile);
      });

      container.appendChild(rowDiv);
      globalDelay += word.length * 100 + 300;
    });

    // Show next button after all blocks
    const nextBtn = document.getElementById("winBlockNext");
    setTimeout(() => nextBtn.classList.add("visible"), globalDelay + 200);
  }, 600);
}

document.getElementById("winBlockNext").addEventListener("click", () => {
  document.getElementById("winBlockOverlay").classList.remove("active");
  document.getElementById("winBlockNext").classList.remove("visible");
  stopConfetti();
  goToLovePage();
});

// ═══════════════════════════════════════
//  TRANSITION TO LOVE PAGE
// ═══════════════════════════════════════
function goToLovePage() {
  activeScreen = "love";
  document.getElementById("lovePage").classList.add("active");
  loveLetters = ["", "", ""];
  loveCol = 0;
  loveOver = false;
  for (let i = 0; i < LOVE_LEN; i++) {
    const t = document.getElementById(`lt${i}`);
    t.textContent = ""; t.className = "love-tile";
  }
  // Reset love keyboard (keep Y/E/S yellow)
  Object.keys(loveKeyEls).forEach(k => {
    loveKeyEls[k].classList.remove("correct", "absent");
    if (!["Y", "E", "S"].includes(k)) {
      loveKeyEls[k].classList.remove("present");
    }
  });
}

// ═══════════════════════════════════════
//  LOVE KEY HANDLER
// ═══════════════════════════════════════
function handleLoveKey(key) {
  if (loveOver) return;
  if (key === "⌫" || key === "Backspace") {
    if (loveCol > 0) {
      loveCol--;
      loveLetters[loveCol] = "";
      const t = document.getElementById(`lt${loveCol}`);
      t.textContent = ""; t.classList.remove("filled");
    }
    return;
  }
  if (key === "Enter") {
    // Allow "NO" with 2 letters for angry mode
    const currentGuess = loveLetters.slice(0, loveCol).join("");
    if (currentGuess === "NO" || currentGuess === "NOO") {
      submitLove();
      return;
    }
    if (loveCol < LOVE_LEN) {
      showToast("Not enough letters");
      const row = document.getElementById("loveRow");
      row.classList.add("shake");
      setTimeout(() => row.classList.remove("shake"), 500);
      return;
    }
    submitLove();
    return;
  }
  if (/^[A-Za-z]$/.test(key) && loveCol < LOVE_LEN) {
    const letter = key.toUpperCase();
    loveLetters[loveCol] = letter;
    const t = document.getElementById(`lt${loveCol}`);
    t.textContent = letter;
    t.classList.add("filled");
    loveCol++;
  }
}

// ═══════════════════════════════════════
//  SUBMIT LOVE ANSWER
// ═══════════════════════════════════════
function submitLove() {
  const guess = loveLetters.join("");

  // ─── "NO" or "NOO" check (exact match only) ───
  if (guess === "NO" || guess === "NOO") {
    triggerAngry();
    return;
  }

  if (guess === LOVE_WORD) {
    loveOver = true;
    for (let i = 0; i < LOVE_LEN; i++) {
      const t = document.getElementById(`lt${i}`);
      setTimeout(() => {
        t.classList.add("reveal");
        setTimeout(() => { t.classList.remove("filled"); t.classList.add("correct"); }, 250);
      }, i * 300);
    }
    setTimeout(() => {
      showBouquetPage();
    }, LOVE_LEN * 300 + 500);
  } else {
    // Wrong answer - shake & clear
    const row = document.getElementById("loveRow");
    for (let i = 0; i < LOVE_LEN; i++) {
      document.getElementById(`lt${i}`).classList.add("wrong");
    }
    row.classList.add("shake");
    setTimeout(() => {
      row.classList.remove("shake");
      for (let i = 0; i < LOVE_LEN; i++) {
        const t = document.getElementById(`lt${i}`);
        t.classList.remove("wrong", "filled");
        t.textContent = "";
      }
      loveLetters = ["", "", ""];
      loveCol = 0;
    }, 600);
    showToast("Try again 💜");
  }
}

// ═══════════════════════════════════════
//  ANGRY MODE (when she types NO)
// ═══════════════════════════════════════
function triggerAngry() {
  const page = document.getElementById("lovePage");

  // Add angry class for red flash + shake
  page.classList.add("angry");

  // Add angry emoji
  const emoji = document.createElement("div");
  emoji.className = "angry-emoji";
  emoji.textContent = "😡";
  page.appendChild(emoji);

  setTimeout(() => {
    page.classList.remove("angry");
    emoji.remove();

    // Clear the tiles
    const row = document.getElementById("loveRow");
    for (let i = 0; i < LOVE_LEN; i++) {
      const t = document.getElementById(`lt${i}`);
      t.classList.remove("wrong", "filled");
      t.textContent = "";
    }
    loveLetters = ["", "", ""];
    loveCol = 0;
  }, 900);

  showToast("Wrong answer! 😤");
}

// ═══════════════════════════════════════
//  PHYSICAL KEYBOARD
// ═══════════════════════════════════════
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (activeScreen === "love") {
    if (loveOver) return;
    if (e.key === "Enter") handleLoveKey("Enter");
    else if (e.key === "Backspace") handleLoveKey("⌫");
    else if (/^[a-zA-Z]$/.test(e.key)) handleLoveKey(e.key);
    return;
  }
  // Wordle screen
  if (document.getElementById("gameOverOverlay").classList.contains("active")) return;
  if (document.getElementById("winBlockOverlay").classList.contains("active")) return;
  if (e.key === "Enter") handleKey("Enter");
  else if (e.key === "Backspace") handleKey("⌫");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
});

// ═══════════════════════════════════════
//  FLOATING HEARTS
// ═══════════════════════════════════════
(function spawnHearts() {
  const container = document.getElementById("heartsBg");
  const hearts = ["💜", "💖", "💕", "🤍", "💗", "💝"];
  for (let i = 0; i < 18; i++) {
    const span = document.createElement("span");
    span.classList.add("heart");
    span.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    span.style.left = Math.random() * 100 + "%";
    span.style.animationDuration = (8 + Math.random() * 12) + "s";
    span.style.animationDelay = (Math.random() * 10) + "s";
    span.style.fontSize = (14 + Math.random() * 18) + "px";
    container.appendChild(span);
  }
})();

// ═══════════════════════════════════════
//  CONFETTI
// ═══════════════════════════════════════
let confettiAnims = {};

function launchConfetti(canvasId = "confetti") {
  const canvas = document.getElementById(canvasId);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  const pieces = [];
  const colors = ["#9b59b6", "#e91e8c", "#f472b6", "#c39bd3", "#ffd93d", "#6bcb77", "#ff6b9d"];
  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 6
    });
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rv;
      if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    confettiAnims[canvasId] = requestAnimationFrame(draw);
  }
  draw();
}

function stopConfetti(canvasId = "confetti") {
  cancelAnimationFrame(confettiAnims[canvasId]);
  const canvas = document.getElementById(canvasId);
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ═══════════════════════════════════════
//  BOUQUET PAGE
// ═══════════════════════════════════════
function showBouquetPage() {
  // Hide love page
  document.getElementById("lovePage").classList.remove("active");
  activeScreen = "bouquet";

  // Show bouquet page
  const page = document.getElementById("bouquetPage");
  page.classList.add("active");

  // Launch confetti
  launchConfetti("confetti2");
}
