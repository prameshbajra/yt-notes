const NOTES_STORAGE_KEY = 'videoNotes:notes';
const METADATA_STORAGE_KEY = 'videoNotes:metadata';

const state = {
    videos: [],
    expandedVideos: new Set(),
    searchTerm: ''
};

const elements = {
    searchInput: document.getElementById('search-input'),
    videoList: document.getElementById('video-list'),
    emptyState: document.getElementById('empty-state')
};

const formatTimestamp = (value) => {
    if (!Number.isFinite(value)) {
        return '00:00';
    }

    const totalSeconds = Math.max(0, Math.floor(value));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const minutePart = minutes.toString().padStart(2, '0');
    const secondPart = seconds.toString().padStart(2, '0');

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutePart}:${secondPart}`;
    }

    return `${minutePart}:${secondPart}`;
};

const getStorageSnapshot = () =>
    new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            resolve({});
            return;
        }

        chrome.storage.local.get([NOTES_STORAGE_KEY, METADATA_STORAGE_KEY], (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
                resolve({});
                return;
            }
            resolve(result || {});
        });
    });

const normalizeNotes = (videoId, notes) =>
    notes
        .map((note, index) => {
            if (!note || typeof note !== 'object') {
                return null;
            }

            const timestamp = Number(note.timestamp);
            if (!Number.isFinite(timestamp)) {
                return null;
            }

            const rawText = typeof note.text === 'string' ? note.text : '';
            const trimmedText = rawText.trim();
            const displayText = trimmedText || '(No text)';

            const updatedAtCandidate = Number(note.updatedAt);
            const createdAtCandidate = Number(note.createdAt);
            const updatedAt = Number.isFinite(updatedAtCandidate)
                ? updatedAtCandidate
                : Number.isFinite(createdAtCandidate)
                  ? createdAtCandidate
                  : 0;

            return {
                id:
                    typeof note.id === 'string' && note.id.trim()
                        ? note.id
                        : `${videoId}-${index}-${timestamp}`,
                text: displayText,
                textLower: trimmedText.toLowerCase(),
                timestamp,
                formattedTimestamp: formatTimestamp(timestamp),
                updatedAt
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp);

const transformStoragePayload = (notesPayload, metadataPayload) => {
    if (!notesPayload || typeof notesPayload !== 'object') {
        return [];
    }

    const videos = [];

    Object.entries(notesPayload).forEach(([videoId, rawNotes]) => {
        if (!Array.isArray(rawNotes) || rawNotes.length === 0) {
            return;
        }

        const normalizedNotes = normalizeNotes(videoId, rawNotes);
        if (normalizedNotes.length === 0) {
            return;
        }

        const metadata =
            metadataPayload && typeof metadataPayload === 'object' ? metadataPayload[videoId] : undefined;

        const rawTitle = metadata && typeof metadata.title === 'string' ? metadata.title.trim() : '';
        const title = rawTitle || videoId;

        const updatedAtValues = [];
        if (metadata && Number.isFinite(Number(metadata.updatedAt))) {
            updatedAtValues.push(Number(metadata.updatedAt));
        }

        normalizedNotes.forEach((note) => {
            if (Number.isFinite(note.updatedAt) && note.updatedAt > 0) {
                updatedAtValues.push(note.updatedAt);
            }
        });

        const updatedAt = updatedAtValues.length > 0 ? Math.max(...updatedAtValues) : 0;

        videos.push({
            videoId,
            title,
            titleLower: title.toLowerCase(),
            noteCount: normalizedNotes.length,
            updatedAt,
            notes: normalizedNotes
        });
    });

    videos.sort((a, b) => {
        if (b.updatedAt !== a.updatedAt) {
            return b.updatedAt - a.updatedAt;
        }
        return a.title.localeCompare(b.title);
    });

    return videos;
};

const computeRenderableVideos = () => {
    const trimmedTerm = state.searchTerm.trim();
    const isSearchActive = trimmedTerm.length > 0;
    if (!isSearchActive) {
        return state.videos.map((video) => ({
            video,
            displayNotes: video.notes,
            forceExpanded: false
        }));
    }

    const normalizedTerm = trimmedTerm.toLowerCase();
    const matches = [];

    state.videos.forEach((video) => {
        const titleMatch = video.titleLower.includes(normalizedTerm);
        const matchingNotes = video.notes.filter((note) => note.textLower.includes(normalizedTerm));
        if (!titleMatch && matchingNotes.length === 0) {
            return;
        }

        matches.push({
            video,
            displayNotes: titleMatch ? video.notes : matchingNotes,
            forceExpanded: true
        });
    });

    return matches;
};

const toggleVideoExpansion = (videoId) => {
    if (!videoId) {
        return;
    }

    if (state.expandedVideos.has(videoId)) {
        state.expandedVideos.delete(videoId);
    } else {
        state.expandedVideos.add(videoId);
    }

    render();
};

const openNote = (videoId, timestampSeconds) => {
    if (!videoId) {
        return;
    }

    const seconds = Math.max(0, Math.floor(Number(timestampSeconds)));
    const targetUrl = new URL('https://www.youtube.com/watch');
    targetUrl.searchParams.set('v', videoId);
    if (seconds > 0) {
        targetUrl.searchParams.set('t', seconds.toString());
    }

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: targetUrl.toString() }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
                // eslint-disable-next-line no-console
                console.error('Unable to open video tab:', chrome.runtime.lastError);
                return;
            }
            window.close();
        });
        return;
    }

    window.open(targetUrl.toString(), '_blank', 'noopener');
    window.close();
};

const render = () => {
    const searchTrimmed = state.searchTerm.trim();
    const isSearchActive = searchTrimmed.length > 0;
    const renderable = computeRenderableVideos();

    const { videoList, emptyState } = elements;
    if (!videoList || !emptyState) {
        return;
    }

    videoList.textContent = '';

    if (state.videos.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent = 'You have not saved any notes yet.';
        return;
    }

    if (renderable.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent = `No matches for "${searchTrimmed}".`;
        return;
    }

    emptyState.hidden = true;

    renderable.forEach(({ video, displayNotes, forceExpanded }) => {
        const listItem = document.createElement('li');
        listItem.className = 'video-item';

        const isExpanded = isSearchActive || forceExpanded || state.expandedVideos.has(video.videoId);
        if (isExpanded) {
            listItem.classList.add('video-item--expanded');
        }

        const headerButton = document.createElement('button');
        headerButton.type = 'button';
        headerButton.className = 'video-header';
        headerButton.dataset.videoId = video.videoId;
        if (isSearchActive) {
            headerButton.classList.add('video-header--static');
        }

        const titleSpan = document.createElement('span');
        titleSpan.className = 'video-header__title';
        titleSpan.textContent = video.title;

        const countSpan = document.createElement('span');
        countSpan.className = 'video-header__count';
        const matchingCountLabel =
            isSearchActive && displayNotes.length !== video.noteCount
                ? `${displayNotes.length} of ${video.noteCount} notes`
                : `${video.noteCount} ${video.noteCount === 1 ? 'note' : 'notes'}`;
        countSpan.textContent = matchingCountLabel;

        const chevronSpan = document.createElement('span');
        chevronSpan.className = 'video-header__chevron';
        chevronSpan.setAttribute('aria-hidden', 'true');

        headerButton.append(titleSpan, countSpan, chevronSpan);

        if (!isSearchActive) {
            headerButton.addEventListener('click', () => toggleVideoExpansion(video.videoId));
        }

        const notesList = document.createElement('ul');
        notesList.className = 'notes-list';

        displayNotes.forEach((note) => {
            const noteItem = document.createElement('li');
            noteItem.className = 'note-item';

            const noteButton = document.createElement('button');
            noteButton.type = 'button';
            noteButton.className = 'note-button';
            noteButton.dataset.videoId = video.videoId;
            noteButton.dataset.timestamp = note.timestamp.toString();

            noteButton.addEventListener('click', () => openNote(video.videoId, note.timestamp));

            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'note-button__timestamp';
            timestampSpan.textContent = note.formattedTimestamp;

            const textSpan = document.createElement('span');
            textSpan.className = 'note-button__text';
            textSpan.textContent = note.text;

            noteButton.append(timestampSpan, textSpan);
            noteItem.appendChild(noteButton);
            notesList.appendChild(noteItem);
        });

        listItem.append(headerButton, notesList);
        videoList.appendChild(listItem);
    });
};

const handleSearchInput = (event) => {
    state.searchTerm = event.target.value || '';
    render();
};

const loadVideos = async () => {
    const snapshot = await getStorageSnapshot();
    const notesPayload = snapshot[NOTES_STORAGE_KEY] || {};
    const metadataPayload = snapshot[METADATA_STORAGE_KEY] || {};
    const videos = transformStoragePayload(notesPayload, metadataPayload);
    const existingIds = new Set(videos.map((video) => video.videoId));
    state.expandedVideos = new Set(
        [...state.expandedVideos].filter((videoId) => existingIds.has(videoId))
    );

    if (state.expandedVideos.size === 0 && videos.length === 1) {
        state.expandedVideos.add(videos[0].videoId);
    }

    state.videos = videos;
    render();
};

const storageChangeHandler = (changes, areaName) => {
    if (areaName !== 'local') {
        return;
    }

    if (changes[NOTES_STORAGE_KEY] || changes[METADATA_STORAGE_KEY]) {
        loadVideos();
    }
};

const initialize = () => {
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', handleSearchInput);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(storageChangeHandler);
        window.addEventListener('unload', () => {
            chrome.storage.onChanged.removeListener(storageChangeHandler);
        });
    }

    loadVideos().catch(() => {
        state.videos = [];
        render();
    });
};

initialize();
