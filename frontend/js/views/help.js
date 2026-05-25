
import { t } from '../i18n.js';

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h1>${t('help.title')}</h1><div class="subtitle">${t('help.subtitle')}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:32px">
      ${[
        { icon: '&#128250;', title: t('help.guide_display_title'), steps: [t('help.guide_display_1'), t('help.guide_display_2'), t('help.guide_display_3'), t('help.guide_display_4'), t('help.guide_display_5')] },
        { icon: '&#128228;', title: t('help.guide_upload_title'), steps: [t('help.guide_upload_1'), t('help.guide_upload_2'), t('help.guide_upload_3'), t('help.guide_upload_4'), t('help.guide_upload_5')] },
        { icon: '&#128203;', title: t('help.guide_layouts_title'), steps: [t('help.guide_layouts_1'), t('help.guide_layouts_2'), t('help.guide_layouts_3'), t('help.guide_layouts_4'), t('help.guide_layouts_5')] },
        { icon: '&#128197;', title: t('help.guide_schedule_title'), steps: [t('help.guide_schedule_1'), t('help.guide_schedule_2'), t('help.guide_schedule_3'), t('help.guide_schedule_4'), t('help.guide_schedule_5')] },
        { icon: '&#128421;', title: t('help.guide_remote_title'), steps: [t('help.guide_remote_1'), t('help.guide_remote_2'), t('help.guide_remote_3'), t('help.guide_remote_4'), t('help.guide_remote_5')] },
        { icon: '&#127916;', title: t('help.guide_walls_title'), steps: [t('help.guide_walls_1'), t('help.guide_walls_2'), t('help.guide_walls_3'), t('help.guide_walls_4'), t('help.guide_walls_5')] },
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
