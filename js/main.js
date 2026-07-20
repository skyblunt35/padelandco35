/* ============================================================
   PADEL & CO — Scripts du site
   ------------------------------------------------------------
   Vanilla JS, aucune dépendance. Chaque fonctionnalité est
   isolée dans sa fonction init*() : facile à activer/désactiver.
   ============================================================ */

'use strict';

/* Signale au CSS que le JS est disponible
   (les animations de révélation ne s'activent qu'avec cette classe) */
document.documentElement.classList.add('js');

/* Petits helpers */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ============================================================
   1. HEADER — état "scrollé" (fond + compactage)
   ============================================================ */
function initHeader() {
  const header = $('#site-header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}


/* ============================================================
   2. MENU MOBILE (drawer plein écran)
   ============================================================ */
function initDrawer() {
  const burger = $('.burger');
  const drawer = $('#menu-mobile');
  if (!burger || !drawer) return;

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    drawer.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (open) {
      const firstLink = $('.drawer__link', drawer);
      if (firstLink) firstLink.focus({ preventScroll: true });
    }
  };

  burger.addEventListener('click', () => {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  // NB : on ne ferme plus le menu au clic sur un lien — la navigation
  // remplace la page et la transition de page s'occupe du fondu.
  // (Le refermer pendant la navigation créait un à-coup visuel.)
  // Si la page revient depuis le cache navigateur : menu fermé.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) setOpen(false);
  });

  // Échap ferme le menu et rend le focus au burger
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      setOpen(false);
      burger.focus();
    }
  });
}


/* ============================================================
   3. RÉVÉLATION AU SCROLL (+ cascade dans les groupes)
   ============================================================ */
function initReveal() {
  const items = $$('[data-reveal]');
  if (!items.length) return;

  // Sans IntersectionObserver (très vieux navigateurs) : tout visible
  if (!('IntersectionObserver' in window) || REDUCED_MOTION) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  // Les animations d'entrée ne jouent qu'à la PREMIÈRE page de la session.
  // Ensuite, le contenu déjà à l'écran apparaît immédiatement : rejouer
  // l'animation à chaque navigation donnait un effet "rechargement".
  let firstVisit = true;
  try {
    firstVisit = !sessionStorage.getItem('pc-visited');
    sessionStorage.setItem('pc-visited', '1');
  } catch (e) { /* stockage indisponible : on garde les animations */ }

  // Cascade automatique : dans un [data-reveal-group], chaque enfant
  // reçoit un délai croissant (sauf délai déjà posé à la main via --d)
  $$('[data-reveal-group]').forEach((group) => {
    $$(':scope [data-reveal]', group).forEach((el, i) => {
      if (!el.style.getPropertyValue('--d')) {
        el.style.setProperty('--d', `${i * 0.08}s`);
      }
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });

  items.forEach((el) => {
    // Ce script s'exécute avant le premier rendu : la classe posée ici
    // rend l'élément visible dès la première frame, sans aucun flash.
    if (!firstVisit && el.getBoundingClientRect().top < window.innerHeight) {
      el.classList.add('is-visible');
    } else {
      observer.observe(el);
    }
  });
}


/* ============================================================
   4 bis. TRANSITIONS DE PAGE — fondu de secours
   ------------------------------------------------------------
   Les navigateurs récents gèrent le fondu entre pages en natif
   (règle CSS @view-transition). Pour les autres (ex. Firefox),
   on reproduit l'effet en JS : fondu de sortie avant navigation
   + fondu d'entrée au chargement (classe html.no-vt).
   ============================================================ */
function initPageTransitions() {
  // Le navigateur reconnaît-il @view-transition ? S'il parse la règle,
  // il gère les transitions entre documents : rien à faire.
  let native = false;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('@view-transition { navigation: auto; }');
    native = sheet.cssRules.length === 1;
  } catch (e) { native = false; }
  if (native || REDUCED_MOTION) return;

  document.documentElement.classList.add('no-vt'); // fondu d'entrée (CSS)

  // Fondu de sortie : interception des liens internes uniquement
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;                    // externe
    if (url.pathname === location.pathname && url.hash) return;    // ancre locale

    e.preventDefault();
    document.documentElement.classList.add('is-leaving');
    window.setTimeout(() => { location.href = link.href; }, 170);
  });

  // Retour via le cache navigateur : on annule l'état "sortie"
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) document.documentElement.classList.remove('is-leaving');
  });
}


/* ============================================================
   5. COMPTEURS ANIMÉS (bande chiffres clés)
   ============================================================ */
