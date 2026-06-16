"use strict";

import {
    flattenItems,
    loadPortfolio,
    makeCategory,
    makeItem,
    serializePortfolio,
    validatePortfolio
} from "./portfolio-data.js";

const SAVE_ENDPOINT = "./__portfolio/save";
const AUTO_SAVE_DELAY_MS = 700;

const dom = {
    status: document.getElementById("status"),
    reload: document.getElementById("reload-button"),
    save: document.getElementById("save-button"),
    siteSettingsToggle: document.getElementById("site-settings-toggle"),
    siteSettingsPanel: document.getElementById("site-settings-panel"),
    addCategory: document.getElementById("add-category-button"),
    categoryList: document.getElementById("category-list"),
    addItem: document.getElementById("add-item-button"),
    selectionSummary: document.getElementById("selection-summary"),
    groupLayer: document.getElementById("group-layer"),
    groupFocus: document.getElementById("group-focus"),
    workLayer: document.getElementById("work-layer"),
    workFocus: document.getElementById("work-focus"),
    tabs: document.querySelectorAll(".tab"),
    panels: document.querySelectorAll(".tab-panel"),
    siteTitle: document.getElementById("site-title"),
    siteSubtitle: document.getElementById("site-subtitle"),
    siteDescription: document.getElementById("site-description"),
    siteDefault: document.getElementById("site-default"),
    categoryDelete: document.getElementById("delete-category-button"),
    categoryId: document.getElementById("category-id"),
    categoryTitle: document.getElementById("category-title"),
    categoryDescription: document.getElementById("category-description"),
    categoryHidden: document.getElementById("category-hidden"),
    itemUp: document.getElementById("item-up-button"),
    itemDown: document.getElementById("item-down-button"),
    itemDelete: document.getElementById("delete-item-button"),
    itemId: document.getElementById("item-id"),
    itemName: document.getElementById("item-name"),
    itemBadge: document.getElementById("item-badge"),
    itemFile: document.getElementById("item-file"),
    itemCategory: document.getElementById("item-category"),
    itemRole: document.getElementById("item-role"),
    itemYear: document.getElementById("item-year"),
    itemDescription: document.getElementById("item-description"),
    itemTags: document.getElementById("item-tags"),
    itemHidden: document.getElementById("item-hidden"),
    addLink: document.getElementById("add-link-button"),
    linksList: document.getElementById("links-list"),
    jsonPreview: document.getElementById("json-preview"),
    validationList: document.getElementById("validation-list")
};

const state = {
    portfolio: null,
    categoryIndex: 0,
    itemIndex: 0,
    selectionMode: "work",
    activeTab: "work",
    dirty: false,
    saveTimer: null,
    saveInFlight: false,
    pendingSave: false,
    dragCategoryIndex: null,
    suppressNextClick: false
};

bindEvents();
init();

async function init() {
    await reloadPortfolio(false);
}

