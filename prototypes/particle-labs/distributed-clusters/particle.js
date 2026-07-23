(() => {
  const canvas = document.querySelector(".particle-canvas");
  const stage = document.querySelector(".lab");
  if (!canvas || !stage) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const palette = {
    blue: "37, 99, 235",
    deepBlue: "18, 69, 166",
    label: "63, 91, 124",
    surface: "246, 250, 255"
  };

  const clusterBlueprints = [
    { x: 0.6, y: 0.28, radiusX: 86, radiusY: 58, count: 76, label: "HOME" },
    { x: 0.79, y: 0.43, radiusX: 72, radiusY: 82, count: 68, label: "STUDIO" },
    { x: 0.57, y: 0.7, radiusX: 96, radiusY: 62, count: 82, label: "TEAM" },
    { x: 0.83, y: 0.74, radiusX: 70, radiusY: 54, count: 62, label: "ARCHIVE" }
  ];

  const routeBlueprints = [
    { from: 0, to: 1, bend: -0.12, duration: 4800, offset: 0.08 },
    { from: 1, to: 3, bend: 0.11, duration: 5700, offset: 0.46 },
    { from: 3, to: 2, bend: 0.16, duration: 5200, offset: 0.72 },
    { from: 2, to: 0, bend: -0.1, duration: 6200, offset: 0.34 },
    { from: 0, to: 2, bend: 0.12, duration: 7000, offset: 0.88 }
  ];

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let clusters = [];
  let packets = [];
  let pointer = { x: -1000, y: -1000, active: false };
  let resizeFrame = 0;
  let animationFrame = 0;
  let previousTime = 0;

  const seededRandom = (seed) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  const smoothstep = (value) => {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  };

  const getResponsiveScale = () => {
    if (width < 520) return 0.62;
    if (width < 900) return 0.8;
    return Math.min(1.08, Math.max(0.9, width / 1440));
  };

  const getClusterPosition = (blueprint) => {
    const mobile = width < 820;
    if (mobile) {
      return {
        x: width * blueprint.x,
        y: height * (0.13 + (blueprint.y - 0.24) * 0.72)
      };
    }
    return { x: width * blueprint.x, y: height * blueprint.y };
  };

  const createClusters = () => {
    const scale = getResponsiveScale();

    clusters = clusterBlueprints.map((blueprint, clusterIndex) => {
      const position = getClusterPosition(blueprint);
      const count = Math.round(blueprint.count * Math.max(0.7, scale));
      const particles = [];

      for (let index = 0; index < count; index += 1) {
        const radialSeed = seededRandom(index * 2.17 + clusterIndex * 101);
        const angleSeed = seededRandom(index * 4.71 + clusterIndex * 29);
        const radius = Math.sqrt(radialSeed);
        const angle = angleSeed * Math.PI * 2;
        const edgeNoise =
          0.78 + seededRandom(index * 8.13 + clusterIndex * 17) * 0.34;

        particles.push({
          localX:
            Math.cos(angle) * blueprint.radiusX * scale * radius * edgeNoise,
          localY:
            Math.sin(angle) * blueprint.radiusY * scale * radius * edgeNoise,
          size: 0.65 + seededRandom(index * 5.33 + clusterIndex) * 1.15,
          alpha: 0.18 + seededRandom(index * 9.71 + clusterIndex) * 0.35,
          drift: 0.8 + seededRandom(index * 3.4 + clusterIndex) * 1.6,
          phase: seededRandom(index * 7.9 + clusterIndex) * Math.PI * 2
        });
      }

      return {
        ...blueprint,
        x: position.x,
        y: position.y,
        offsetX: 0,
        offsetY: 0,
        velocityX: 0,
        velocityY: 0,
        particles
      };
    });
  };

  const createPackets = () => {
    packets = routeBlueprints.map((route, index) => ({
      ...route,
      startedAt: performance.now() - route.duration * route.offset,
      size: index % 2 === 0 ? 2.15 : 1.8
    }));
  };

  const resize = () => {
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    createClusters();
    createPackets();

    if (reducedMotion) {
      draw(0);
    }
  };

  const getPointOnRoute = (route, progress) => {
    const from = clusters[route.from];
    const to = clusters[route.to];
    const startX = from.x + from.offsetX;
    const startY = from.y + from.offsetY;
    const endX = to.x + to.offsetX;
    const endY = to.y + to.offsetY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const length = Math.max(1, Math.hypot(deltaX, deltaY));
    const controlX = (startX + endX) / 2 - (deltaY / length) * length * route.bend;
    const controlY = (startY + endY) / 2 + (deltaX / length) * length * route.bend;
    const inverse = 1 - progress;

    return {
      x:
        inverse * inverse * startX +
        2 * inverse * progress * controlX +
        progress * progress * endX,
      y:
        inverse * inverse * startY +
        2 * inverse * progress * controlY +
        progress * progress * endY
    };
  };

  const drawCluster = (cluster, now, clusterIndex) => {
    const x = cluster.x + cluster.offsetX;
    const y = cluster.y + cluster.offsetY;
    const pulse = reducedMotion ? 0 : Math.sin(now * 0.00055 + clusterIndex) * 0.5;

    context.save();
    context.translate(x, y);

    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 80);
    glow.addColorStop(0, `rgba(${palette.blue}, 0.075)`);
    glow.addColorStop(1, `rgba(${palette.blue}, 0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 80, 0, Math.PI * 2);
    context.fill();

    for (const particle of cluster.particles) {
      const driftX = reducedMotion
        ? 0
        : Math.cos(now * 0.00022 * particle.drift + particle.phase) * 1.35;
      const driftY = reducedMotion
        ? 0
        : Math.sin(now * 0.00018 * particle.drift + particle.phase) * 1.1;
      context.fillStyle = `rgba(${palette.blue}, ${particle.alpha})`;
      context.beginPath();
      context.arc(
        particle.localX + driftX,
        particle.localY + driftY,
        particle.size,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    context.fillStyle = `rgba(${palette.deepBlue}, 0.84)`;
    context.beginPath();
    context.arc(0, 0, 3.2 + pulse * 0.35, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = `rgba(${palette.blue}, 0.17)`;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(0, 0, 10 + pulse, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    const labelY = y + cluster.radiusY * getResponsiveScale() + 23;
    context.font =
      '600 9px "SFMono-Regular", Consolas, "Liberation Mono", monospace';
    context.textAlign = "center";
    context.letterSpacing = "1.2px";
    context.fillStyle = `rgba(${palette.label}, 0.74)`;
    context.fillText(cluster.label, x, labelY);
  };

  const drawPacket = (packet, now) => {
    const progress =
      ((now - packet.startedAt) % packet.duration) / packet.duration;
    const visibility =
      smoothstep(Math.min(progress / 0.12, (1 - progress) / 0.12)) * 0.9;
    const tailSteps = 4;

    for (let step = tailSteps; step >= 0; step -= 1) {
      const trailProgress = Math.max(0, progress - step * 0.009);
      const point = getPointOnRoute(packet, trailProgress);
      const alpha = visibility * (1 - step / (tailSteps + 0.65));
      const size = packet.size * (1 - step * 0.12);
      context.fillStyle = `rgba(${palette.blue}, ${alpha})`;
      context.beginPath();
      context.arc(point.x, point.y, size, 0, Math.PI * 2);
      context.fill();
    }
  };

  const updateClusters = (deltaTime) => {
    const nearest = clusters.reduce(
      (result, cluster, index) => {
        const distance = Math.hypot(
          pointer.x - cluster.x,
          pointer.y - cluster.y
        );
        return distance < result.distance ? { index, distance } : result;
      },
      { index: -1, distance: Infinity }
    );

    clusters.forEach((cluster, index) => {
      let targetX = 0;
      let targetY = 0;

      if (pointer.active && index === nearest.index && nearest.distance < 190) {
        const deltaX = cluster.x - pointer.x;
        const deltaY = cluster.y - pointer.y;
        const distance = Math.max(1, nearest.distance);
        const strength = smoothstep(1 - distance / 190) * 11;
        targetX = (deltaX / distance) * strength;
        targetY = (deltaY / distance) * strength;
      }

      const frameScale = Math.min(2, deltaTime / 16.67);
      cluster.velocityX +=
        (targetX - cluster.offsetX) * 0.045 * frameScale;
      cluster.velocityY +=
        (targetY - cluster.offsetY) * 0.045 * frameScale;
      cluster.velocityX *= Math.pow(0.84, frameScale);
      cluster.velocityY *= Math.pow(0.84, frameScale);
      cluster.offsetX += cluster.velocityX * frameScale;
      cluster.offsetY += cluster.velocityY * frameScale;
    });
  };

  const draw = (now) => {
    context.clearRect(0, 0, width, height);
    clusters.forEach((cluster, index) => drawCluster(cluster, now, index));

    if (!reducedMotion) {
      packets.forEach((packet) => drawPacket(packet, now));
    } else {
      routeBlueprints.slice(0, 3).forEach((packet, index) => {
        const point = getPointOnRoute(packet, 0.3 + index * 0.18);
        context.fillStyle = `rgba(${palette.blue}, 0.55)`;
        context.beginPath();
        context.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
        context.fill();
      });
    }
  };

  const animate = (now) => {
    const deltaTime = previousTime ? Math.min(40, now - previousTime) : 16.67;
    previousTime = now;
    updateClusters(deltaTime);
    draw(now);
    animationFrame = window.requestAnimationFrame(animate);
  };

  const trackPointer = (event) => {
    const bounds = stage.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  };

  const clearPointer = () => {
    pointer.active = false;
  };

  const queueResize = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(resize);
  };

  resize();

  if (!reducedMotion) {
    animationFrame = window.requestAnimationFrame(animate);
    stage.addEventListener("pointermove", trackPointer, { passive: true });
    stage.addEventListener("pointerleave", clearPointer);
    window.addEventListener("resize", queueResize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.cancelAnimationFrame(animationFrame);
      } else {
        previousTime = 0;
        animationFrame = window.requestAnimationFrame(animate);
      }
    });
    window.addEventListener(
      "pagehide",
      () => window.cancelAnimationFrame(animationFrame),
      { once: true }
    );
  } else {
    window.addEventListener("resize", queueResize, { passive: true });
  }
})();
