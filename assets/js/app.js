/* assets/js/app.js - VERSÃO FINAL */
(() => {
  "use strict";

  // ----------------------------- CONFIG -----------------------------
  const CONFIG = Object.freeze({
    ROOT_ID: "app",
    EMPTY_TEXT: "Modalidade não disponível para essa unidade",
    COURSE_TABS: [
      { key: "presencial", label: "Presencial" },
      { key: "hibrido", label: "Híbrido" },
      { key: "semipresencial", label: "Semipresencial" },
      { key: "ead", label: "EAD" },
    ],
    LINK_BLOCKS_ORDER: [
      { key: "presencial", label: "Presencial" },
      { key: "hibrido", label: "Híbrido" },
      { key: "semipresencial", label: "Semipresencial" },
      { key: "flex", label: "Flex" },
      { key: "ead", label: "100% EAD" },
    ],
    COURSE_KEY_ALIAS: Object.freeze({ oeste: "compensa" }),
    GLOBAL_LIMIT: 20,
    DEBUG: new URLSearchParams(location.search).has("debug"),
  });

  // ----------------------------- UTILS -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = String(v);
      else if (k.startsWith("data-")) node.setAttribute(k, String(v));
      else node.setAttribute(k, String(v));
    }
    children.forEach(c => node.appendChild(c));
    return node;
  };

  const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const uniq = (arr) => Array.from(new Set(arr));
  const debounce = (fn, ms = 150) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

  const safeExternalUrl = (href) => {
    try { const u = new URL(String(href), location.href); if (u.protocol !== "https:" && u.protocol !== "http:") return null; return u.toString(); } catch { return null; }
  };

  const applyUnitTheme = (containerEl, unitKey) => {
    if (!containerEl) return;
    containerEl.classList.remove('theme-sede', 'theme-leste', 'theme-sul', 'theme-norte', 'theme-oeste', 'theme-blue', 'theme-red');
    containerEl.classList.add(unitKey ? `theme-${unitKey}` : 'theme-sede');
  };

  const PRICE_UNIT_OPTIONS = Object.freeze([
    { key: "manaus", label: "Manaus" }, { key: "compensa", label: "Compensa" },
    { key: "para", label: "Pará" }, { key: "polos_proprios", label: "Polos Próprios" },
  ]);
  const PRICE_MODALITY_OPTIONS = Object.freeze([
    { key: "presencial", label: "Presencial" }, { key: "semipresencial", label: "Semipresencial" },
    { key: "ead", label: "EAD" }, { key: "hibrido", label: "Híbrido" },
  ]);
  const PRICE_PLAN_OPTIONS = Object.freeze([
    { key: "enem_vestibular", label: "ENEM/Vestibular" }, { key: "transfer_portador", label: "Portador/Transferência" },
  ]);
  const PRICE_UNIT_BY_PORTAL = Object.freeze({
    sede: "manaus", compensa: "compensa", oeste: "compensa", leste: "para", sul: "para", norte: "polos_proprios",
  });
  const resolvePriceUnitKey = (portalUnitKey) => PRICE_UNIT_BY_PORTAL[norm(portalUnitKey)] || "manaus";

  let pricesDataPromise = null;
  const loadPricesOnce = async () => {
    if (!pricesDataPromise) {
      pricesDataPromise = Promise.resolve().then(() => {
        const payload = window.COURSE_PRICES_2026_1;
        return payload && Array.isArray(payload.records) ? { ...payload, records: payload.records } : { records: [] };
      });
    }
    return pricesDataPromise;
  };

  const copyText = async (text) => {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  };

  const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const formatCents = (cents) => moneyFmt.format((Number(cents) || 0) / 100);

  // ----------------------------- SCROLL LOCK -----------------------------
  const scrollLock = (() => {
    let locks = 0, scrollY = 0;
    const lock = () => {
      locks += 1; if (locks > 1) return;
      scrollY = window.scrollY || 0;
      document.body.classList.add("modal-open");
      document.body.style.position = "fixed"; document.body.style.top = `-${scrollY}px`; document.body.style.left = "0"; document.body.style.right = "0"; document.body.style.width = "100%";
    };
    const unlock = () => {
      if (locks === 0) return; locks -= 1; if (locks > 0) return;
      document.body.classList.remove("modal-open");
      const top = document.body.style.top;
      document.body.style.position = ""; document.body.style.top = ""; document.body.style.left = ""; document.body.style.right = ""; document.body.style.width = "";
      window.scrollTo(0, Math.abs(parseInt(top || "0", 10)) || scrollY);
    };
    return { lock, unlock };
  })();

  // ----------------------------- DATA -----------------------------
  const getDataOrThrow = () => {
    if (!Array.isArray(window.PORTAL_LINKS)) throw new Error("PORTAL_LINKS não encontrado.");
    if (!window.COURSES?.catalog || !window.COURSES?.offers) throw new Error("COURSES não encontrado.");
    return { linksRaw: window.PORTAL_LINKS, courses: window.COURSES };
  };

  // ----------------------------- NORMALIZE LINKS -----------------------------
  const normalizeLinks = (linksRaw) => {
    if (linksRaw[0]?.blocks) {
      return linksRaw.map((u) => {
        const slug = norm(u.key || u.slug || u.coursesKey || "");
        return { key: slug, coursesKey: CONFIG.COURSE_KEY_ALIAS[slug] || slug, title: u.title, theme: slug, blocks: u.blocks || {} };
      });
    }
    return linksRaw.map((u) => {
      const slug = norm(u.slug || u.key || "");
      const coursesKey = CONFIG.COURSE_KEY_ALIAS[slug] || slug;
      const buckets = Object.fromEntries(CONFIG.LINK_BLOCKS_ORDER.map(b => [b.key, []]));
      (Array.isArray(u.modalidades) ? u.modalidades : []).forEach(g => {
        (Array.isArray(g.links) ? g.links : []).forEach(ln => {
          const key = mapLinkModalityToKey(ln.modalidade || "", g.titulo);
          if (key) buckets[key].push({ code: String(ln.codigo ?? ""), type: String(ln.tipo ?? ""), modality: ln.modalidade || "", href: String(ln.href || "") });
        });
      });
      const blocks = {};
      CONFIG.LINK_BLOCKS_ORDER.forEach(({ key, label }) => { blocks[key] = { title: label, links: pickVestMatPair(buckets[key]) }; });
      return { key: slug, coursesKey, title: u.titulo || u.title || slug.toUpperCase(), theme: slug, blocks };
    });
  };

  const mapLinkModalityToKey = (modalidade, groupTitle = "") => {
    const m = norm(modalidade), gt = norm(groupTitle);
    if (m.includes("presencial") || gt.includes("presencial")) return "presencial";
    if (m.includes("hibrid") || gt.includes("hibrid")) return "hibrido";
    if (m.includes("semi") && m.includes("flex")) return "flex";
    if (m.includes("semipresencial") || m.includes("semi")) return "semipresencial";
    if (m.includes("ead") || m.includes("online") || gt.includes("ead")) return "ead";
    return null;
  };

  const pickVestMatPair = (arr) => {
    const list = arr.slice();
    if (!list.length) return [];
    const isVest = (x) => norm(x.type).includes("vestibular");
    const isMat = (x) => norm(x.type).includes("matric");
    const v = list.find(isVest), m = list.find(isMat);
    return (v && m) ? [v, m] : list.slice(0, 2);
  };

  // ----------------------------- RENDER -----------------------------
  const renderApp = ({ units }) => {
    const root = document.getElementById(CONFIG.ROOT_ID);
    root.textContent = "";
    const frag = document.createDocumentFragment();
    units.forEach(u => frag.appendChild(renderUnit(u)));
    root.appendChild(frag);
  };

  const renderUnit = (unit) => {
    const card = el("section", { class: `unit ${unit.key}`, id: `unit-${unit.coursesKey}`, "data-unit-key": unit.coursesKey });
    applyUnitTheme(card, unit.key);
    const head = el("div", { class: "unit-head" }, [
      el("h2", { class: "unit-title", text: unit.title }),
      el("button", { class: "btn btn-courses", type: "button", "data-action": "open-courses", "data-unit": unit.coursesKey, "data-title": unit.title, "data-theme": unit.key }, [el("span", { text: "Pesquisar cursos" })])
    ]);
    card.appendChild(head);
    CONFIG.LINK_BLOCKS_ORDER.forEach(blk => {
      const blockData = unit.blocks?.[blk.key] || { title: blk.label, links: [] };
      card.appendChild(renderLinkBlock(blockData, blk.label));
    });
    return card;
  };

  const formatModalityTitle = (t) => {
    const tn = norm(t);
    if (tn.includes("presencial") && !tn.includes("semi") && !tn.includes("hibrid")) return "Presencial";
    if (tn.includes("hibrid")) return "Híbrido";
    if (tn.includes("semipresencial") || (tn.includes("semi") && !tn.includes("flex"))) return "Semipresencial";
    if (tn.includes("flex")) return "Flex";
    if (tn.includes("ead") || tn.includes("online")) return "100% EAD";
    return t;
  };

  const renderLinkBlock = (block, fallbackTitle) => {
    const wrap = el("div", { class: "mod-block" });
    wrap.appendChild(el("h3", { class: "mod-title subtitulo-modalidade", text: formatModalityTitle(block.title || fallbackTitle) }));
    const content = el("div", { class: "mod-content" });
    const links = Array.isArray(block.links) ? block.links : [];
    if (links.length < 2) {
      content.appendChild(el("div", { class: "empty", text: CONFIG.EMPTY_TEXT }));
    } else {
      const grid = el("div", { class: "link-grid" });
      links.slice(0, 2).forEach(ln => grid.appendChild(renderLinkCard(ln)));
      content.appendChild(grid);
    }
    wrap.appendChild(content);
    return wrap;
  };

  const renderLinkCard = (ln) => {
    const url = safeExternalUrl(ln.href);
    const a = el("a", { class: "link-card", href: url || "#", target: "_blank", rel: "noopener noreferrer", "aria-label": `${ln.type} - ${ln.modality} (${ln.code})` },
      [el("div", { class: "link-code", text: ln.code }), el("div", { class: "link-type", text: ln.type }), el("div", { class: "link-mod", text: ln.modality })]
    );
    if (!url) { a.setAttribute("tabindex", "-1"); a.classList.add("is-disabled"); }
    return a;
  };

  // ----------------------------- INDEX -----------------------------
  const buildCourseIndex = (courses, units) => {
    const unitMeta = new Map(units.map(u => [u.coursesKey, { title: u.title, visualKey: u.key }]));
    const availability = new Map();
    Object.entries(courses.offers || {}).forEach(([unitKey, offerByMod]) => {
      ["presencial", "hibrido", "semipresencial", "ead"].forEach(modKey => {
        (offerByMod?.[modKey] || []).forEach(item => {
          if (!item.id) return;
          if (!availability.has(item.id)) availability.set(item.id, new Map());
          const byUnit = availability.get(item.id);
          if (!byUnit.has(unitKey)) byUnit.set(unitKey, new Set());
          byUnit.get(unitKey).add(modKey);
        });
      });
    });
    const searchable = Object.entries(courses.catalog || {}).map(([id, c]) => ({ id, name: c.name || id, nameNorm: norm(c.name || id) }));
    return { unitMeta, availability, searchable };
  };

  // ----------------------------- UNIT MODAL -----------------------------
  const unitModal = (() => {
    let overlay, titleEl, tabsEl, bodyEl, inputEl, chipsEl, metaEl, gridEl, emptyEl, lastFocus;
    const state = { isOpen: false, unitKey: "", unitTitle: "", tab: "presencial", query: "", turno: "Todos", list: [] };

    const ensure = () => {
      if (overlay) return overlay;
      overlay = el("div", { class: "modal-overlay", role: "dialog", "aria-modal": "true" });
      applyUnitTheme(overlay, "sede");
      const dialog = el("div", { class: "modal" });
      const head = el("div", { class: "modal-head" }, [
        (titleEl = el("div", { class: "modal-title" })),
        el("button", { class: "modal-close", type: "button", "data-action": "close-unit-modal", "aria-label": "Fechar" }, [el("span", { text: "×" })])
      ]);
      tabsEl = el("div", { class: "modal-tabs" });
      bodyEl = el("div", { class: "modal-body" });
      const searchRow = el("div", { class: "search-row" });
      inputEl = el("input", { class: "search-input", type: "search", placeholder: "Pesquisar curso..." });
      inputEl.addEventListener("input", debounce(() => { state.query = inputEl.value; updateCoursesView(); }, 150));
      chipsEl = el("div", { class: "chips" });
      searchRow.append(inputEl, chipsEl);
      metaEl = el("div", { class: "meta" });
      gridEl = el("div", { class: "course-grid" });
      emptyEl = el("div", { class: "empty" });
      bodyEl.append(searchRow, metaEl, gridEl, emptyEl);
      dialog.append(head, tabsEl, bodyEl);
      overlay.appendChild(dialog);

      overlay.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) { if (e.target === overlay) close(); return; }
        const action = btn.dataset.action;
        if (action === "close-unit-modal") close();
        if (action === "set-tab") {
          state.tab = btn.dataset.tab; state.query = ""; state.turno = "Todos"; inputEl.value = "";
          syncTabs(); loadUnitList(); updateChips(); updateCoursesView(); bodyEl.scrollTop = 0;
        }
        if (action === "set-turno") { state.turno = btn.dataset.turno; updateChipsActive(); updateCoursesView(); }
      });
      document.addEventListener("keydown", (e) => { if (state.isOpen && e.key === "Escape") close(); });
      document.body.appendChild(overlay);
      return overlay;
    };

    const open = ({ unitKey, unitTitle }) => {
      lastFocus = document.activeElement;
      ensure(); scrollLock.lock();
      state.isOpen = true; state.unitKey = unitKey; state.unitTitle = unitTitle; state.tab = "presencial"; state.query = ""; state.turno = "Todos";
      overlay.className = "modal-overlay is-open"; applyUnitTheme(overlay, unitKey);
      titleEl.textContent = `Cursos disponíveis — ${state.unitTitle}`;
      renderTabs(); syncTabs(); inputEl.value = ""; loadUnitList(); updateChips(); updateCoursesView();
      $(".modal-close", overlay)?.focus();
    };
    const close = () => { if (!overlay) return; state.isOpen = false; overlay.classList.remove("is-open"); scrollLock.unlock(); if (lastFocus) lastFocus.focus(); };

    const renderTabs = () => {
      tabsEl.textContent = "";
      CONFIG.COURSE_TABS.forEach(t => tabsEl.appendChild(el("button", { class: "tab", type: "button", "data-action": "set-tab", "data-tab": t.key }, [el("span", { text: t.label })])));
    };
    // DEBUG visual: verificar quem está quebrando o layout
