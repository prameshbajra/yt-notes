const BAR_CONTAINER_ID = 'video-notes-container';
const BAR_ID = 'video-notes-bar';
const BAR_FILL_ID = 'video-notes-bar-fill';
const TOOLTIP_ID = 'video-notes-tooltip';
const NOTE_SUBMIT_EVENT = 'video-notes:note-submitted';
const OBSERVER_OPTIONS = { childList: true, subtree: true };

const progressState = {
    animationId: null,
    video: null
};

const applyStyles = (element, styles) => {
    Object.assign(element.style, styles);
};

const createButton = (label, styles) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    applyStyles(button, styles);
    return button;
};

const createTooltip = () => {
    const tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    applyStyles(tooltip, {
        position: 'absolute',
        top: 'calc(100% + 12px)',
        left: '0',
        display: 'none',
        flexDirection: 'column',
        gap: '12px',
        width: '320px',
        padding: '16px',
        boxSizing: 'border-box',
        backgroundColor: '#202124',
        color: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
        zIndex: '5000'
    });

    const heading = document.createElement('span');
    heading.textContent = 'Add a note';
    applyStyles(heading, {
        fontSize: '16px',
        fontWeight: '500'
    });

    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.placeholder = 'Capture your thoughts about this moment...';
    applyStyles(textarea, {
        width: '100%',
        maxHeight: '200px',
        resize: 'vertical',
        backgroundColor: '#121212',
        color: '#ffffff',
        border: '1px solid #3f3f3f',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '14px',
        boxSizing: 'border-box'
    });

    const actions = document.createElement('div');
    applyStyles(actions, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px'
    });

    const cancelButton = createButton('Cancel', {
        background: 'transparent',
        color: '#aaaaaa',
        border: 'none',
        padding: '8px 12px',
        fontSize: '14px',
        cursor: 'pointer'
    });

    const okButton = createButton('OK', {
        backgroundColor: '#3ea6ff',
        color: '#000000',
        border: 'none',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: '600',
        borderRadius: '999px',
        cursor: 'pointer'
    });

    actions.appendChild(cancelButton);
    actions.appendChild(okButton);

    tooltip.appendChild(heading);
    tooltip.appendChild(textarea);
    tooltip.appendChild(actions);

    return { tooltip, textarea, cancelButton, okButton };
};

const createBarElement = () => {
    const container = document.createElement('div');
    container.id = BAR_CONTAINER_ID;
    applyStyles(container, {
        position: 'relative',
        margin: '16px 0',
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    });

    const header = document.createElement('h2');
    header.textContent = 'Video Notes';
    applyStyles(header, {
        margin: '0',
        color: '#f1f1f1',
        fontSize: '20px',
        fontWeight: '600'
    });

    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.setAttribute('role', 'button');
    bar.setAttribute('aria-controls', TOOLTIP_ID);
    bar.setAttribute('aria-expanded', 'false');
    bar.setAttribute('aria-label', 'Add a video note');
    bar.tabIndex = 0;
    applyStyles(bar, {
        height: '8px',
        borderRadius: '999px',
        backgroundColor: '#3f3f3f',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'transform 120ms ease'
    });

    const fill = document.createElement('div');
    fill.id = BAR_FILL_ID;
    applyStyles(fill, {
        height: '100%',
        width: '100%',
        background: 'linear-gradient(90deg, #3ea6ff 0%, #00ffc6 100%)',
        transformOrigin: 'left center',
        transform: 'scaleX(0)'
    });

    bar.appendChild(fill);

    const { tooltip, textarea, cancelButton, okButton } = createTooltip();

    const toggleTooltip = (shouldShow) => {
        tooltip.style.display = shouldShow ? 'flex' : 'none';
        bar.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
        if (shouldShow) {
            window.requestAnimationFrame(() => textarea.focus());
        }
    };

    const handleToggle = (event) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        const isVisible = tooltip.style.display === 'flex';
        toggleTooltip(!isVisible);
    };

    bar.addEventListener('click', handleToggle);
    bar.addEventListener('keydown', handleToggle);

    cancelButton.addEventListener('click', () => {
        textarea.value = '';
        toggleTooltip(false);
    });

    okButton.addEventListener('click', () => {
        const note = textarea.value.trim();
        window.dispatchEvent(new CustomEvent(NOTE_SUBMIT_EVENT, { detail: { note } }));
        toggleTooltip(false);
    });

    tooltip.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            toggleTooltip(false);
        }
    });

    container.appendChild(header);
    container.appendChild(bar);
    container.appendChild(tooltip);

    return container;
};

const getVideoElement = () => document.querySelector('video.html5-main-video');

const updateProgressFill = (video, fill) => {
    if (!video || !fill || !Number.isFinite(video.duration) || video.duration <= 0) {
        fill.style.transform = 'scaleX(0)';
        return;
    }

    const progress = Math.min(Math.max(video.currentTime / video.duration, 0), 1);
    fill.style.transform = `scaleX(${progress})`;
};

const resetProgressFill = () => {
    const fill = document.getElementById(BAR_FILL_ID);
    if (fill) {
        fill.style.transform = 'scaleX(0)';
    }
};

const handleVideoMetadata = () => startProgressSync();

const stopProgressSync = () => {
    if (progressState.animationId !== null) {
        window.cancelAnimationFrame(progressState.animationId);
        progressState.animationId = null;
    }

    if (progressState.video) {
        progressState.video.removeEventListener('loadedmetadata', handleVideoMetadata);
        progressState.video = null;
    }

    resetProgressFill();
};

const startProgressSync = () => {
    const fill = document.getElementById(BAR_FILL_ID);
    const video = getVideoElement();

    if (!fill || !video) {
        stopProgressSync();
        return;
    }

    if (progressState.video !== video) {
        if (progressState.video) {
            progressState.video.removeEventListener('loadedmetadata', handleVideoMetadata);
        }

        progressState.video = video;
        progressState.video.addEventListener('loadedmetadata', handleVideoMetadata);
    }

    if (progressState.animationId !== null) {
        window.cancelAnimationFrame(progressState.animationId);
        progressState.animationId = null;
    }

    const sync = () => {
        if (!document.body.contains(fill) || !document.body.contains(video)) {
            stopProgressSync();
            return;
        }

        updateProgressFill(video, fill);
        progressState.animationId = window.requestAnimationFrame(sync);
    };

    sync();
};

const locateTitleContainer = () => document.querySelector('#primary-inner ytd-watch-metadata #title');

const insertBar = () => {
    const player = document.getElementById('player');
    const titleContainer = locateTitleContainer();
    const metadataContainer = titleContainer ? titleContainer.parentElement : null;

    if (!player || !titleContainer || !metadataContainer) {
        return false;
    }

    if (document.getElementById(BAR_CONTAINER_ID)) {
        return true;
    }

    const barContainer = createBarElement();
    metadataContainer.insertBefore(barContainer, titleContainer);

    return true;
};

const ensureUiReady = () => {
    const inserted = insertBar();
    if (inserted) {
        startProgressSync();
    } else {
        stopProgressSync();
    }
    return inserted;
};

const observer = new MutationObserver(() => {
    if (ensureUiReady()) {
        observer.disconnect();
    }
});

const startObserving = () => {
    if (!document.body) {
        return;
    }

    observer.disconnect();
    observer.observe(document.body, OBSERVER_OPTIONS);
};

const initialize = () => {
    if (!ensureUiReady()) {
        startObserving();
    }
};

initialize();

['yt-navigate-finish', 'yt-page-data-updated'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
        if (!ensureUiReady()) {
            startObserving();
        }
    });
});
