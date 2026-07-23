(() => {
  const canvas = document.querySelector('.particle-field');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spacing = 6;
  const repulsionRadiusSquared = 3136;
  const damping = 0.92;
  const spring = 0.16;
  const padding = 30;
  const trailLifetime = 430;
  const color = { red: 37, green: 99, blue: 235 };
  const baseAlpha = 118;

  let width = 0;
  let height = 0;
  let dots = [];
  let trail = [];
  let imageData = null;
  let pixels = null;
  let pointerX = -1e9;
  let pointerY = -1e9;
  let lastPointerMove = -1e9;
  let lastTrailX = -1e9;
  let lastTrailY = -1e9;
  let lastTrailTime = 0;
  let animationFrame = 0;
  let animationRunning = false;
  let updateFrame = true;
  let resizeFrame = 0;

  const smoothstep = (value) => value * value * (3 - 2 * value);

  const proximity = (x, y, pointX, pointY, radius) => {
    const deltaX = x - pointX;
    const deltaY = y - pointY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared >= radius * radius) return 0;
    return smoothstep(1 - Math.sqrt(distanceSquared) / radius);
  };

  const paint = () => {
    if (!imageData || !pixels) return;
    pixels.fill(0);

    for (const dot of dots) {
      const x = dot.x | 0;
      const y = dot.y | 0;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const offset = (x + y * width) * 4;
      pixels[offset] = color.red;
      pixels[offset + 1] = color.green;
      pixels[offset + 2] = color.blue;
      pixels[offset + 3] = Math.min(205, Math.round(baseAlpha + dot.energy * 87));
    }

    context.putImageData(imageData, 0, 0);
  };

  const resize = () => {
    width = canvas.width = Math.max(1, hero.clientWidth);
    height = canvas.height = Math.max(1, hero.clientHeight);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    imageData = context.createImageData(width, height);
    pixels = imageData.data;

    const columns = Math.floor((width - padding * 2) / spacing);
    const rows = Math.floor((height - padding * 2) / spacing);
    dots = new Array(Math.max(0, columns * rows));
    let index = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = padding + column * spacing;
        const y = padding + row * spacing;
        dots[index] = {
          x,
          y,
          originX: x,
          originY: y,
          velocityX: 0,
          velocityY: 0,
          energy: 0
        };
        index += 1;
      }
    }

    trail = [];
    paint();
  };

  const animate = (now) => {
    const pointerIsFresh = now - lastPointerMove <= 1200;
    if (!pointerIsFresh) pointerX = pointerY = -1e9;
    trail = trail.filter((point) => now - point.createdAt < trailLifetime);
    updateFrame = !updateFrame;

    if (updateFrame) {
      let moving = false;

      for (const dot of dots) {
        const deltaX = pointerX - dot.x;
        const deltaY = pointerY - dot.y;
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;

        if (distanceSquared < repulsionRadiusSquared && distanceSquared > 0) {
          const force = -repulsionRadiusSquared / distanceSquared;
          const angle = Math.atan2(deltaY, deltaX);
          dot.velocityX += force * Math.cos(angle);
          dot.velocityY += force * Math.sin(angle);
        }

        let targetEnergy = pointerIsFresh
          ? proximity(dot.originX, dot.originY, pointerX, pointerY, 62) * 0.48
          : 0;

        for (const point of trail) {
          const progress = (now - point.createdAt) / trailLifetime;
          const strength = (1 - progress) ** 2 * 0.42;
          if (strength <= targetEnergy) continue;
          const echo = proximity(dot.originX, dot.originY, point.x, point.y, 48) * strength;
          targetEnergy = Math.max(targetEnergy, echo);
        }

        dot.energy += (targetEnergy - dot.energy) * (targetEnergy > dot.energy ? 0.3 : 0.12);
        dot.x += (dot.velocityX *= damping) + (dot.originX - dot.x) * spring;
        dot.y += (dot.velocityY *= damping) + (dot.originY - dot.y) * spring;

        if (!moving && (
          dot.velocityX ** 2 + dot.velocityY ** 2 > 0.01 ||
          Math.abs(dot.x - dot.originX) > 0.4 ||
          Math.abs(dot.y - dot.originY) > 0.4 ||
          Math.abs(targetEnergy - dot.energy) > 0.008
        )) moving = true;
      }

      if (!moving && trail.length === 0) {
        paint();
        animationRunning = false;
        return;
      }
    } else {
      paint();
    }

    animationFrame = window.requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    if (reducedMotion || animationRunning) return;
    animationRunning = true;
    animationFrame = window.requestAnimationFrame(animate);
  };

  const trackPointer = (event) => {
    const bounds = hero.getBoundingClientRect();
    const now = performance.now();
    const nextX = event.clientX - bounds.left;
    const nextY = event.clientY - bounds.top;
    const distanceFromLastTrail = Math.hypot(nextX - lastTrailX, nextY - lastTrailY);

    pointerX = nextX;
    pointerY = nextY;
    lastPointerMove = now;

    if (distanceFromLastTrail > 14 || now - lastTrailTime > 48) {
      trail.push({ x: nextX, y: nextY, createdAt: now });
      if (trail.length > 8) trail.shift();
      lastTrailX = nextX;
      lastTrailY = nextY;
      lastTrailTime = now;
    }

    startAnimation();
  };

  const clearPointer = () => {
    pointerX = pointerY = -1e9;
    lastPointerMove = -1e9;
    lastTrailX = -1e9;
    lastTrailY = -1e9;
    startAnimation();
  };

  const queueResize = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(resize);
  };

  resize();
  if (reducedMotion) return;

  window.addEventListener('resize', queueResize, { passive: true });
  hero.addEventListener('pointermove', trackPointer, { passive: true });
  hero.addEventListener('pointerleave', clearPointer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.cancelAnimationFrame(animationFrame);
      animationRunning = false;
    } else {
      startAnimation();
    }
  });
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(animationFrame), { once: true });
})();
