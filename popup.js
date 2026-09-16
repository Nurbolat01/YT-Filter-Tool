// В начало файла popup.js добавим работу со счетчиком:
const relapseCounter = document.getElementById('relapse-counter');
const resetRelapseBtn = document.getElementById('reset-relapse-btn');

// Загрузка счетчика
chrome.storage.local.get({ relapseCount: 0 }, (res) => {
  if (relapseCounter) relapseCounter.innerText = res.relapseCount;
});

// Отслеживание изменений в реальном времени
chrome.storage.onChanged.addListener((changes) => {
  if (changes.relapseCount && relapseCounter) {
    relapseCounter.innerText = changes.relapseCount.newValue;
  }
});

// Сброс счетчика
if (resetRelapseBtn) {
  resetRelapseBtn.addEventListener('click', () => {
    if (confirm("Сбросить счетчик срывов?")) {
      chrome.storage.local.set({ relapseCount: 0 });
    }
  });
}


document.addEventListener('DOMContentLoaded', () => {
  const folderInput = document.getElementById('folder-input');
  const addFolderBtn = document.getElementById('add-folder-btn');
  const foldersContainer = document.getElementById('folders-container');
  const shortsToggle = document.getElementById('shorts-toggle');

  const defaultData = {
    "Игры / CS": ["cs2", "cs", "csgo", "counter strike", "кс", "ксго", "nuke", "donk", "s1mple", "m0nesy", "zywoo"]
  };

  // Загрузка состояния тоггла Shorts
  chrome.storage.local.get({ hideShorts: true }, (res) => {
    shortsToggle.checked = res.hideShorts;
  });

  // Обработка клика по тогглу
  shortsToggle.addEventListener('change', () => {
    chrome.storage.local.set({ hideShorts: shortsToggle.checked });
  });

  loadAndRender();

  addFolderBtn.addEventListener('click', () => {
    const folderName = folderInput.value.trim();
    if (!folderName) return;

    chrome.storage.local.get({ blockFolders: defaultData }, (res) => {
      const folders = res.blockFolders;
      if (!folders[folderName]) {
        folders[folderName] = [];
        saveFolders(folders);
        folderInput.value = '';
      }
    });
  });

  function loadAndRender() {
    chrome.storage.local.get({ blockFolders: defaultData, collapsedFolders: [] }, (res) => {
      renderFolders(res.blockFolders, res.collapsedFolders);
    });
  }

  function saveFolders(folders) {
    chrome.storage.local.set({ blockFolders: folders }, () => {
      chrome.storage.local.get({ collapsedFolders: [] }, (res) => {
        renderFolders(folders, res.collapsedFolders);
      });
    });

    const allWords = [];
    Object.values(folders).forEach(wordList => {
      allWords.push(...wordList);
    });
    chrome.storage.local.set({ blockWords: allWords });
  }

  function renderFolders(folders, collapsedFolders) {
    foldersContainer.innerHTML = '';

    Object.keys(folders).forEach(folderName => {
      const folderDiv = document.createElement('div');
      const isCollapsed = collapsedFolders.includes(folderName);
      
      folderDiv.className = `folder-item ${isCollapsed ? 'collapsed' : ''}`;

      folderDiv.innerHTML = `
        <div class="folder-header">
          <div class="folder-title">
            <span class="folder-arrow">▼</span>
            <span>📁</span> ${folderName} (${folders[folderName].length})
          </div>
          <div class="folder-actions">
            <button class="delete-folder-btn" title="Удалить папку">🗑️</button>
          </div>
        </div>
        <div class="folder-body">
          <div class="word-input-row">
            <input type="text" class="word-input" placeholder="Добавить слово..." />
            <button class="btn btn-primary add-word-btn">+</button>
          </div>
          <div class="words-tags"></div>
        </div>
      `;

      const header = folderDiv.querySelector('.folder-header');
      header.addEventListener('click', () => {
        folderDiv.classList.toggle('collapsed');
        chrome.storage.local.get({ collapsedFolders: [] }, (res) => {
          let currentCollapsed = res.collapsedFolders;
          if (folderDiv.classList.contains('collapsed')) {
            if (!currentCollapsed.includes(folderName)) currentCollapsed.push(folderName);
          } else {
            currentCollapsed = currentCollapsed.filter(name => name !== folderName);
          }
          chrome.storage.local.set({ collapsedFolders: currentCollapsed });
        });
      });

      folderDiv.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        delete folders[folderName];
        saveFolders(folders);
      });

      const tagsContainer = folderDiv.querySelector('.words-tags');
      folders[folderName].forEach((word, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
          <span>${word}</span>
          <span class="tag-remove">&times;</span>
        `;
        
        tag.querySelector('.tag-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          folders[folderName].splice(index, 1);
          saveFolders(folders);
        });

        tagsContainer.appendChild(tag);
      });

      const wordInput = folderDiv.querySelector('.word-input');
      const addWordBtn = folderDiv.querySelector('.add-word-btn');

      wordInput.addEventListener('click', (e) => e.stopPropagation());

      const handleAddWord = (e) => {
        e.stopPropagation();
        const word = wordInput.value.trim().toLowerCase();
        if (word && !folders[folderName].includes(word)) {
          folders[folderName].push(word);
          saveFolders(folders);
        }
      };

      addWordBtn.addEventListener('click', handleAddWord);
      wordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddWord(e);
      });

      foldersContainer.appendChild(folderDiv);
    });
  }
});