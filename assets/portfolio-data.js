"use strict";

export const PORTFOLIO_DATA_URL = "./data/portfolio.json";

export async function loadPortfolio(url = PORTFOLIO_DATA_URL) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    return normalizePortfolio(await response.json());
}

export function normalizePortfolio(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const site = source.site && typeof source.site === "object" ? source.site : {};
    const categories = Array.isArray(source.categories) ? source.categories : [];

    return {
        schemaVersion: Number.isInteger(source.schemaVersion) ? source.schemaVersion : 1,
        site: {
            title: stringValue(site.title, "Spine Portfolio"),
            subtitle: stringValue(site.subtitle, ""),
            description: stringValue(site.description, ""),
            defaultItemId: stringValue(site.defaultItemId, "")
        },
        categories: categories.map((category, categoryIndex) => normalizeCategory(category, categoryIndex))
    };
}

export function normalizeCategory(category, categoryIndex = 0) {
    const source = category && typeof category === "object" ? category : {};
    const title = stringValue(source.title, `Category ${categoryIndex + 1}`);
    const items = Array.isArray(source.items) ? source.items : [];

    return {
        id: stringValue(source.id, slugify(title) || `category-${categoryIndex + 1}`),
        title,
        description: stringValue(source.description, ""),
        hidden: Boolean(source.hidden),
        items: items.map((item, itemIndex) => normalizeItem(item, itemIndex))
    };
}

export function normalizeItem(item, itemIndex = 0) {
    const source = item && typeof item === "object" ? item : {};
    const name = stringValue(source.name, `Work ${itemIndex + 1}`);
    const file = stringValue(source.file, "");

    return {
        id: stringValue(source.id, slugify(name || file) || `work-${itemIndex + 1}`),
        name,
        badge: stringValue(source.badge, ""),
        file,
        description: stringValue(source.description, ""),
        role: stringValue(source.role, ""),
        year: stringValue(source.year, ""),
        tags: normalizeTags(source.tags),
        links: normalizeLinks(source.links),
        hidden: Boolean(source.hidden)
    };
}

export function flattenItems(portfolio, options = {}) {
    const includeHidden = Boolean(options.includeHidden);
    return portfolio.categories.flatMap(category => {
        if (!includeHidden && category.hidden) return [];
        return category.items
            .filter(item => includeHidden || !item.hidden)
            .map(item => ({
                ...item,
                categoryId: category.id,
                categoryTitle: category.title,
                categoryHidden: category.hidden
            }));
    });
}

export function visibleCategories(portfolio) {
    return portfolio.categories
        .filter(category => !category.hidden)
        .map(category => ({
            ...category,
            items: category.items.filter(item => !item.hidden)
        }))
        .filter(category => category.items.length);
}

export function validatePortfolio(portfolio) {
    const errors = [];
    const warnings = [];
    const categoryIds = new Set();
    const itemIds = new Set();
    const allItems = flattenItems(portfolio, { includeHidden: true });

    if (!portfolio.site.title.trim()) errors.push("Site title is required.");

    portfolio.categories.forEach((category, categoryIndex) => {
        const categoryLabel = category.title || `Category ${categoryIndex + 1}`;
        if (!category.id.trim()) errors.push(`${categoryLabel}: category id is required.`);
        if (categoryIds.has(category.id)) errors.push(`Duplicate category id: ${category.id}`);
        categoryIds.add(category.id);
        if (!category.title.trim()) errors.push(`${categoryLabel}: category title is required.`);

        category.items.forEach((item, itemIndex) => {
            const itemLabel = item.name || `${categoryLabel} item ${itemIndex + 1}`;
            if (!item.id.trim()) errors.push(`${itemLabel}: item id is required.`);
            if (itemIds.has(item.id)) errors.push(`Duplicate item id: ${item.id}`);
            itemIds.add(item.id);
            if (!item.name.trim()) errors.push(`${itemLabel}: item name is required.`);
            if (!item.file.trim()) errors.push(`${itemLabel}: file path is required.`);
            if (item.links.some(link => link.url && !isValidHttpUrl(link.url))) {
                errors.push(`${itemLabel}: links must start with http:// or https://.`);
            }
        });
    });

    const visibleItems = flattenItems(portfolio);
    if (!visibleItems.length) errors.push("At least one visible work is required.");
    if (portfolio.site.defaultItemId && !allItems.some(item => item.id === portfolio.site.defaultItemId)) {
        errors.push(`Default item does not exist: ${portfolio.site.defaultItemId}`);
    }
    if (!portfolio.site.defaultItemId && visibleItems[0]) {
        warnings.push(`Default item is empty. ${visibleItems[0].id} will be used.`);
    }

    return { errors, warnings };
}

export function serializePortfolio(portfolio) {
    return `${JSON.stringify(normalizePortfolio(portfolio), null, 2)}\n`;
}

export function makeCategory(existingCategories = []) {
    const id = uniqueId("new-category", existingCategories.map(category => category.id));
    return {
        id,
        title: "New Category",
        description: "",
        hidden: false,
        items: []
    };
}

export function makeItem(existingItems = []) {
    const id = uniqueId("new-work", existingItems.map(item => item.id));
    return {
        id,
        name: "New Work",
        badge: "",
        file: "",
        description: "",
        role: "",
        year: "",
        tags: [],
        links: [],
        hidden: false
    };
}

export function uniqueId(base, existingIds = []) {
    const taken = new Set(existingIds);
    const cleanBase = slugify(base) || "item";
    if (!taken.has(cleanBase)) return cleanBase;

    let index = 2;
    while (taken.has(`${cleanBase}-${index}`)) index += 1;
    return `${cleanBase}-${index}`;
}

export function slugify(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function stringValue(value, fallback) {
    return typeof value === "string" ? value.trim() : fallback;
}

export function normalizeTags(value) {
    if (Array.isArray(value)) return value.map(tag => String(tag).trim()).filter(Boolean);
    if (typeof value === "string") {
        return value.split(",").map(tag => tag.trim()).filter(Boolean);
    }
    return [];
}

export function normalizeLinks(value) {
    if (!Array.isArray(value)) return [];
    return value.map(link => ({
        label: stringValue(link?.label, ""),
        url: stringValue(link?.url, "")
    })).filter(link => link.label || link.url);
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}
