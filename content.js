console.log("✅ YT Filter Tool: Динамическое скрытие Shorts и словаря!");

let blockWords = ["cs2", "cs", "csgo", "counter strike", "кс", "ксго", "nuke", "donk", "s1mple", "m0nesy", "zywoo"];
let hideShortsEnabled = true;
const PENALTY_SECONDS = 300;

chrome.storage.local.get({ blockWords: blockWords, hideShorts: true }, (result) => {
  blockWords = result.blockWords;
  hideShortsEnabled = result.hideShorts;
  processVideos();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.blockWords) {
      blockWords = changes.blockWords.newValue || [];
      // При изменении словаря восстанавливаем все карточки к оригиналу и заново фильтруем
      resetAndReblock();
    }
    if (changes.hideShorts !== undefined) {
      hideShortsEnabled = changes.hideShorts.newValue;
      if (!hideShortsEnabled) {
        showShortsSections();
      }
    }
    processVideos();
  }
});

function containsBlockedWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return blockWords.some(word => {
    const w = word.toLowerCase().trim();
    return w && lower.includes(w);
  });
}

// Сброс и полное восстановление элементов к исходному состоянию (включая обложку)
function resetAndReblock() {
  document.querySelectorAll('[data-penalty-processed]').forEach(card => {
    const titleElement = card.querySelector('a.ytLockupMetadataViewModelTitle, #video-title-link, #video-title, .ytLockupMetadataViewModelHeadingReset');
    const span = titleElement?.querySelector('span') || titleElement;

    // 1. Восстанавливаем оригинальный заголовок
    if (span && span.dataset.originalTitle) {
      span.innerText = span.dataset.originalTitle;
      span.style.color = "";
      span.style.fontWeight = "";
      delete span.dataset.originalTitle;
    }

    // 2. Восстанавливаем обложку (удаляем оверлей и класс блокировки)
    const overlay = card.querySelector('.blocked-overlay');
    if (overlay) overlay.remove();

    const blockedHosts = card.querySelectorAll('.blocked-card');
    blockedHosts.forEach(host => host.classList.remove('blocked-card'));
    card.classList.remove('blocked-card');

    // 3. Восстанавливаем оригинальные ссылки
    const links = card.querySelectorAll('a');
    links.forEach(link => {
      if (link.dataset.realHref) {
        link.href = link.dataset.realHref;
        delete link.dataset.realHref;
      }
    });

    delete card.dataset.penaltyProcessed;

    // 4. Клонируем элемент для полного сброса обработчиков клика
    const cleanCard = card.cloneNode(true);
    if (card.parentNode) {
      card.parentNode.replaceChild(cleanCard, card);
    }
  });
}

// Расширенный список селекторов для полного скрытия Shorts
const shortsSelectors = [
  'ytd-rich-shelf-renderer[is-shorts]',
  'ytd-reel-shelf-renderer',
  'ytd-guide-entry-renderer a[title="Shorts"]',
  'ytd-guide-entry-renderer a[href*="/shorts"]',
  'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
  'ytm-shorts-lockup-view-model',
  'ytm-shorts-lockup-view-model-v2',
  'grid-shelf-view-model',
  '.ytGridShelfViewModelGridShelfRow',
  'a[href*="/shorts/"]'
];

function handleShorts() {
  if (!hideShortsEnabled) return;

  shortsSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (selector === 'a[href*="/shorts/"]' || selector === 'ytm-shorts-lockup-view-model') {
        const parentShelf = el.closest('ytd-reel-shelf-renderer, grid-shelf-view-model, .ytGridShelfViewModelGridShelfRow, ytd-item-section-renderer');
        if (parentShelf) {
          parentShelf.style.display = 'none';
        } else {
          el.style.display = 'none';
        }
      } else {
        el.style.display = 'none';
      }
    });
  });
}

function showShortsSections() {
  shortsSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      const parentShelf = el.closest('ytd-reel-shelf-renderer, grid-shelf-view-model, .ytGridShelfViewModelGridShelfRow, ytd-item-section-renderer');
      if (parentShelf) {
        parentShelf.style.display = '';
      }
      el.style.display = '';
    });
  });
}

function processVideos() {
  handleShorts();

  const isSearchPage = window.location.pathname.includes('/results');
  if (isSearchPage) {
    processSearchPage();
  } else {
    processHomePage();
  }
}

function processSearchPage() {
  const cards = document.querySelectorAll('ytd-video-renderer');

  cards.forEach(card => {
    const titleElement = card.querySelector('yt-formatted-string#video-title, #video-title');
    // Считываем настоящий заголовок из dataset или из текста
    const titleText = (titleElement?.dataset.originalTitle || titleElement?.innerText || titleElement?.textContent || '').trim();

    if (containsBlockedWord(titleText)) {
      if (card.dataset.penaltyProcessed === "true") return;
      card.dataset.penaltyProcessed = "true";

      if (titleElement) {
        if (!titleElement.dataset.originalTitle) {
          titleElement.dataset.originalTitle = titleText;
        }
        titleElement.innerText = "🛑 [ЭТО ВИДЕО ВРЕДИТ ЗДОРОВЬЮ]";
        titleElement.style.color = "#ff4444";
        titleElement.style.fontWeight = "bold";
      }

      const thumb = card.querySelector('a#thumbnail');
      if (thumb) {
        applyOverlay(thumb);
      }

      bindClickPenalty(card, card.querySelector('a#thumbnail')?.href || titleElement?.closest('a')?.href);
    }
  });
}

