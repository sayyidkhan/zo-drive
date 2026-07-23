const states = {
  vault: ['01 / VAULT', 'Storage should be<br />a foundation, not a funnel.', 'Keep objects, folders and native workspaces in a place that is governed by your rules.', 'CONTROL SURFACE', 'LOCAL + PORTABLE'],
  share: ['02 / RELAY', 'Collaboration should<br />never cost control.', 'Invite the right people into the work, then adjust or revoke access when the route changes.', 'ACCESS MODEL', 'VISIBLE + REVOCABLE'],
  ai: ['03 / SIGNAL', 'Intelligence works best<br />inside the context.', 'Let native AI surface what matters from the material your team already owns.', 'AI POSTURE', 'CONTEXTUAL + PRIVATE'],
  build: ['04 / FORGE', 'The route keeps growing<br />with your work.', 'Connect browser, CLI and API access without rebuilding the terrain around every new workflow.', 'EXTENSIBILITY', 'BROWSER + CLI + API']
};
const fields = document.querySelectorAll('.display-label, .map-display h3, .display-copy, .metric span, .metric b');
document.querySelectorAll('.node').forEach((node) => node.addEventListener('click', () => {
  document.querySelectorAll('.node').forEach((item) => item.classList.toggle('active', item === node));
  states[node.dataset.node].forEach((value, index) => { fields[index].innerHTML = value; });
}));
document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => { const target = document.querySelector(link.getAttribute('href')); if (target) { event.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); } }));