setTimeout(() => {
  const tabs = tabsEl;
  const chips = chipsEl;
  const tabBtn = tabs?.querySelector("button.tab");
  const chipBtn = chips?.querySelector("button.chip");

  console.log("=== DEBUG MODAL LAYOUT ===");
  if (tabs) {
    const cs = getComputedStyle(tabs);
    console.log("modal-tabs", { display: cs.display, flexDir: cs.flexDirection, flexWrap: cs.flexWrap, overflowX: cs.overflowX });
  } else console.warn("tabsEl não existe");

  if (tabBtn) {
    const cs = getComputedStyle(tabBtn);
    console.log("tab button", { display: cs.display, width: cs.width });
  } else console.warn("nenhuma .tab");

  if (chips) {
    const cs = getComputedStyle(chips);
    console.log("chips", { display: cs.display, flexDir: cs.flexDirection, flexWrap: cs.flexWrap });
  } else console.warn("chipsEl não existe");

  if (chipBtn) {
    const cs = getComputedStyle(chipBtn);
    console.log("chip button", { display: cs.display, width: cs.width });
  } else console.warn("nenhuma .chip");
}, 0);
    const syncTabs = () => tabsEl.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("is-active", btn.dataset.tab === state.tab));

    const loadUnitList = () => {
      const { courses } = getDataOrThrow();
      state.list = courses.offers?.[state.unitKey]?.[state.tab] || [];
    };

    const updateChips = () => {
      chipsEl.textContent = "";
      if (!["presencial", "hibrido"].includes(state.tab)) return;
      const allTurnos = uniq(state.list.flatMap(x => x.turnos || [])).sort((a, b) => a.localeCompare(b, "pt-BR"));
      ["Todos", ...allTurnos].forEach(c => chipsEl.appendChild(el("button", { class: `chip${c === state.turno ? " is-active" : ""}`, type: "button", "data-action": "set-turno", "data-turno": c }, [el("span", { text: c })])));
    };
    const updateChipsActive = () => chipsEl.querySelectorAll(".chip").forEach(btn => btn.classList.toggle("is-active", btn.dataset.turno === state.turno));

    const updateCoursesView = () => {
      const { courses } = getDataOrThrow();
      if (!state.list.length) {
        metaEl.textContent = ""; gridEl.textContent = ""; emptyEl.style.display = "block"; emptyEl.textContent = CONFIG.EMPTY_TEXT; return;
      }
      emptyEl.style.display = "none";
      const q = norm(state.query);
      const filtered = state.list.filter(x => {
        const name = courses.catalog?.[x.id]?.name || x.id;
        if (q && !norm(name).includes(q)) return false;
        if (["presencial", "hibrido"].includes(state.tab) && state.turno !== "Todos") return (x.turnos || []).includes(state.turno);
        return true;
      }).sort((a, b) => (courses.catalog?.[a.id]?.name || a.id).localeCompare(courses.catalog?.[b.id]?.name || b.id, "pt-BR"));
      metaEl.textContent = `${filtered.length} curso(s) encontrado(s)`;
      gridEl.textContent = "";
      filtered.forEach(item => {
        const name = courses.catalog?.[item.id]?.name || item.id;
        const card = el("div", { class: "course" }, [el("div", { class: "course-name", text: name })]);
        const badges = el("div", { class: "badges" });
        (item.turnos || []).forEach(t => badges.appendChild(el("span", { class: "badge", text: t })));
        card.appendChild(badges);
        gridEl.appendChild(card);
      });
    };
    return { open, close };
  })();


  // ----------------------------- GLOBAL MODAL -----------------------------
  const globalModal = (() => {
    let overlay, inputEl, resultsEl, index, lastFocus, isOpen = false;
    const ensure = () => {
      if (overlay) return overlay;
      overlay = el("div", { class: "modal-overlay", role: "dialog", "aria-modal": "true" });
      applyUnitTheme(overlay, "sede");
      const dialog = el("div", { class: "modal" });
      const head = el("div", { class: "modal-head" }, [
        el("div", { class: "modal-title", text: "Pesquisar Cursos (todas as unidades)" }),
        el("button", { class: "modal-close", type: "button", "data-action": "close-global-modal", "aria-label": "Fechar" }, [el("span", { text: "×" })])
      ]);
      const body = el("div", { class: "modal-body" });
      const searchRow = el("div", { class: "search-row" });
      inputEl = el("input", { class: "search-input", type: "search", placeholder: "Digite o nome do curso..." });
      inputEl.addEventListener("input", debounce(updateResults, 150));
      searchRow.appendChild(inputEl);
      resultsEl = el("div", { class: "results" });
      body.append(searchRow, resultsEl);
      dialog.append(head, body);
      overlay.appendChild(dialog);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { close(); return; }
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        if (btn.dataset.action === "close-global-modal") close();
        if (btn.dataset.action === "goto-unit") { close(); requestAnimationFrame(() => scrollToUnit(btn.dataset.unitKey)); }
      });
      document.addEventListener("keydown", (e) => { if (isOpen && e.key === "Escape") close(); });
      document.body.appendChild(overlay);
      return overlay;
    };
    const open = (courseIndex) => { ensure(); index = courseIndex; lastFocus = document.activeElement; isOpen = true; overlay.classList.add("is-open"); scrollLock.lock(); inputEl.value = ""; resultsEl.innerHTML = '<div class="empty">Digite um curso para ver em quais unidades ele está disponível.</div>'; inputEl.focus(); };
    const close = () => { if (!overlay || !isOpen) return; isOpen = false; overlay.classList.remove("is-open"); scrollLock.unlock(); if (lastFocus) lastFocus.focus(); };
    const modalityLabel = (key) => CONFIG.COURSE_TABS.find(t => t.key === key)?.label || key;
    const updateResults = () => {
      if (!index) return;
      const q = norm(inputEl.value);
      resultsEl.innerHTML = "";
      if (!q) { resultsEl.appendChild(el("div", { class: "empty", text: "Digite um curso para ver em quais unidades ele está disponível." })); return; }
      const hits = index.searchable.filter(c => c.nameNorm.includes(q)).slice(0, CONFIG.GLOBAL_LIMIT);
      if (!hits.length) { resultsEl.appendChild(el("div", { class: "empty", text: "Nenhum curso encontrado." })); return; }
      hits.forEach(course => {
        const card = el("div", { class: "result-card" });
        card.appendChild(el("div", { class: "result-course", text: course.name }));
        const byUnit = index.availability.get(course.id);
        if (byUnit) {
          const orderedUnits = index.unitOrder.filter(uk => byUnit.has(uk)).map(uk => ({ unitKey: uk, mods: Array.from(byUnit.get(uk)) }));
          orderedUnits.forEach(u => {
            const meta = index.unitMeta.get(u.unitKey) || { title: u.unitKey.toUpperCase(), visualKey: "sede" };
            const row = el("div", { class: "result-row" });
            applyUnitTheme(row, meta.visualKey);
            const left = el("div", { class: "result-left" }, [el("div", { class: "result-unit", text: `Unidade ${meta.title}` })]);
            const tags = el("div", { class: "result-tags" });
            u.mods.forEach(mk => tags.appendChild(el("span", { class: "tag", text: modalityLabel(mk) })));
            left.appendChild(tags);
            row.append(left, el("button", { class: "btn-unit", type: "button", "data-action": "goto-unit", "data-unit-key": u.unitKey }, [el("span", { text: "Ver na unidade" })]));
            card.appendChild(row);
          });
        }
        resultsEl.appendChild(card);
      });
    };
    return { open, close };
  })();

  // ----------------------------- PRICES MODAL -----------------------------
  const pricesModal = (() => {
    let overlay, titleEl, inputEl, unitSelectEl, modalitySelectEl, planSelectEl, listEl, emptyEl, isOpen = false, lastFocus;
    const state = { unitKey: "manaus", modalityKey: "presencial", planKey: "enem_vestibular", query: "", unitLabel: "Manaus", recordsView: [], data: null };

    const filteredRecords = () => {
      if (!Array.isArray(state.data?.records)) return [];
      const q = norm(state.query);
      return state.data.records.filter(r => (r.unitKey === state.unitKey || r.unitKey === '__all__') && r.modalityKey === state.modalityKey && r.planKey === state.planKey && (!q || norm(r.courseName).includes(q) || norm(r.courseId).includes(q)));
    };

    const buildCopyMessage = (record) => {
      const p10 = record?.bolsaPontualidadeCents?.p10;
      const modalityLabel = state.data?.modalities?.[state.modalityKey]?.label || PRICE_MODALITY_OPTIONS.find(x => x.key === state.modalityKey)?.label || state.modalityKey;
      const planLabel = state.data?.plans?.[state.planKey]?.label || PRICE_PLAN_OPTIONS.find(x => x.key === state.planKey)?.label || state.planKey;
      const unitLabel = state.data?.units?.[state.unitKey]?.label || state.unitLabel || "Tabela Geral";
      const lines = [
        `🎓 ${record.courseName} - ${modalityLabel} (${planLabel})`,
        `Curso de ${record.courseName} – Modalidade ${modalityLabel} (${unitLabel})`,
        `Valor integral: ${formatCents(record.integralCents)}`,
        `Com bolsa de estudos: ${formatCents(record.bolsaCents)} (mensalidade)`,
      ];
      if (p10 != null) lines.push(`Valor com 10% de desconto pontualidade: ${formatCents(p10)}`);
      lines.push("", "O desconto de pontualidade é adicionado caso você pague até o dia 5 de todo mês, somando assim +10% de desconto à sua bolsa.");
      return lines.join("\n");
    };

    const renderList = () => {
      state.recordsView = filteredRecords();
      listEl.innerHTML = "";
      if (!state.data?.records?.length) {
        emptyEl.hidden = false; emptyEl.textContent = "Base de preços carregada, aguardando dados."; return;
      }
      if (!state.recordsView.length) {
        emptyEl.hidden = false; emptyEl.textContent = "Nenhum preço encontrado para os filtros selecionados."; return;
      }
      emptyEl.hidden = true;
      state.recordsView.forEach(record => {
        const card = el("article", { class: "result-card prices-card" });
        card.appendChild(el("div", { class: "result-course prices-course", text: record.courseName }));
        card.appendChild(el("div", { class: "meta prices-meta", text: `Integral: ${formatCents(record.integralCents)}` }));
        card.appendChild(el("div", { class: "meta prices-meta", text: `Bolsa: ${formatCents(record.bolsaCents)}` }));
        if (record?.bolsaPontualidadeCents?.p10 != null) {
          card.appendChild(el("div", { class: "meta prices-meta", text: `Bolsa + Pontualidade: ${formatCents(record.bolsaPontualidadeCents.p10)}` }));
        }
        const copyBtn = el("button", { class: "prices-copy-btn", type: "button", text: "Copiar mensagem" });
        copyBtn.addEventListener("click", async () => {
          const ok = await copyText(buildCopyMessage(record));
          copyBtn.textContent = ok ? "Copiado!" : "Falha ao copiar";
          setTimeout(() => { copyBtn.textContent = "Copiar mensagem"; }, 1200);
        });
        card.appendChild(copyBtn);
        listEl.appendChild(card);
      });
    };

    const updateFilters = () => {
      state.unitKey = unitSelectEl.value; state.modalityKey = modalitySelectEl.value; state.planKey = planSelectEl.value; state.query = inputEl.value;
      state.unitLabel = state.data?.units?.[state.unitKey]?.label || PRICE_UNIT_OPTIONS.find(x => x.key === state.unitKey)?.label || state.unitLabel;
      renderList();
    };

    const ensure = () => {
      if (overlay) return;
      overlay = el("div", { class: "modal-overlay prices-overlay", "data-modal": "prices", "aria-hidden": "true" });
      const modal = el("div", { class: "modal prices-modal", role: "dialog", "aria-modal": "true", "aria-label": "Pesquisar preços" });
      const head = el("div", { class: "modal-head prices-head" }, [
        (titleEl = el("div", { class: "modal-title prices-title", text: "Pesquisar preços" })),
        el("button", { class: "modal-close prices-close", type: "button", "aria-label": "Fechar", text: "×" })
      ]);
      head.querySelector(".modal-close").addEventListener("click", close);
      const body = el("div", { class: "modal-body prices-body" });
      const controls = el("div", { class: "links-controls-grid prices-filters-grid" });

      unitSelectEl = el("select", { class: "prices-field", "aria-label": "Unidade" });
      PRICE_UNIT_OPTIONS.forEach(opt => unitSelectEl.appendChild(el("option", { value: opt.key, text: opt.label })));
      modalitySelectEl = el("select", { class: "prices-field", "aria-label": "Modalidade" });
      PRICE_MODALITY_OPTIONS.forEach(opt => modalitySelectEl.appendChild(el("option", { value: opt.key, text: opt.label })));
      planSelectEl = el("select", { class: "prices-field", "aria-label": "Plano" });
      PRICE_PLAN_OPTIONS.forEach(opt => planSelectEl.appendChild(el("option", { value: opt.key, text: opt.label })));
      inputEl = el("input", { class: "search-input prices-field", type: "search", placeholder: "Buscar curso...", "aria-label": "Buscar curso" });

      controls.append(unitSelectEl, modalitySelectEl, planSelectEl, inputEl);
      listEl = el("div", { class: "course-grid prices-grid" });
      emptyEl = el("div", { class: "empty prices-empty", text: "Carregando..." });
      body.append(controls, emptyEl, listEl);
      modal.append(head, body);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
      unitSelectEl.addEventListener("change", updateFilters);
      modalitySelectEl.addEventListener("change", updateFilters);
      planSelectEl.addEventListener("change", updateFilters);
      inputEl.addEventListener("input", debounce(updateFilters, 120));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen) close(); });
    };

    const open = async ({ unitKey = "sede", unitTitle = "Manaus" } = {}) => {
      ensure(); lastFocus = document.activeElement;
      state.unitKey = resolvePriceUnitKey(unitKey); state.unitLabel = unitTitle;
      titleEl.textContent = `Pesquisar preços — ${state.unitLabel}`;
      unitSelectEl.value = state.unitKey; modalitySelectEl.value = state.modalityKey; planSelectEl.value = state.planKey; inputEl.value = state.query;
      overlay.classList.add("is-open"); overlay.setAttribute("aria-hidden", "false"); isOpen = true; scrollLock.lock();
      state.data = await loadPricesOnce(); renderList(); inputEl.focus();
    };
    const close = () => { if (!overlay || !isOpen) return; overlay.classList.remove("is-open"); overlay.setAttribute("aria-hidden", "true"); isOpen = false; scrollLock.unlock(); if (lastFocus) lastFocus.focus(); };
    return { open, close };
  })();

  // ----------------------------- SCROLL TO UNIT -----------------------------
  const scrollToUnit = (unitKey) => {
    const target = document.getElementById(`unit-${unitKey}`) || document.querySelector(`[data-unit-key="${CSS.escape(unitKey)}"]`);
    if (target) { target.scrollIntoView({ behavior: "smooth", block: "start" }); target.classList.add("unit--flash"); setTimeout(() => target.classList.remove("unit--flash"), 900); }
  };

  // ----------------------------- BIND EVENTS -----------------------------
  const bindEvents = (courseIndex) => {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "open-courses") { unitModal.open({ unitKey: btn.dataset.unit, unitTitle: btn.dataset.title }); return; }
      if (action === "open-global-search") { globalModal.open(courseIndex); return; }
      if (action === "open-prices-menu") { pricesModal.open({ unitKey: "sede", unitTitle: "Manaus" }); return; }
    });
  };

  // ----------------------------- INIT -----------------------------
  const init = () => {
    try {
      const { linksRaw, courses } = getDataOrThrow();
      const units = normalizeLinks(linksRaw);
      const idx = buildCourseIndex(courses, units);
      idx.unitOrder = units.map(u => u.coursesKey);
      renderApp({ units });
      bindEvents(idx);
      if (new URLSearchParams(location.search).get("openPrices") === "1") pricesModal.open({ unitKey: "sede", unitTitle: "Manaus" });
    } catch (err) {
      console.error(err);
      const root = document.getElementById(CONFIG.ROOT_ID);
      if (root) root.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  };

  init();
})();