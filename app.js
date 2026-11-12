(() => {
  'use strict';

  const VISIBLE_RATIO = 0.6;
  const PLAY_DELAY_MS = 300;

  const grid = document.getElementById('projects');
  const template = document.getElementById('card-template');

  // card element -> { video, soundBtn, visible, timer }
  const players = new Map();

  function play(player) {
    player.video.play().catch((err) => {
      // A browser may block playback with sound; fall back to muted playback.
      if (err.name === 'NotAllowedError' && !player.video.muted) {
        setSound(player, false);
        player.video.play().catch(() => {});
      }
    });
  }

  function setSound(player, on) {
    player.video.muted = !on;
    player.soundBtn.textContent = on ? 'Звук вкл' : 'Звук выкл';
    player.soundBtn.classList.toggle('btn--active', on);
  }

  function toggleSound(player) {
    const on = player.video.muted;
    if (on) {
      players.forEach((other) => {
        if (other !== player) setSound(other, false);
      });
    }
    setSound(player, on);
  }

  function restart(player) {
    player.video.currentTime = 0;
    play(player);
  }

  function isVisible(entry) {
    if (!entry.isIntersecting) return false;
    if (entry.intersectionRatio >= VISIBLE_RATIO) return true;
    // A card taller than the viewport can never reach 60%; count it as visible
    // once it fills 60% of the viewport.
    const rootHeight = entry.rootBounds ? entry.rootBounds.height : window.innerHeight;
    return entry.intersectionRect.height >= rootHeight * VISIBLE_RATIO;
  }

  function onIntersect(entries) {
    entries.forEach((entry) => {
      const player = players.get(entry.target);
      const visible = isVisible(entry);
      if (visible === player.visible) return;

      player.visible = visible;
      clearTimeout(player.timer);
      if (visible) {
        // Start only if the card stays visible for PLAY_DELAY_MS.
        player.timer = setTimeout(() => play(player), PLAY_DELAY_MS);
      } else {
        player.video.pause();
      }
    });
  }

  const observer = new IntersectionObserver(onIntersect, {
    threshold: Array.from({ length: 21 }, (_, i) => i / 20),
  });

  function renderCard(project, index) {
    const card = template.content.firstElementChild.cloneNode(true);
    const titleId = `project-${index}-title`;

    const title = card.querySelector('.card__title');
    title.id = titleId;
    title.textContent = project.title;

    const video = card.querySelector('.card__video');
    // The muted attribute is not applied to the property on cloned nodes.
    video.muted = true;
    video.src = project.video;
    video.setAttribute('aria-labelledby', titleId);

    const stack = card.querySelector('.card__stack');
    (Array.isArray(project.stack) ? project.stack : []).forEach((group) => {
      if (!group || !Array.isArray(group.items) || !group.items.length) return;

      const label = document.createElement('h3');
      label.className = 'card__stack-label';
      label.textContent = group.group || 'Стек';

      const list = document.createElement('ul');
      list.className = 'card__stack-items';
      list.setAttribute('aria-label', label.textContent);
      group.items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.append(li);
      });

      stack.append(label, list);
    });

    const stackBtn = card.querySelector('[data-action="stack"]');
    if (stack.childElementCount) {
      stack.id = `project-${index}-stack`;
      stackBtn.setAttribute('aria-controls', stack.id);
      stackBtn.addEventListener('click', () => {
        const open = stack.hidden;
        stack.hidden = !open;
        stackBtn.setAttribute('aria-expanded', String(open));
      });
    } else {
      stackBtn.remove();
    }

    const soundBtn = card.querySelector('[data-action="sound"]');
    card.querySelectorAll('.btn').forEach((btn) => btn.setAttribute('aria-describedby', titleId));

    const player = { video, soundBtn, visible: false, timer: null };
    players.set(card, player);

    card.querySelector('[data-action="restart"]').addEventListener('click', () => restart(player));
    soundBtn.addEventListener('click', () => toggleSound(player));

    return card;
  }

  function showMessage(text) {
    const p = document.createElement('p');
    p.className = 'grid__message';
    p.textContent = text;
    grid.replaceChildren(p);
  }

  fetch('projects.json', { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    })
    .then((projects) => {
      const valid = (Array.isArray(projects) ? projects : []).filter((p) => p && p.title && p.video);
      if (!valid.length) {
        showMessage('Проектов пока нет.');
        return;
      }
      const cards = valid.map(renderCard);
      grid.replaceChildren(...cards);
      cards.forEach((card) => observer.observe(card));
    })
    .catch(() => showMessage('Не удалось загрузить projects.json. Откройте сайт через локальный сервер.'));
})();
