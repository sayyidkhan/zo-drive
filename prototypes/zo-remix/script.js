const panels = {
  storage: { label: '01 / STORAGE', title: 'A Drive that stays<br /><em>on your side.</em>', text: 'Your files stay on the Zo machine you control, with an interface that makes them feel effortless to manage.', link: 'Explore Zo Drive storage', window: 'My Drive / Product', visual: '<div class="mock-title">Product workspace</div><div class="mock-sub">Folders that stay on your Zo</div><div class="storage-folders"><div><i>▰</i><b>Strategy</b><span>12 files</span></div><div><i>▰</i><b>Launch</b><span>28 files</span></div><div><i>▰</i><b>Research</b><span>9 files</span></div></div>' },
  share: { label: '02 / SHARING', title: 'Share the work.<br /><em>Keep the control.</em>', text: 'Send a folder, create an expiry or revoke a link—without turning your Drive into an open door.', link: 'Explore controlled sharing', window: 'Share / Partner launch assets', visual: '<div class="mock-title">Partner launch assets</div><div class="mock-sub">Shared with 4 people · Expires Aug 01</div><div class="storage-folders"><div><i>↗</i><b>Passcode</b><span>Enabled</span></div><div><i>◷</i><b>Expiry</b><span>14 days</span></div><div><i>✓</i><b>Access</b><span>View only</span></div></div>' },
  build: { label: '03 / WORKFLOWS', title: 'Let the work<br /><em>keep working.</em>', text: 'Use the same private Drive from the browser, the terminal, a function or your own TypeScript integration.', link: 'Explore Zo workflows', window: 'Functions / weekly-report.js', visual: '<div class="mock-title">weekly-report.js</div><div class="mock-sub">A function that lives beside the files it uses</div><div class="storage-folders"><div><i>⌘</i><b>Schedule</b><span>Mon · 09:00</span></div><div><i>✓</i><b>Latest run</b><span>143 ms</span></div><div><i>⌁</i><b>Input</b><span>Drive data</span></div></div>' },
  ai: { label: '04 / ZOMINAI', title: 'Ask better questions<br /><em>where the work lives.</em>', text: 'Bring useful local intelligence to your Drive while the context stays bounded by your control.', link: 'Explore ZominAI', window: 'ZominAI / Private context', visual: '<div class="mock-title">What changed in the Q3 roadmap?</div><div class="mock-sub">Searching approved Drive context</div><div class="storage-folders"><div><i>✦</i><b>Context</b><span>4 documents</span></div><div><i>⌁</i><b>Runtime</b><span>Local</span></div><div><i>✓</i><b>Access</b><span>Read only</span></div></div>' }
};

const fillStage = (key) => {
  const panel = panels[key];
  document.getElementById('stage-label').innerHTML = `<span></span>${panel.label}`;
  document.getElementById('stage-title').innerHTML = panel.title;
  document.getElementById('stage-text').textContent = panel.text;
  document.getElementById('stage-link').innerHTML = `${panel.link} <span>→</span>`;
  document.getElementById('stage-window-title').textContent = panel.window;
  document.getElementById('stage-content').innerHTML = panel.visual;
};

document.querySelectorAll('.capability').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.capability').forEach((item) => item.classList.toggle('active', item === button));
  fillStage(button.dataset.panel);
}));

fillStage('storage');
document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
  const target = document.querySelector(link.getAttribute('href'));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
