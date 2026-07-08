// keyboard.js — Keyboard navigation controller

export class KeyboardController {
    constructor(app) {
        this.app = app;
        this.currentPanel = 0; // 0=GEO, 1=ENV, 2=MKT, 3=INF
        this.currentRowIndex = 0;
        this.filterMode = false;
        this.bind();
    }

    bind() {
        document.addEventListener('keydown', (e) => this.handleKey(e));
    }

    handleKey(e) {
        // Don't interfere with input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();
        const mode = this.app.currentMode;

        // Global keys
        switch (key) {
            case 'escape':
                if (this.filterMode) {
                    this.filterMode = false;
                    this.app.render();
                } else {
                    this.app.closeDetail();
                    this.app.closeLeaflet();
                }
                e.preventDefault();
                return;
            case '1':
                this.app.setMode('default');
                e.preventDefault();
                return;
            case 't':
                this.app.setMode('timeline');
                e.preventDefault();
                return;
            case 'x':
                this.app.setMode('metrics');
                e.preventDefault();
                return;
            case 'q':
                this.app.setMode('minimal');
                e.preventDefault();
                return;
            case 'w':
                if (this.app.selectedEvent) {
                    this.app.toggleWatch(this.app.selectedEvent);
                } else {
                    this.app.setMode('watchlist');
                }
                e.preventDefault();
                return;
            case 'm':
                if (this.app.selectedEvent && this.app.selectedEvent.lat != null) {
                    this.app.openLeafletForEvent(this.app.selectedEvent);
                } else {
                    this.app.openLeaflet();
                }
                e.preventDefault();
                return;
            case 'f':
                if (this.app.selectedEvent) {
                    this.app.setMode('focused');
                } else {
                    this.filterMode = !this.filterMode;
                    this.app.render();
                }
                e.preventDefault();
                return;
        }

        // Filter mode keys
        if (this.filterMode) {
            switch (key) {
                case 'c': this.app.toggleFilter('CRITICAL'); e.preventDefault(); return;
                case 'h': this.app.toggleFilter('HIGH'); e.preventDefault(); return;
                case 'm': this.app.toggleFilter('MEDIUM'); e.preventDefault(); return;
                case 'l': this.app.toggleFilter('LOW'); e.preventDefault(); return;
            }
            return;
        }

        // Navigation keys (only in default mode)
        if (mode === 'default') {
            switch (key) {
                case 'h':
                    this.moveLeft();
                    e.preventDefault();
                    break;
                case 'l':
                    this.moveRight();
                    e.preventDefault();
                    break;
                case 'j':
                    this.moveDown();
                    e.preventDefault();
                    break;
                case 'k':
                    this.moveUp();
                    e.preventDefault();
                    break;
                case 'g':
                    this.currentRowIndex = 0;
                    this.highlightRow();
                    e.preventDefault();
                    break;
                case 'G'.toLowerCase():
                    this.currentRowIndex = 999;
                    this.highlightRow();
                    e.preventDefault();
                    break;
                case 'enter':
                    this.openSelected();
                    e.preventDefault();
                    break;
            }
        }

        // Panel jump keys
        if (mode === 'default') {
            const panelMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
            // Use shift+number or just the number for panels when not in mode context
            // Actually 1 is already used for default mode, so use the keys differently
            // Let's use !@#$ or just the number row for panels
            if (e.shiftKey) {
                const shiftMap = { '!': 0, '@': 1, '#': 2, '$': 3 };
                if (shiftMap[key]) {
                    this.currentPanel = shiftMap[key];
                    this.currentRowIndex = 0;
                    this.highlightRow();
                    e.preventDefault();
                }
            }
        }
    }

    moveLeft() {
        if (this.currentPanel > 0) {
            this.currentPanel--;
            this.currentRowIndex = 0;
            this.highlightRow();
        }
    }

    moveRight() {
        if (this.currentPanel < 3) {
            this.currentPanel++;
            this.currentRowIndex = 0;
            this.highlightRow();
        }
    }

    moveDown() {
        this.currentRowIndex++;
        this.highlightRow();
    }

    moveUp() {
        if (this.currentRowIndex > 0) {
            this.currentRowIndex--;
            this.highlightRow();
        }
    }

    highlightRow() {
        const feeds = ['GEO', 'ENV', 'MKT', 'INF'];
        const feed = feeds[this.currentPanel];

        // Remove all highlights
        document.querySelectorAll('.feed-panel').forEach(p => p.classList.remove('selected'));
        document.querySelectorAll('.event-row').forEach(r => r.classList.remove('selected'));

        // Highlight current panel
        const panel = document.querySelector(`.feed-panel[data-feed="${feed}"]`);
        if (panel) panel.classList.add('selected');

        // Highlight current row
        const panelBody = document.getElementById(`panel-${feed}`);
        if (panelBody) {
            const rows = panelBody.querySelectorAll('.event-row');
            if (rows.length === 0) return;
            if (this.currentRowIndex >= rows.length) this.currentRowIndex = rows.length - 1;
            if (this.currentRowIndex < 0) this.currentRowIndex = 0;
            rows[this.currentRowIndex].classList.add('selected');
            rows[this.currentRowIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });

            // Update selected event
            const eventId = rows[this.currentRowIndex].dataset.eventId;
            const event = this.app.allEvents.find(e => e.id === eventId);
            if (event) {
                this.app.selectedEvent = event;
            }
        }
    }

    openSelected() {
        if (this.app.selectedEvent) {
            this.app.openDetail(this.app.selectedEvent);
        }
    }

    getSelectedEvent() {
        return this.app.selectedEvent;
    }
}