function bindEvents() {
    dom.reload.addEventListener("click", async () => {
        if (state.dirty && !window.confirm("저장되지 않은 변경사항을 버리고 다시 불러올까요?")) return;
        await reloadPortfolio(false);
    });

    dom.save.addEventListener("click", () => savePortfolio({ manual: true }));

    dom.siteSettingsToggle.addEventListener("click", () => {
        const shouldOpen = dom.siteSettingsPanel.hidden;
        setSiteSettingsPanel(shouldOpen);
        setStatus(shouldOpen ? "전체 설정 열림." : "전체 설정 닫힘.", "ok");
    });

    dom.tabs.forEach(tab => {
        tab.addEventListener("click", () => setTab(tab.dataset.tab));
    });

    dom.addCategory.addEventListener("click", () => {
        state.portfolio.categories.push(makeCategory(state.portfolio.categories));
        state.categoryIndex = state.portfolio.categories.length - 1;
        state.itemIndex = 0;
        setEditorMode("group");
        markDirty();
        renderAll();
    });

    dom.categoryList.addEventListener("click", event => {
        if (state.suppressNextClick) {
            state.suppressNextClick = false;
            return;
        }

        const itemButton = event.target.closest("[data-item-index]");
        if (itemButton) {
            state.categoryIndex = Number(itemButton.dataset.categoryIndex);
            state.itemIndex = Number(itemButton.dataset.itemIndex);
            setEditorMode("work");
            setTab("work");
            const item = selectedItem();
            setStatus(`작업물 선택됨: ${item?.name || item?.id || "이름 없음"}`, "ok");
            renderAll();
            return;
        }

        const button = event.target.closest("[data-category-index]");
        if (!button) return;
        state.categoryIndex = Number(button.dataset.categoryIndex);
        state.itemIndex = 0;
        setEditorMode("group");
        const category = selectedCategory();
        setStatus(`그룹 정보: ${category?.title || category?.id || "이름 없음"}`, "ok");
        renderAll();
    });

    dom.categoryList.addEventListener("dragstart", event => {
        const button = event.target.closest(".group-button");
        if (!button) return;
        state.dragCategoryIndex = Number(button.dataset.categoryIndex);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", button.dataset.categoryIndex);
        button.closest(".tree-group")?.classList.add("dragging");
    });

    dom.categoryList.addEventListener("dragover", event => {
        if (state.dragCategoryIndex === null) return;
        const group = event.target.closest(".tree-group");
        if (!group) return;
        event.preventDefault();
        clearDropTargets();
        group.classList.add("drop-target");
        event.dataTransfer.dropEffect = "move";
    });

    dom.categoryList.addEventListener("dragleave", event => {
        const group = event.target.closest(".tree-group");
        if (!group || group.contains(event.relatedTarget)) return;
        group.classList.remove("drop-target");
    });

    dom.categoryList.addEventListener("drop", event => {
        if (state.dragCategoryIndex === null) return;
        const group = event.target.closest(".tree-group");
        if (!group) return;
        event.preventDefault();

        const targetButton = group.querySelector(".group-button");
        const targetIndex = Number(targetButton?.dataset.categoryIndex);
        moveCategoryToIndex(state.dragCategoryIndex, targetIndex);
        state.suppressNextClick = true;
        clearDragState();
    });

    dom.categoryList.addEventListener("dragend", clearDragState);

    dom.addItem.addEventListener("click", () => {
        const category = selectedCategory();
        if (!category) return;
        category.items.push(makeItem(flattenItems(state.portfolio, { includeHidden: true })));
        state.itemIndex = category.items.length - 1;
        setEditorMode("work");
        setTab("work");
        markDirty();
        renderAll();
    });

    dom.categoryDelete.addEventListener("click", deleteCategory);
    dom.itemUp.addEventListener("click", () => moveItem(-1));
    dom.itemDown.addEventListener("click", () => moveItem(1));
    dom.itemDelete.addEventListener("click", deleteItem);
    dom.addLink.addEventListener("click", addLink);

    bindInput(dom.siteTitle, value => state.portfolio.site.title = value);
    bindInput(dom.siteSubtitle, value => state.portfolio.site.subtitle = value);
    bindInput(dom.siteDescription, value => state.portfolio.site.description = value);
    dom.siteDefault.addEventListener("change", () => {
        state.portfolio.site.defaultItemId = dom.siteDefault.value;
        markDirty();
        renderJsonAndValidation();
    });

    bindInput(dom.categoryId, value => {
        const category = selectedCategory();
        if (!category) return;
        category.id = value;
        renderCategoryList();
        renderSelectionSummary();
        renderGroupFocus();
    });
    bindInput(dom.categoryTitle, value => {
        const category = selectedCategory();
        if (!category) return;
        category.title = value;
        renderCategoryList();
        renderSelectionSummary();
        renderGroupFocus();
    });
    bindInput(dom.categoryDescription, value => {
        const category = selectedCategory();
        if (category) category.description = value;
    });
    dom.categoryHidden.addEventListener("change", () => {
        const category = selectedCategory();
        if (!category) return;
        category.hidden = dom.categoryHidden.checked;
        markDirty();
        renderCategoryList();
        renderJsonAndValidation();
    });

    bindInput(dom.itemId, value => {
        const item = selectedItem();
        if (!item) return;
        item.id = value;
        renderCategoryList();
        renderDefaultOptions();
        renderSelectionSummary();
        renderWorkFocus();
    });
    bindInput(dom.itemName, value => {
        const item = selectedItem();
        if (!item) return;
        item.name = value;
        renderCategoryList();
        renderDefaultOptions();
        renderSelectionSummary();
        renderWorkFocus();
    });
    bindInput(dom.itemBadge, value => {
        const item = selectedItem();
        if (!item) return;
        item.badge = value;
        renderCategoryList();
    });
    bindInput(dom.itemFile, value => {
        const item = selectedItem();
        if (item) item.file = value;
    });
    dom.itemCategory.addEventListener("change", () => {
        moveItemToCategory(Number(dom.itemCategory.value));
    });
    bindInput(dom.itemRole, value => {
        const item = selectedItem();
        if (item) item.role = value;
    });
    bindInput(dom.itemYear, value => {
        const item = selectedItem();
        if (item) item.year = value;
    });
    bindInput(dom.itemDescription, value => {
        const item = selectedItem();
        if (item) item.description = value;
    });
    bindInput(dom.itemTags, value => {
        const item = selectedItem();
        if (item) item.tags = splitTags(value);
    });
    dom.itemHidden.addEventListener("change", () => {
        const item = selectedItem();
        if (!item) return;
        item.hidden = dom.itemHidden.checked;
        markDirty();
        renderCategoryList();
        renderJsonAndValidation();
    });

    dom.linksList.addEventListener("input", event => {
        const input = event.target.closest("[data-link-field]");
        if (!input) return;
        const item = selectedItem();
        if (!item) return;
        const link = item.links[Number(input.dataset.linkIndex)];
        if (!link) return;
        link[input.dataset.linkField] = input.value;
        markDirty();
        renderJsonAndValidation();
    });

    dom.linksList.addEventListener("click", event => {
        const button = event.target.closest("[data-remove-link]");
        if (!button) return;
        const item = selectedItem();
        if (!item) return;
        item.links.splice(Number(button.dataset.removeLink), 1);
        markDirty();
        renderLinks();
        renderJsonAndValidation();
    });
}

