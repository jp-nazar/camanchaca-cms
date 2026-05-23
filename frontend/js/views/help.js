
// Help guides + FAQ are documentation. Page chrome is translated; the body
// content is intentionally left in English because partial machine
// translation of multi-paragraph docs reads worse than a single source of
// truth. A native-language docs site is the right long-term answer.
export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h1>${'Centro de ayuda'}</h1><div class="subtitle">${'Guías rápidas y preguntas frecuentes'}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:32px">
      ${[
        { icon: '&#128250;', title: 'Setting Up a Display', steps: ['Download the APK or open the Web Player', 'Enter your server URL', 'Note the 6-digit pairing code', 'Click "Add Display" in the dashboard and enter the code', 'Assign content to the display\'s playlist'] },
        { icon: '&#128228;', title: 'Uploading Content', steps: ['Go to Content Library', 'Drag and drop files or click the upload area', 'Supports MP4, WebM, JPEG, PNG, GIF, WebP', 'Videos auto-detect duration and generate thumbnails', 'Use Remote URL to stream from external sources'] },
        { icon: '&#128203;', title: 'Multi-Zone Layouts', steps: ['Go to Layouts and create a new layout or use a template', 'Drag zones to position them on the canvas', 'Resize using the corner handle', 'Assign the layout to a device in the Playlist tab', 'Each zone can show different content'] },
        { icon: '&#128197;', title: 'Content Scheduling', steps: ['Go to Schedule and select a device', 'Click "Add Schedule" to create a time slot', 'Set start/end times and recurrence rules', 'Higher priority schedules override lower ones', 'Content auto-switches based on the schedule'] },
        { icon: '&#128421;', title: 'Remote Control', steps: ['Go to a device\'s detail page', 'Click the "Remote Control" tab', 'Click "Start Remote" to begin streaming', 'Use the d-pad, volume, and power buttons', 'Click anywhere on the screen to simulate a tap'] },
        { icon: '&#127916;', title: 'Video Walls', steps: ['Go to Video Walls and create a new wall', 'Set the grid size (e.g., 2x2)', 'Drag devices onto grid positions', 'Set bezel compensation if needed', 'Assign content to play across all displays'] },
      ].map(guide => `
        <div class="settings-section" style="margin:0">
          <h3 style="font-size:15px">${guide.icon} ${guide.title}</h3>
          <ol style="padding-left:20px;list-style:decimal;margin-top:8px">
            ${guide.steps.map(s => `<li style="color:var(--text-secondary);font-size:13px;line-height:1.8">${s}</li>`).join('')}
          </ol>
        </div>
      `).join('')}
    </div>

    <div class="settings-section">
      <h3>${'Atajos de teclado'}</h3>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:13px">
        <kbd style="background:var(--bg-input);padding:2px 8px;border-radius:4px;font-family:monospace">Esc</kbd> <span style="color:var(--text-secondary)">${'Reiniciar reproductor web (en la página del reproductor)'}</span>
        <kbd style="background:var(--bg-input);padding:2px 8px;border-radius:4px;font-family:monospace">F</kbd> <span style="color:var(--text-secondary)">${'Alternar pantalla completa (reproductor web)'}</span>
      </div>
    </div>
  `;
}

export function cleanup() {}
