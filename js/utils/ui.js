/**
 * js/utils/ui.js
 * Shared UI helpers: icons, HTML escaping, question type metadata, formatting
 */
(function() {
    const ICONS = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
        questions: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        teams: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
        settings: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        minus: '<path d="M5 12h14"/>',
        trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
        external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
        menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
        moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
        inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
        eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
        maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
        timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
        zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
        list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
        award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'
    };

    const QUESTION_TYPES = {
        mcq: { label: 'Multiple Choice', short: 'MCQ', hint: 'Options A–D, one correct' },
        calculation: { label: 'Calculation', short: 'Calc', hint: 'Numerical answer + unit' },
        theory: { label: 'Theory', short: 'Theory', hint: 'Short written answer' },
        true_false: { label: 'True / False', short: 'T/F', hint: 'Binary answer' }
    };

    const UI = {
        QUESTION_TYPES: QUESTION_TYPES,

        icon: function(name, extraClass = '') {
            const paths = ICONS[name] || '';
            return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
        },

        escapeHtml: function(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        stripHtml: function(value) {
            return String(value == null ? '' : value).replace(/<[^>]+>/g, '');
        },

        typeLabel: function(type) {
            return (QUESTION_TYPES[type] && QUESTION_TYPES[type].label) || type;
        },

        typeChip: function(type) {
            const meta = QUESTION_TYPES[type];
            return `<span class="type-chip type-${type}">${meta ? meta.short : UI.escapeHtml(type)}</span>`;
        },

        statusBadge: function(status) {
            return `<span class="badge badge-dot badge-${status}">${UI.escapeHtml(status)}</span>`;
        },

        teamColor: function(team) {
            return (team && team.color) || '#3b82f6';
        },

        teamName: function(teamId) {
            const team = window.QuizBowl.Data.TeamsDB.getById(teamId);
            return team ? team.name : 'Unknown team';
        },

        initials: function(name) {
            const words = String(name || '?').replace(/^team\s+/i, '').trim().split(/\s+/);
            return ((words[0] || '?').charAt(0) + (words[1] ? words[1].charAt(0) : '')).toUpperCase();
        },

        timeAgo: function(timestamp) {
            const seconds = Math.round((Date.now() - timestamp) / 1000);
            if (seconds < 45) return 'just now';
            const minutes = Math.round(seconds / 60);
            if (minutes < 60) return `${minutes} min ago`;
            const hours = Math.round(minutes / 60);
            if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
            return new Date(timestamp).toLocaleDateString();
        },

        emptyState: function(icon, title, message, actionHtml = '') {
            return `
                <div class="empty-state">
                    ${UI.icon(icon)}
                    <h3>${title}</h3>
                    <p>${message}</p>
                    ${actionHtml}
                </div>
            `;
        },

        // Replace <span data-icon="name"></span> placeholders in static HTML
        hydrateIcons: function(root = document) {
            root.querySelectorAll('[data-icon]').forEach(el => {
                el.outerHTML = UI.icon(el.getAttribute('data-icon'));
            });
        }
    };

    window.QuizBowl.Utils.UI = UI;

    document.addEventListener('DOMContentLoaded', () => UI.hydrateIcons());
})();
