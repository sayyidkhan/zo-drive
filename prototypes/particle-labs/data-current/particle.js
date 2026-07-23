(() => {
  const canvas = document.querySelector(".particle-field");
  const stage = document.querySelector(".lab");
  if (!canvas || !stage) return;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const config = {
    spacing: 15,
    padding: 10,
    headRadius: 36,
    tailMin: 110,
    tailMax: 138,
    tailLifetime: 350,
    maxShift: 7,
    baseRadius: 0.82,
    baseAlpha: 0.2,
  };

  let width = 1;
  let height = 1;
  let ratio = 1;
  let dots = [];
  let pointer = { x: -9999, y: -9999 };
  let previous = { x: -9999, y: -9999, time: 0 };
  let direction = { x: 1, y: 0 };
  let speed = 0;
  let lastMoveAt = -9999;
  let animationFrame = 0;
  let resizeFrame = 0;
  let running = false;

  const clamp = (value, minimum, maximum) =>
    Math.max(minimum, Math.min(maximum, value));

  const smoothstep = (value) => {
    const amount = clamp(value, 0, 1);
    return amount * amount * (3 - 2 * amount);
  };

  const rebuildGrid = () => {
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    dots = [];
    const offsetX =
      config.padding + ((width - config.padding * 2) % config.spacing) / 2;
    const offsetY =
      config.padding + ((height - config.padding * 2) % config.spacing) / 2;

    for (
      let y = offsetY;
      y <= height - config.padding;
      y += config.spacing
    ) {
      for (
        let x = offsetX;
        x <= width - config.padding;
        x += config.spacing
      ) {
        dots.push({ x, y });
      }
    }

    draw(performance.now());
  };

  const sampleCurrent = (dot, wakeStrength) => {
    if (wakeStrength <= 0) return { influence: 0, shiftX: 0, shiftY: 0 };

    const fromHeadX = dot.x - pointer.x;
    const fromHeadY = dot.y - pointer.y;
    const backwardX = -direction.x;
    const backwardY = -direction.y;
    const tailLength =
      config.tailMin +
      (config.tailMax - config.tailMin) * clamp(speed / 0.9, 0, 1);
    const projection =
      fromHeadX * backwardX + fromHeadY * backwardY;

    let influence = 0;
    if (projection >= 0 && projection <= tailLength) {
      const progress = projection / tailLength;
      const centreX = pointer.x + backwardX * projection;
      const centreY = pointer.y + backwardY * projection;
      const distance = Math.hypot(dot.x - centreX, dot.y - centreY);
      const radius = config.headRadius * (1 - progress * 0.72);
      const crossSection = smoothstep(1 - distance / radius);
      const taper = (1 - progress) ** 0.62;
      influence = crossSection * taper;
    }

    const headDistance = Math.hypot(fromHeadX, fromHeadY);
    const headInfluence = smoothstep(1 - headDistance / config.headRadius);
    influence = Math.max(influence, headInfluence * 0.92) * wakeStrength;

    const shift =
      influence *
      (3 + clamp(speed / 0.75, 0, 1) * (config.maxShift - 3));

    return {
      influence,
      shiftX: direction.x * shift,
      shiftY: direction.y * shift,
    };
  };

  const draw = (now) => {
    context.clearRect(0, 0, width, height);

    const age = now - lastMoveAt;
    const wakeStrength = reducedMotion
      ? 0
      : smoothstep(1 - age / config.tailLifetime);
    const gradient = context.createRadialGradient(
      pointer.x,
      pointer.y,
      0,
      pointer.x,
      pointer.y,
      92,
    );
    gradient.addColorStop(0, `rgba(37, 99, 235, ${0.045 * wakeStrength})`);
    gradient.addColorStop(1, "rgba(37, 99, 235, 0)");
    context.fillStyle = gradient;
    context.fillRect(pointer.x - 92, pointer.y - 92, 184, 184);

    for (const dot of dots) {
      const current = sampleCurrent(dot, wakeStrength);
      const radius =
        config.baseRadius + current.influence * 0.78;
      const alpha =
        config.baseAlpha + current.influence * 0.62;

      context.beginPath();
      context.arc(
        dot.x + current.shiftX,
        dot.y + current.shiftY,
        radius,
        0,
        Math.PI * 2,
      );
      context.fillStyle = `rgba(37, 99, 235, ${alpha})`;
      context.fill();
    }

    if (wakeStrength > 0.002) {
      animationFrame = window.requestAnimationFrame(draw);
      return;
    }

    running = false;
  };

  const start = () => {
    if (reducedMotion || running) return;
    running = true;
    animationFrame = window.requestAnimationFrame(draw);
  };

  const handlePointerMove = (event) => {
    if (event.pointerType === "touch") return;

    const bounds = stage.getBoundingClientRect();
    const now = performance.now();
    const next = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    if (previous.time > 0) {
      const deltaTime = Math.max(8, now - previous.time);
      const deltaX = next.x - previous.x;
      const deltaY = next.y - previous.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > 0.5) {
        const nextDirection = { x: deltaX / distance, y: deltaY / distance };
        direction.x = direction.x * 0.58 + nextDirection.x * 0.42;
        direction.y = direction.y * 0.58 + nextDirection.y * 0.42;
        const directionLength = Math.hypot(direction.x, direction.y) || 1;
        direction.x /= directionLength;
        direction.y /= directionLength;
        speed = speed * 0.62 + (distance / deltaTime) * 0.38;
      }
    }

    pointer = next;
    previous = { ...next, time: now };
    lastMoveAt = now;
    start();
  };

  const handlePointerLeave = () => {
    previous.time = 0;
    speed = 0;
  };

  const queueResize = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(rebuildGrid);
  };

  rebuildGrid();
  window.addEventListener("resize", queueResize, { passive: true });

  if (!reducedMotion) {
    stage.addEventListener("pointermove", handlePointerMove, { passive: true });
    stage.addEventListener("pointerleave", handlePointerLeave);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.cancelAnimationFrame(animationFrame);
      running = false;
      return;
    }
    rebuildGrid();
  });

  window.addEventListener(
    "pagehide",
    () => window.cancelAnimationFrame(animationFrame),
    { once: true },
  );
})();