function processHomePage() {
  const cards = document.querySelectorAll('ytd-rich-item-renderer, yt-lockup-view-model');

  cards.forEach(card => {
    const titleElement = card.querySelector('a.ytLockupMetadataViewModelTitle, #video-title-link, #video-title, .ytLockupMetadataViewModelHeadingReset');
    const span = titleElement?.querySelector('span') || titleElement;
    
    // Считываем настоящий заголовок из dataset (если он уже сохранялся) или из элемента
    const titleText = (
      span?.dataset.originalTitle ||
      titleElement?.innerText || 
      titleElement?.textContent || 
      titleElement?.getAttribute('title') || 
      ''
    ).trim();

    if (containsBlockedWord(titleText)) {
      if (card.dataset.penaltyProcessed === "true") return;
      card.dataset.penaltyProcessed = "true";

      if (titleElement) {
        if (span && !span.dataset.originalTitle) {
          span.dataset.originalTitle = titleText;
        }
        if (span) {
          span.innerText = "🛑 [ЭТО ВИДЕО ВРЕДИТ ЗДОРОВЬЮ]";
          span.style.color = "#ff4444";
          span.style.fontWeight = "bold";
        }
      }

      const mainHost = card.querySelector('yt-thumbnail-view-model') || 
                       card.querySelector('.ytThumbnailViewModelImage') || 
                       card.querySelector('a#thumbnail');

      if (mainHost) {
        applyOverlay(mainHost);
      }

      const targetUrl = card.querySelector('a[href*="/watch"]')?.href;
      bindClickPenalty(card, targetUrl);
    }
  });
}

function applyOverlay(hostElement) {
  hostElement.classList.add('blocked-card');

  const oldOverlay = hostElement.querySelector('.blocked-overlay');
  if (oldOverlay) oldOverlay.remove();

  const imgUrl = chrome.runtime.getURL("funny.jpg");

  const overlay = document.createElement('div');
  overlay.className = 'blocked-overlay';
  
  overlay.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background-image: url('${imgUrl}') !important;
    background-size: cover !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
    z-index: 9999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: white !important;
    font-weight: bold !important;
    font-size: 18px !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8) !important;
    border-radius: 12px !important;
    pointer-events: auto !important;
  `;

  overlay.innerText = "НЕ ТРОГАЙ!";
  hostElement.style.position = 'relative';
  hostElement.appendChild(overlay);
}

function bindClickPenalty(element, targetUrl) {
  if (!targetUrl) return;

  // 1. Обычный левый клик (Запуск таймера штрафа)
  const handleBlockClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    startPenaltyCountdown(targetUrl);
    return false;
  };

  element.addEventListener('click', handleBlockClick, true);

  // 2. Блокировка правой кнопки и перехвата "Открыть в новой вкладке"
  const links = element.querySelectorAll('a');
  links.forEach(link => {
    link.dataset.realHref = link.href;
    link.href = "javascript:void(0);";
  });

  element.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    startPenaltyCountdown(targetUrl);
    return false;
  }, true);
}

// Ссылка с таймкодом на 11-ю секунду (?t=11)
const PUNISHMENT_VIDEO_URL = "https://www.youtube.com/watch?v=ooOELrGMn14&t=11s";

function startPenaltyCountdown(videoUrl) {
  if (document.getElementById('penalty-modal-backdrop')) return;

  let timeLeft = PENALTY_SECONDS;
  const backdrop = document.createElement('div');
  backdrop.id = 'penalty-modal-backdrop';

  backdrop.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background-color: rgba(0, 0, 0, 0.85) !important;
    backdrop-filter: blur(8px) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;

  backdrop.innerHTML = `
    <div style="
      background-color: #1f1f1f;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <h2 style="color: #ff4444; margin-bottom: 12px; font-size: 22px;">⚠️ ШТРАФ ЗА СРЫВ</h2>
      <p style="color: #ccc; font-size: 14px; line-height: 1.4;">Вы решили посмотреть запрещенный контент.<br>Подумайте над своим поведением.</p>
      <div style="font-size: 54px; font-weight: 800; margin: 24px 0; color: #ffbb00; letter-spacing: 2px;" id="penalty-timer">
        ${formatTime(timeLeft)}
      </div>
      <p style="font-size: 12px; color: #888;">Видео откроется автоматически после окончания таймера.</p>
      <div style="margin-top: 28px;">
        <button id="cancel-btn" style="
          background-color: #383838;
          color: #fff;
          border: none;
          padding: 12px 24px;
          border-radius: 20px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        ">Одуматься и уйти</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const timerDisplay = document.getElementById('penalty-timer');
  const interval = setInterval(() => {
    timeLeft--;
    if (timerDisplay) timerDisplay.innerText = formatTime(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(interval);
      backdrop.remove();

      chrome.storage.local.get({ relapseCount: 0 }, (res) => {
        chrome.storage.local.set({ relapseCount: res.relapseCount + 1 });
      });

      window.open(PUNISHMENT_VIDEO_URL, '_blank');
      window.location.href = videoUrl;
    }
  }, 1000);

  document.getElementById('cancel-btn').onclick = () => {
    clearInterval(interval);
    backdrop.remove();
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

window.addEventListener('yt-navigate-finish', () => {
  resetAndReblock();
  processVideos();
});

const observer = new MutationObserver(() => processVideos());
observer.observe(document.body, { childList: true, subtree: true });

setInterval(processVideos, 1000);
processVideos();