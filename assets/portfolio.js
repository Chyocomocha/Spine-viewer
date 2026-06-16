"use strict";

const DATA_URL = "./data/portfolio.json";

const dom = {
    title: document.getElementById("site-title"),
    subtitle: document.getElementById("site-subtitle"),
    nav: document.getElementById("nav"),
    viewerWrap: document.getElementById("viewer-wrap"),
    loading: document.getElementById("loading"),
    currentTitle: document.getElementById("current-title"),
    currentSubtitle: document.getElementById("current-subtitle"),
    openButton: document.getElementById("open-button"),
    reloadButton: document.getElementById("reload-button"),
    itemCount: document.getElementById("item-count")
};

let portfolio = null;
let allItems = [];
let currentItem = null;
let currentFrame = null;
let loadTimer = null;
let switchTimer = null;

init();

async function init() {
    disableActions(true);
    setLoading("Loading portfolio", false);

    try {
        const response = await fetch(DATA_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load ${DATA_URL} (${response.status})`);

        portfolio = normalizePortfolio(await response.json());
        allItems = flattenItems(portfolio.categories);
        if (!allItems.length) throw new Error("No visible portfolio items were found.");

        renderSite(portfolio.site, allItems.length);
        renderNav(portfolio.categories);
        disableActions(false);
        selectItem(getInitialItemId(), false);
    } catch (error) {
        console.error(error);
        renderFatalError(error);
    }
}

function normalizePortfolio(raw) {
    const site = raw?.site ?? {};
    const categories = Array.isArray(raw?.categories) ? raw.categories : [];

    return {
        site: {
            title: textOrDefault(site.title, "Spine Portfolio"),
            subtitle: textOrDefault(site.subtitle, ""),
            defaultItemId: textOrDefault(site.defaultItemId, "")
        },
        categories: categories
            .filter(category => !category.hidden)
            .map(category => ({
                id: textOrDefault(category.id, slugify(category.title)),
                title: textOrDefault(category.title, "Untitled"),
                items: Array.isArray(category.items)
                    ? category.items.filter(item => !item.hidden).map(item => ({
                        id: textOrDefault(item.id, slugify(item.name || item.file)),
                        name: textOrDefault(item.name, "Untitled"),
                        badge: textOrDefault(item.badge, ""),
                        file: textOrDefault(item.file, ""),
                        description: textOrDefault(item.description, "")
                    })).filter(item => item.file)
                    : []
            }))
            .filter(category => category.items.length)
    };
}

function flattenItems(categories) {
    return categories.flatMap(category => category.items.map(item => ({
        ...item,
        categoryId: category.id,
        categoryTitle: category.title
    })));
}

function renderSite(site, count) {
    document.title = site.title;
    dom.title.textContent = site.title;
    dom.subtitle.textContent = site.subtitle;
    dom.subtitle.hidden = !site.subtitle;
    dom.itemCount.textContent = `${count} works`;
}

function renderNav(categories) {
    dom.nav.innerHTML = "";

    categories.forEach(category => {
        const section = document.createElement("section");
        section.className = "group";

        const title = document.createElement("h3");
        title.className = "group-title";
        title.textContent = category.title;
        section.appendChild(title);

        const list = document.createElement("div");
        list.className = "item-list";

        category.items.forEach(item => {
            const button = document.createElement("button");
            button.className = "item-button";
            button.type = "button";
            button.dataset.itemId = item.id;
            button.innerHTML = `<span class="item-name"></span><span class="item-badge"></span>`;
            button.querySelector(".item-name").textContent = item.name;
            button.querySelector(".item-badge").textContent = item.badge;
            button.querySelector(".item-badge").hidden = !item.badge;
            button.addEventListener("click", () => selectItem(item.id, true));
            list.appendChild(button);
        });

        section.appendChild(list);
        dom.nav.appendChild(section);
    });
}

function getInitialItemId() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("item");
    if (allItems.some(item => item.id === requested)) return requested;
    if (allItems.some(item => item.id === portfolio.site.defaultItemId)) return portfolio.site.defaultItemId;
    return allItems[0].id;
}

function selectItem(itemId, shouldUpdateUrl) {
    const item = allItems.find(entry => entry.id === itemId);
    if (!item || currentItem?.id === item.id) return;

    currentItem = item;
    dom.currentTitle.textContent = item.name;
    dom.currentSubtitle.textContent = getSubtitle(item);
    setActiveButton(item.id);
    replaceFrame(item);

    if (shouldUpdateUrl) updateUrl(item.id);
}

function getSubtitle(item) {
    const parts = [item.categoryTitle, item.badge].filter(Boolean);
    if (item.description) parts.push(item.description);
    return parts.join(" / ");
}

function setActiveButton(itemId) {
    document.querySelectorAll(".item-button").forEach(button => {
        button.classList.toggle("active", button.dataset.itemId === itemId);
    });
}

function replaceFrame(item) {
    setLoading("Loading", false);
    window.clearTimeout(switchTimer);

    if (currentFrame) {
        currentFrame.src = "about:blank";
        currentFrame.remove();
        currentFrame = null;
    }

    window.clearTimeout(loadTimer);
    loadTimer = window.setTimeout(() => {
        setLoading("Still loading", false);
    }, 2500);

    switchTimer = window.setTimeout(() => {
        if (!currentItem || currentItem.id !== item.id) return;
        currentFrame = createFrame(item);
        dom.viewerWrap.appendChild(currentFrame);
    }, 80);
}

function createFrame(item) {
    const frame = document.createElement("iframe");
    frame.className = "viewer-frame";
    frame.title = item.name;
    frame.allow = "fullscreen";
    frame.src = item.file;
    frame.addEventListener("load", () => {
        window.clearTimeout(loadTimer);
        hideLoading();
    });
    frame.addEventListener("error", () => {
        window.clearTimeout(loadTimer);
        setLoading("Load failed", true);
    });
    return frame;
}

function updateUrl(itemId) {
    const url = new URL(window.location.href);
    url.searchParams.set("item", itemId);
    window.history.replaceState(null, "", url);
}

function setLoading(message, isError) {
    dom.loading.textContent = message;
    dom.loading.classList.toggle("error", Boolean(isError));
    dom.loading.classList.add("visible");
}

function hideLoading() {
    dom.loading.classList.remove("visible");
}

function disableActions(disabled) {
    dom.openButton.disabled = disabled;
    dom.reloadButton.disabled = disabled;
}

function renderFatalError(error) {
    disableActions(true);
    dom.currentTitle.textContent = "Portfolio data error";
    dom.currentSubtitle.textContent = "";
    dom.itemCount.textContent = "";
    dom.nav.innerHTML = "";
    setLoading(`${error.message}\nCheck data/portfolio.json and open this page through GitHub Pages or a local server.`, true);
}

function textOrDefault(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function slugify(value) {
    return String(value || "item")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "item";
}

dom.openButton.addEventListener("click", () => {
    if (!currentItem) return;
    window.open(currentItem.file, "_blank", "noopener");
});

dom.reloadButton.addEventListener("click", () => {
    if (!currentItem) return;
    replaceFrame(currentItem);
});

window.addEventListener("message", event => {
    if (event.data === "spine-context-lost" && currentItem) {
        replaceFrame(currentItem);
    }
});

window.addEventListener("beforeunload", () => {
    window.clearTimeout(switchTimer);
    window.clearTimeout(loadTimer);
    if (!currentFrame) return;
    currentFrame.src = "about:blank";
});
