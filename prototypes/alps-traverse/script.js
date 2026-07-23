const summitLinks = document.querySelectorAll('[data-summit]');
const summitCards = document.querySelectorAll('[data-card]');

const activateSummit = (name) => {
  summitLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.summit === name));
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) activateSummit(entry.target.dataset.card);
  });
}, { rootMargin: '-35% 0px -45% 0px', threshold: 0.08 });

summitCards.forEach((card) => observer.observe(card));

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