function initCounters() {
  const counters = $$('[data-count]');
  if (!counters.length) return;

  const fmt = (value, decimals) =>
    value.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const animate = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const duration = 1300;
    const start = performance.now();

    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = fmt(target * eased, decimals);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (!('IntersectionObserver' in window) || REDUCED_MOTION) {
    counters.forEach((el) => {
      el.textContent = fmt(parseFloat(el.dataset.count), parseInt(el.dataset.decimals || '0', 10));
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  counters.forEach((el) => observer.observe(el));
}


/* ============================================================
   6. HORAIRES — jour courant + badge "ouvert / fermé"
   ------------------------------------------------------------
   Heures d'ouverture par jour (getDay() : 0 = dimanche).
   24 = minuit. NB : la fermeture à minuit est rattachée au jour
   qui commence (simplification volontaire, largement suffisante).
   ============================================================ */
const SCHEDULE = {
  0: [9, 23],  // dimanche
  1: [10, 23], // lundi
  2: [10, 23], // mardi
  3: [10, 23], // mercredi
  4: [10, 24], // jeudi
  5: [10, 24], // vendredi
  6: [9, 23],  // samedi
};

function initHours() {
  const now = new Date();
  const day = now.getDay();
  const [opens, closes] = SCHEDULE[day];
  const fmtHour = (h) => (h === 24 ? 'minuit' : `${h}h`);

  // Surligne la ligne du jour dans le tableau (page contact)
  const row = $(`.hours tr[data-day="${day}"]`);
  if (row) row.classList.add('is-today');

  // Horaires du jour en toutes lettres (accueil)
  $$('[data-today-hours]').forEach((el) => {
    el.textContent = `${fmtHour(opens)} – ${fmtHour(closes)}`;
  });

  // Badges "Ouvert / Fermé" (présents sur plusieurs pages)
  const badges = $$('.open-badge');
  if (!badges.length) return;

  const hourNow = now.getHours() + now.getMinutes() / 60;

  let text, isOpen;
  if (hourNow >= opens && hourNow < closes) {
    isOpen = true;
    text = `Ouvert en ce moment · ferme à ${fmtHour(closes)}`;
  } else if (hourNow < opens) {
    isOpen = false;
    text = `Fermé · ouvre aujourd'hui à ${fmtHour(opens)}`;
  } else {
    isOpen = false;
    const tomorrow = SCHEDULE[(day + 1) % 7];
    text = `Fermé · réouvre demain à ${fmtHour(tomorrow[0])}`;
  }

  badges.forEach((badge) => {
    badge.textContent = text;
    badge.classList.add(isOpen ? 'is-open' : 'is-closed');
    badge.hidden = false;
  });
}


/* ============================================================
   7. FAQ — accordéon accessible
   ============================================================ */
function initAccordion() {
  const buttons = $$('.accordion__btn');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;

    // Les panneaux sont "hidden" dans le HTML (fallback sans JS) ;
    // une fois le JS chargé, l'état est géré par classe + aria.
    panel.hidden = false;

    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Un seul panneau ouvert à la fois
      buttons.forEach((other) => {
        other.setAttribute('aria-expanded', 'false');
        const p = document.getElementById(other.getAttribute('aria-controls'));
        if (p) p.classList.remove('is-open');
      });

      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        panel.classList.add('is-open');
      }
    });
  });
}


/* ============================================================
   8. FORMULAIRE DE CONTACT
   ------------------------------------------------------------
   ⚙️ DÉMO : l'envoi est simulé côté client.
   Pour la prod : remplacer la partie "simulation d'envoi"
   par un fetch() vers Formspree / une fonction serverless Vercel / votre backend.
   ============================================================ */
