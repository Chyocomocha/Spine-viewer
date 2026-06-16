"use strict";

import { flattenItems, loadPortfolio, visibleCategories } from "./portfolio-data.js";

const dom = {
    title: document.getElementById("site-title"),
    subtitle: document.getElementById("site-subtitle"),
    nav: document.getElementById("nav"),
    viewerWrap: document.getElementById("viewer-wrap"),
    loading: document.getElementById("loading"),
    currentTitle: document.getElementById("current-title"),
    currentSubtitle: document.getElementById("current-subtitle"),
    currentDescription: document.getElementById("current-description"),
    currentMeta: document.getElementById("current-meta"),
    currentTags: document.getElementById("current-tags"),
    currentLinks: document.getElementById("current-links"),
    openButton: document.getElementById("open-button"),
    reloadButton: document.getElementById("reload-button"),
    itemCount: document.getElementById("item-count")
};

let portfolio = null;
let categories = [];
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
        portfolio = await loadPortfolio();
        categories = visibleCategories(portfolio);
        allItems = flattenItems(portfolio);
        if (!allItems.length) throw new Error("No visible portfolio items were found.");

        renderSite(portfolio.site, allItems.length);
        renderNav(categories);
        disableActions(false);
        selectItem(getInitialItemId(), false);
    } catch (error) {
        console.error(error);
        renderFatalError(error);
    }
}

function renderSite(site, count) {
    document.title = site.title;
    dom.title.textContent = site.title;
    dom.subtitle.textContent = site.subtitle;
    dom.subtitle.hidden = !site.subtitle;
    dom.itemCount.textContent = `${count} works`;
}

function renderNav(nextCategories) {
    dom.nav.innerHTML = "";

    nextCategories.forEach(category => {
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
    renderCurrentItem(item);
    setActiveButton(item.id);
    replaceFrame(item);

    if (shouldUpdateUrl) updateUrl(item.id);
}

function renderCurrentItem(item) {
    dom.currentTitle.textContent = item.name;
    dom.currentSubtitle.textContent = [item.categoryTitle, item.badge].filter(Boolean).join(" / ");
    dom.currentDescription.textContent = item.description;
    renderMeta(item);
    renderTags(item.tags);
    renderLinks(item.links);
}

function renderMeta(item) {
    dom.currentMeta.innerHTML = "";
    [
        item.role ? `Role: ${item.role}` : "",
        item.year ? `Year: ${item.year}` : ""
    ].filter(Boolean).forEach(value => {
        const pill = document.createElement("span");
        pill.className = "meta-pill";
        pill.textContent = value;
        dom.currentMeta.appendChild(pill);
    });
}

function renderTags(tags) {
    dom.currentTags.innerHTML = "";
    tags.forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.textContent = tag;
        dom.currentTags.appendChild(pill);
    });
}

function renderLinks(links) {
    dom.currentLinks.innerHTML = "";
    links.forEach(link => {
        const anchor = document.createElement("a");
        anchor.className = "work-link";
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        anchor.textContent = link.label || link.url;
        dom.currentLinks.appendChild(anchor);
    });
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
    dom.currentDescription.textContent = "";
    dom.currentMeta.innerHTML = "";
    dom.currentTags.innerHTML = "";
    dom.currentLinks.innerHTML = "";
    dom.itemCount.textContent = "";
    dom.nav.innerHTML = "";
    setLoading(`${error.message}\nCheck data/portfolio.json and open this page through GitHub Pages or a local server.`, true);
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