async function reloadPortfolio(keepStatus) {
    try {
        window.clearTimeout(state.saveTimer);
        setStatus("데이터 불러오는 중...", "");
        state.portfolio = await loadPortfolio();
        state.categoryIndex = 0;
        state.itemIndex = 0;
        state.selectionMode = "work";
        state.dirty = false;
        state.pendingSave = false;
        renderAll();
        if (!keepStatus) setStatus("자동 저장 준비됨.", "ok");
    } catch (error) {
        console.error(error);
        setStatus(error.message, "error");
    }
}

async function savePortfolio(options = {}) {
    if (!state.portfolio) return;

    window.clearTimeout(state.saveTimer);
    const validation = validatePortfolio(state.portfolio);
    if (validation.errors.length) {
        setStatus("오류를 먼저 고쳐야 저장됩니다.", "error");
        renderValidation();
        return;
    }

    if (state.saveInFlight) {
        state.pendingSave = true;
        return;
    }

    try {
        state.saveInFlight = true;
        updateButtons(validation);
        setStatus(options.manual ? "저장 중..." : "자동 저장 중...", "");

        const response = await fetch(SAVE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: serializePortfolio(state.portfolio)
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || "자동 저장 실패. edit-portfolio.bat으로 편집기를 실행하세요.");
        }

        state.dirty = false;
        setStatus("data/portfolio.json에 자동 저장됨.", "ok");
        renderValidation();
    } catch (error) {
        console.error(error);
        setStatus(error.message, "error");
        renderValidation();
    } finally {
        state.saveInFlight = false;
        updateButtons();
        if (state.pendingSave) {
            state.pendingSave = false;
            scheduleAutoSave(100);
        }
    }
}

function renderAll() {
    ensureSelection();
    renderEditorMode();
    renderSelectionSummary();
    renderSiteForm();
    renderCategoryList();
    renderCategoryForm();
    renderItemForm();
    renderJsonAndValidation();
}

function renderSiteForm() {
    dom.siteTitle.value = state.portfolio.site.title;
    dom.siteSubtitle.value = state.portfolio.site.subtitle;
    dom.siteDescription.value = state.portfolio.site.description;
    renderDefaultOptions();
}