function initForm() {
  const form = $('#contact-form');
  if (!form) return;

  const fields = {
    nom:     { input: $('#f-nom'),     error: $('#err-nom'),     check: (v) => v.trim().length >= 2 },
    email:   { input: $('#f-email'),   error: $('#err-email'),   check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) },
    message: { input: $('#f-message'), error: $('#err-message'), check: (v) => v.trim().length >= 10 },
    rgpd:    { input: $('#f-rgpd'),    error: $('#err-rgpd'),    check: (_, el) => el.checked },
  };

  const setFieldState = (name, valid) => {
    const { input, error } = fields[name];
    input.closest('.field').classList.toggle('has-error', !valid);
    input.setAttribute('aria-invalid', String(!valid));
    error.hidden = valid;
  };

  // Validation à la sortie du champ (pas à chaque frappe)
  Object.entries(fields).forEach(([name, { input, check }]) => {
    input.addEventListener('blur', () => {
      if (input.value || input.type === 'checkbox') {
        setFieldState(name, check(input.value, input));
      }
    });
    // L'erreur disparaît dès que le champ redevient valide
    input.addEventListener('input', () => {
      if (check(input.value, input)) setFieldState(name, true);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Honeypot rempli = robot : on ignore silencieusement
    if ($('#f-website').value) return;

    let firstInvalid = null;
    Object.entries(fields).forEach(([name, { input, check }]) => {
      const valid = check(input.value, input);
      setFieldState(name, valid);
      if (!valid && !firstInvalid) firstInvalid = input;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // --- Simulation d'envoi (à remplacer par un vrai fetch) ---
    const submit = $('.form__submit', form);
    submit.disabled = true;
    submit.firstChild.textContent = 'Envoi en cours… ';

    window.setTimeout(() => {
      $('#form-success').hidden = false;
      submit.hidden = true;
      form.reset();
      $('#form-success').focus?.();
    }, 900);
  });
}


/* ============================================================
   8 bis. LIGHTBOX — agrandissement des photos de la galerie
   ------------------------------------------------------------
   Basée sur l'élément <dialog> natif : focus piégé, Échap pour
   fermer, fond cliquable. Navigation clavier ← → incluse.
   ============================================================ */
function initLightbox() {
  const dialog = $('#lightbox');
  if (!dialog) return;

  const triggers = $$('[data-lightbox-src]');
  if (!triggers.length) return;

  const img = $('.lightbox__img', dialog);
  const caption = $('.lightbox__caption', dialog);
  const count = $('.lightbox__count', dialog);
  let index = 0;

  const show = (i) => {
    index = (i + triggers.length) % triggers.length; // boucle infinie
    const t = triggers[index];
    img.src = t.dataset.lightboxSrc;
    img.alt = $('img', t)?.alt || '';
    caption.textContent = t.dataset.lightboxCaption || '';
    count.textContent = `${index + 1} / ${triggers.length}`;
  };

  triggers.forEach((t, i) => {
    t.addEventListener('click', () => {
      show(i);
      dialog.showModal();
    });
  });

  $('.lightbox__close', dialog)?.addEventListener('click', () => dialog.close());
  $('.lightbox__nav--prev', dialog)?.addEventListener('click', () => show(index - 1));
  $('.lightbox__nav--next', dialog)?.addEventListener('click', () => show(index + 1));

  // Flèches du clavier pour naviguer
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });

  // Clic sur le fond (hors image) = fermer
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}


/* ============================================================
   9. CTA FLOTTANT MOBILE — apparaît une fois le hero dépassé
   ============================================================ */
function initFloatingCta() {
  const cta = $('.cta-float');
  if (!cta) return;

  // Sur l'accueil : après le hero. Sur les autres pages : après ~320px.
  const hero = $('.hero');
  const threshold = () => (hero ? hero.offsetHeight - 120 : 320);

  const onScroll = () => {
    const past = window.scrollY > threshold();
    const menuOpen = document.body.classList.contains('menu-open');
    cta.classList.toggle('is-visible', past && !menuOpen);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}


/* ============================================================
   10. PARALLAXE LÉGÈRE sur la photo du hero (desktop uniquement)
   ============================================================ */
function initParallax() {
  if (REDUCED_MOTION) return;
  const img = $('.hero__frame img');
  const hero = $('.hero');
  if (!img || !hero) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    if (window.innerWidth < 1024) {
      img.style.transform = '';
      return;
    }
    const progress = Math.min(window.scrollY / hero.offsetHeight, 1);
    // Léger glissement vertical dans son cadre (l'image est sur-zoomée)
    img.style.transform = `scale(1.12) translateY(${progress * 34}px)`;
  };

  update();
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  window.addEventListener('resize', update);
}


/* ============================================================
   11. ANNÉE COURANTE (footer)
   ============================================================ */
function initYear() {
  const el = $('#year');
  if (el) el.textContent = new Date().getFullYear();
}


/* ============================================================
   Inscription aux news (démo — brancher un service d'e-mailing
   type Brevo/Mailchimp avant la mise en ligne)
   ============================================================ */
function initNewsForm() {
  const form = document.querySelector('.news-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelector('[data-abo-champs]').hidden = true;
    form.querySelector('[data-abo-ok]').hidden = false;
  });
}



/* ============================================================
   Lancement
   ============================================================ */
initPageTransitions();
initHeader();
initDrawer();
initReveal();
initCounters();
initHours();
initAccordion();
initForm();
initLightbox();
initFloatingCta();
initParallax();
initYear();
initNewsForm();
