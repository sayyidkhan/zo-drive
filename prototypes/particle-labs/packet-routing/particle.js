(() => {
  "use strict";

  const canvas = document.querySelector(".particle-field");
  const destination = document.querySelector(".drive-card");
  if (!canvas || !destination) return;

  const context = canvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: -1000, y: -1000, active: false };
  const packetCount = 26;
  const packets = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let previousTime = performance.now();
  let destinationRect = null;

  const clamp = (value, minimum, maximum) =>
    Math.max(minimum, Math.min(maximum, value));

  const mix = (a, b, amount) => a + (b - a) * amount;

  function cubicPoint(route, time) {
    const inverse = 1 - time;
    const inverseSquared = inverse * inverse;
    const timeSquared = time * time;

    return {
      x:
        inverseSquared * inverse * route.start.x +
        3 * inverseSquared * time * route.controlA.x +
        3 * inverse * timeSquared * route.controlB.x +
        timeSquared * time * route.end.x,
      y:
        inverseSquared * inverse * route.start.y +
        3 * inverseSquared * time * route.controlA.y +
        3 * inverse * timeSquared * route.controlB.y +
        timeSquared * time * route.end.y,
    };
  }

  function cubicTangent(route, time) {
    const inverse = 1 - time;
    return {
      x:
        3 * inverse * inverse * (route.controlA.x - route.start.x) +
        6 * inverse * time * (route.controlB.x - route.controlA.x) +
        3 * time * time * (route.end.x - route.controlB.x),
      y:
        3 * inverse * inverse * (route.controlA.y - route.start.y) +
        6 * inverse * time * (route.controlB.y - route.controlA.y) +
        3 * time * time * (route.end.y - route.controlB.y),
    };
  }

  function hash(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function measureDestination() {
    const rect = destination.getBoundingClientRect();
    destinationRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function createRoute(index) {
    const lane = hash(index + 2.13);
    const side = index % 5;
    const destinationY =
      destinationRect.top +
      destinationRect.height * (0.26 + hash(index + 8.6) * 0.46);
    let start;

    if (side === 0) {
      start = { x: -30, y: height * (0.1 + lane * 0.8) };
    } else if (side === 1) {
      start = { x: width * (0.1 + lane * 0.38), y: -24 };
    } else if (side === 2) {
      start = { x: width * (0.07 + lane * 0.42), y: height + 24 };
    } else {
      start = {
        x: -25,
        y: height * (0.28 + lane * 0.52),
      };
    }

    const end = {
      x: destinationRect.left + Math.min(18, destinationRect.width * 0.04),
      y: destinationY,
    };
    const span = end.x - start.x;
    const curve = (hash(index + 14.3) - 0.5) * Math.min(260, height * 0.28);

    return {
      start,
      controlA: {
        x: start.x + span * (0.28 + hash(index + 4.2) * 0.12),
        y: start.y + curve,
      },
      controlB: {
        x: start.x + span * (0.68 + hash(index + 5.8) * 0.11),
        y: end.y - curve * 0.58 + (hash(index + 1.7) - 0.5) * 90,
      },
      end,
    };
  }

  function resetPackets() {
    packets.length = 0;
    for (let index = 0; index < packetCount; index += 1) {
      packets.push({
        route: createRoute(index),
        progress: hash(index + 22.9),
        speed: 0.055 + hash(index + 31.4) * 0.045,
        size: 1.25 + hash(index + 44.2) * 1.05,
        alpha: 0.42 + hash(index + 53.9) * 0.35,
        tail: 0.012 + hash(index + 63.1) * 0.009,
      });
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureDestination();
    resetPackets();
    render(0);
  }

  function drawGrid() {
    const spacing = width < 600 ? 18 : 16;
    const radius = width < 600 ? 0.65 : 0.72;
    context.save();
    context.fillStyle = "rgba(37, 99, 235, 0.115)";

    for (let x = spacing / 2; x < width; x += spacing) {
      for (let y = spacing / 2; y < height; y += spacing) {
        if (
          destinationRect &&
          x > destinationRect.left - 8 &&
          x < destinationRect.left + destinationRect.width + 8 &&
          y > destinationRect.top - 8 &&
          y < destinationRect.top + destinationRect.height + 8
        ) {
          continue;
        }
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function bendPoint(point, progress) {
    if (!pointer.active || progress > 0.91) return point;

    const offsetX = point.x - pointer.x;
    const offsetY = point.y - pointer.y;
    const distanceSquared = offsetX * offsetX + offsetY * offsetY;
    const influenceRadius = 78;

    if (distanceSquared >= influenceRadius * influenceRadius || distanceSquared < 1) {
      return point;
    }

    const distance = Math.sqrt(distanceSquared);
    const influence = Math.pow(1 - distance / influenceRadius, 2);
    const arrivalDamping = clamp((0.91 - progress) / 0.18, 0, 1);
    const bend = 15 * influence * arrivalDamping;

    return {
      x: point.x + (offsetX / distance) * bend,
      y: point.y + (offsetY / distance) * bend,
    };
  }

  function drawPacket(packet) {
    const headPoint = bendPoint(cubicPoint(packet.route, packet.progress), packet.progress);
    const tangent = cubicTangent(packet.route, packet.progress);
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const directionX = tangent.x / tangentLength;
    const directionY = tangent.y / tangentLength;
    const fadeIn = clamp(packet.progress / 0.08, 0, 1);
    const fadeOut = clamp((1 - packet.progress) / 0.11, 0, 1);
    const alpha = packet.alpha * Math.min(fadeIn, fadeOut);

    context.save();
    context.lineCap = "round";

    for (let tailIndex = 3; tailIndex >= 1; tailIndex -= 1) {
      const tailProgress = Math.max(0, packet.progress - packet.tail * tailIndex);
      const tailPoint = bendPoint(cubicPoint(packet.route, tailProgress), tailProgress);
      const tailAlpha = alpha * (0.08 + (3 - tailIndex) * 0.07);
      context.fillStyle = `rgba(37, 99, 235, ${tailAlpha})`;
      context.beginPath();
      context.arc(
        tailPoint.x,
        tailPoint.y,
        packet.size * (0.42 + (3 - tailIndex) * 0.08),
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    const streakLength = 4.5 + packet.size * 2.2;
    const gradient = context.createLinearGradient(
      headPoint.x - directionX * streakLength,
      headPoint.y - directionY * streakLength,
      headPoint.x,
      headPoint.y,
    );
    gradient.addColorStop(0, "rgba(37, 99, 235, 0)");
    gradient.addColorStop(1, `rgba(37, 99, 235, ${alpha})`);
    context.strokeStyle = gradient;
    context.lineWidth = packet.size * 1.3;
    context.beginPath();
    context.moveTo(
      headPoint.x - directionX * streakLength,
      headPoint.y - directionY * streakLength,
    );
    context.lineTo(headPoint.x, headPoint.y);
    context.stroke();

    context.shadowColor = "rgba(37, 99, 235, 0.72)";
    context.shadowBlur = 7;
    context.fillStyle = `rgba(37, 99, 235, ${Math.min(0.92, alpha + 0.18)})`;
    context.beginPath();
    context.arc(headPoint.x, headPoint.y, packet.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function render(deltaSeconds) {
    context.clearRect(0, 0, width, height);
    drawGrid();

    packets.forEach((packet) => {
      if (!reducedMotion.matches && deltaSeconds > 0) {
        packet.progress += packet.speed * deltaSeconds;
        if (packet.progress >= 1) {
          packet.progress %= 1;
        }
      }
      drawPacket(packet);
    });
  }

  function animate(time) {
    const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    render(deltaSeconds);
    frame = requestAnimationFrame(animate);
  }

  function startAnimation() {
    cancelAnimationFrame(frame);
    previousTime = performance.now();
    if (reducedMotion.matches) {
      render(0);
      return;
    }
    frame = requestAnimationFrame(animate);
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    },
    { passive: true },
  );

  window.addEventListener(
    "pointerleave",
    () => {
      pointer.active = false;
    },
    { passive: true },
  );

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
    } else {
      startAnimation();
    }
  });

  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", startAnimation);
  } else {
    reducedMotion.addListener(startAnimation);
  }

  resize();
  startAnimation();
})();