function renderDefaultOptions() {
    const current = state.portfolio.site.defaultItemId;
    dom.siteDefault.innerHTML = "";
    flattenItems(state.portfolio, { includeHidden: true }).forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.name} (${item.id})`;
        dom.siteDefault.appendChild(option);
    });
    dom.siteDefault.value = current;
}

function renderCategoryList() {
    dom.categoryList.innerHTML = "";
    state.portfolio.categories.forEach((category, index) => {
        const group = document.createElement("div");
        group.className = "tree-group";
        group.classList.toggle("active-group", index === state.categoryIndex);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "stack-button group-button";
        button.draggable = true;
        button.dataset.categoryIndex = String(index);
        button.classList.toggle("active", index === state.categoryIndex);
        button.innerHTML = `<span class="stack-name"></span><span class="stack-meta"></span>`;
        button.querySelector(".stack-name").textContent = category.title || "(이름 없음)";
        button.querySelector(".stack-meta").textContent = `${category.items.length}개${category.hidden ? " 숨김" : ""}`;
        group.appendChild(button);

        const itemList = document.createElement("div");
        itemList.className = "tree-items";

        if (!category.items.length) {
            const empty = document.createElement("div");
            empty.className = "tree-empty";
            empty.textContent = "작업물 없음";
            itemList.appendChild(empty);
        }

        category.items.forEach((item, itemIndex) => {
            const itemButton = document.createElement("button");
            itemButton.type = "button";
            itemButton.className = "item-subbutton";
            itemButton.dataset.categoryIndex = String(index);
            itemButton.dataset.itemIndex = String(itemIndex);
            itemButton.classList.toggle("active", index === state.categoryIndex && itemIndex === state.itemIndex);
            itemButton.innerHTML = `<span class="stack-name"></span><span class="stack-meta"></span>`;
            itemButton.querySelector(".stack-name").textContent = item.name || "(이름 없음)";
            itemButton.querySelector(".stack-meta").textContent = `${item.badge || item.id}${item.hidden ? " 숨김" : ""}`;
            itemList.appendChild(itemButton);
        });

        group.appendChild(itemList);
        dom.categoryList.appendChild(group);
    });
}

function renderCategoryForm() {
    const category = selectedCategory();
    renderGroupFocus();
    setControlsDisabled([
        dom.categoryDelete,
        dom.addItem,
        dom.categoryId,
        dom.categoryTitle,
        dom.categoryDescription,
        dom.categoryHidden
    ], !category);

    if (!category) {
        dom.categoryId.value = "";
        dom.categoryTitle.value = "";
        dom.categoryDescription.value = "";
        dom.categoryHidden.checked = false;
        return;
    }

    dom.categoryId.value = category.id;
    dom.categoryTitle.value = category.title;
    dom.categoryDescription.value = category.description;
    dom.categoryHidden.checked = category.hidden;
}

function renderItemForm() {
    const item = selectedItem();
    renderWorkFocus();
    setControlsDisabled([
        dom.itemUp,
        dom.itemDown,
        dom.itemDelete,
        dom.addLink,
        dom.itemId,
        dom.itemName,
        dom.itemBadge,
        dom.itemFile,
        dom.itemCategory,
        dom.itemRole,
        dom.itemYear,
        dom.itemDescription,
        dom.itemTags,
        dom.itemHidden
    ], !item);

    if (!item) {
        [dom.itemId, dom.itemName, dom.itemBadge, dom.itemFile, dom.itemRole, dom.itemYear, dom.itemDescription, dom.itemTags].forEach(input => {
            input.value = "";
        });
        dom.itemCategory.innerHTML = "";
        dom.itemHidden.checked = false;
        dom.linksList.innerHTML = "";
        return;
    }

    dom.itemId.value = item.id;
    dom.itemName.value = item.name;
    dom.itemBadge.value = item.badge;
    dom.itemFile.value = item.file;
    renderItemCategoryOptions();
    dom.itemRole.value = item.role;
    dom.itemYear.value = item.year;
    dom.itemDescription.value = item.description;
    dom.itemTags.value = item.tags.join(", ");
    dom.itemHidden.checked = item.hidden;
    renderLinks();
}

function renderLinks() {
    const item = selectedItem();
    dom.linksList.innerHTML = "";
    if (!item) return;

    item.links.forEach((link, index) => {
        const row = document.createElement("div");
        row.className = "link-row";
        row.innerHTML = `
            <input type="text" data-link-index="${index}" data-link-field="label" placeholder="링크 이름">
            <input type="text" data-link-index="${index}" data-link-field="url" placeholder="https://">
            <button class="button danger compact" type="button" data-remove-link="${index}">삭제</button>
        `;
        row.querySelector('[data-link-field="label"]').value = link.label;
        row.querySelector('[data-link-field="url"]').value = link.url;
        dom.linksList.appendChild(row);
    });
}

function renderJsonAndValidation() {
    dom.jsonPreview.value = serializePortfolio(state.portfolio);
    renderValidation();
    updateButtons();
}

function renderValidation() {
    if (!state.portfolio) {
        dom.validationList.innerHTML = "";
        dom.save.disabled = true;
        return;
    }

    const validation = validatePortfolio(state.portfolio);
    dom.validationList.innerHTML = "";

    validation.errors.forEach(message => addValidationMessage(message, "error"));
    validation.warnings.forEach(message => addValidationMessage(message, "warning"));

    if (!validation.errors.length && !validation.warnings.length) {
        addValidationMessage(state.dirty ? "자동 저장 대기 중." : "자동 저장 준비됨.", "ok");
    }

    updateButtons(validation);
}

function addValidationMessage(message, type) {
    const item = document.createElement("div");
    item.className = `validation-item ${type}`;
    item.textContent = message;
    dom.validationList.appendChild(item);
}

function setTab(tabName) {
    state.activeTab = tabName;
    dom.tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
    dom.panels.forEach(panel => panel.classList.toggle("active", panel.id === `${tabName}-panel`));
}

function setSiteSettingsPanel(open) {
    dom.siteSettingsPanel.hidden = !open;
    dom.siteSettingsToggle.setAttribute("aria-expanded", String(open));
    dom.siteSettingsToggle.classList.toggle("active", open);
}

function setEditorMode(mode) {
    state.selectionMode = mode;
    renderEditorMode();
}

function renderEditorMode() {
    dom.groupLayer.hidden = state.selectionMode !== "group";
    dom.workLayer.hidden = state.selectionMode !== "work";
}

function selectedCategory() {
    return state.portfolio?.categories[state.categoryIndex] || null;
}

function selectedItem() {
    return selectedCategory()?.items[state.itemIndex] || null;
}

function renderSelectionSummary() {
    const category = selectedCategory();
    const item = selectedItem();

    if (!category) {
        dom.selectionSummary.textContent = "현재 선택: 그룹 없음";
        return;
    }

    const categoryName = category.title || category.id || "이름 없는 그룹";
    if (state.selectionMode === "group") {
        dom.selectionSummary.textContent = `현재 그룹: ${categoryName}`;
        return;
    }

    const itemName = item ? item.name || item.id || "이름 없는 작업물" : "작업물 없음";
    dom.selectionSummary.textContent = `현재 선택: ${categoryName} / ${itemName}`;
}

function renderGroupFocus() {
    const category = selectedCategory();
    dom.groupFocus.textContent = category
        ? `${category.title || category.id || "이름 없는 그룹"} 정보 편집 중`
        : "왼쪽에서 그룹을 선택하면 정보를 편집할 수 있습니다.";
}

function renderWorkFocus() {
    const item = selectedItem();
    dom.workFocus.textContent = item
        ? `${item.name || item.id || "이름 없는 작업물"} 설명 편집 중`
        : "왼쪽에서 작업물을 선택하면 설명을 편집할 수 있습니다.";
}

function ensureSelection() {
    if (!state.portfolio.categories.length) {
        state.categoryIndex = 0;
        state.itemIndex = 0;
        return;
    }

    state.categoryIndex = clamp(state.categoryIndex, 0, state.portfolio.categories.length - 1);
    const category = selectedCategory();
    if (!category.items.length) {
        state.itemIndex = 0;
        return;
    }
    state.itemIndex = clamp(state.itemIndex, 0, category.items.length - 1);
}

function moveCategoryToIndex(fromIndex, toIndex) {
    const categories = state.portfolio.categories;
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= categories.length || toIndex >= categories.length) return;

    const [movedCategory] = categories.splice(fromIndex, 1);
    categories.splice(toIndex, 0, movedCategory);
    state.categoryIndex = toIndex;
    state.itemIndex = 0;
    setEditorMode("group");
    markDirty();
    renderAll();
    setStatus(`그룹 순서 변경됨: ${movedCategory.title || movedCategory.id || "이름 없음"}`, "ok");
}

function clearDropTargets() {
    dom.categoryList.querySelectorAll(".drop-target").forEach(group => {
        group.classList.remove("drop-target");
    });
}

function clearDragState() {
    state.dragCategoryIndex = null;
    dom.categoryList.querySelectorAll(".dragging").forEach(group => {
        group.classList.remove("dragging");
    });
    clearDropTargets();
}

function deleteCategory() {
    if (!selectedCategory()) return;
    if (!window.confirm("선택한 그룹을 삭제할까요?")) return;
    state.portfolio.categories.splice(state.categoryIndex, 1);
    state.categoryIndex = Math.max(0, state.categoryIndex - 1);
    state.itemIndex = 0;
    markDirty();
    renderAll();
}

function moveItem(direction) {
    const category = selectedCategory();
    if (!category) return;
    const nextIndex = state.itemIndex + direction;
    if (nextIndex < 0 || nextIndex >= category.items.length) return;
    [category.items[state.itemIndex], category.items[nextIndex]] = [category.items[nextIndex], category.items[state.itemIndex]];
    state.itemIndex = nextIndex;
    markDirty();
    renderAll();
}

function moveItemToCategory(nextCategoryIndex) {
    const sourceCategory = selectedCategory();
    const item = selectedItem();
    if (!sourceCategory || !item || nextCategoryIndex === state.categoryIndex) return;
    const targetCategory = state.portfolio.categories[nextCategoryIndex];
    if (!targetCategory) return;

    sourceCategory.items.splice(state.itemIndex, 1);
    targetCategory.items.push(item);
    state.categoryIndex = nextCategoryIndex;
    state.itemIndex = targetCategory.items.length - 1;
    markDirty();
    renderAll();
}

function deleteItem() {
    const category = selectedCategory();
    if (!category || !selectedItem()) return;
    if (!window.confirm("선택한 작업물을 삭제할까요?")) return;
    category.items.splice(state.itemIndex, 1);
    state.itemIndex = Math.max(0, state.itemIndex - 1);
    markDirty();
    renderAll();
}

function renderItemCategoryOptions() {
    dom.itemCategory.innerHTML = "";
    state.portfolio.categories.forEach((category, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = category.title || category.id || `Category ${index + 1}`;
        dom.itemCategory.appendChild(option);
    });
    dom.itemCategory.value = String(state.categoryIndex);
}

function addLink() {
    const item = selectedItem();
    if (!item) return;
    item.links.push({ label: "", url: "" });
    markDirty();
    renderLinks();
    renderJsonAndValidation();
}

function bindInput(input, updater) {
    input.addEventListener("input", () => {
        updater(input.value);
        markDirty();
        renderJsonAndValidation();
    });
}

function markDirty() {
    state.dirty = true;
    if (!dom.status.classList.contains("error")) {
        setStatus("변경됨. 자동 저장 대기 중...", "");
    }
    scheduleAutoSave();
}

function scheduleAutoSave(delay = AUTO_SAVE_DELAY_MS) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => savePortfolio(), delay);
}

function updateButtons(validation) {
    if (!state.portfolio) {
        dom.save.disabled = true;
        return;
    }

    const nextValidation = validation || validatePortfolio(state.portfolio);
    const category = selectedCategory();
    const item = selectedItem();
    dom.save.disabled = nextValidation.errors.length > 0 || state.saveInFlight;
    dom.categoryDelete.disabled = !category;
    dom.itemUp.disabled = !item || state.itemIndex === 0;
    dom.itemDown.disabled = !item || !category || state.itemIndex >= category.items.length - 1;
    dom.itemDelete.disabled = !item;
}

function setControlsDisabled(controls, disabled) {
    controls.forEach(control => {
        control.disabled = disabled;
    });
}

function setStatus(message, type) {
    dom.status.textContent = message;
    dom.status.className = `status ${type || ""}`.trim();
}

function splitTags(value) {
    return value.split(",").map(tag => tag.trim()).filter(Boolean);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
