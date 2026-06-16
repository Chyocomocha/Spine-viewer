"use strict";

import { GITHUB_REPOSITORY, serializePortfolio } from "./portfolio-data.js";

const API_BASE = "https://api.github.com";

export async function savePortfolioToGitHub(portfolio, token, options = {}) {
    const repository = { ...GITHUB_REPOSITORY, ...options.repository };
    const message = options.message || "Update portfolio data";
    const cleanToken = String(token || "").trim();
    if (!cleanToken) throw new Error("GitHub token is required.");

    const file = await getRepositoryFile(repository, cleanToken);
    const content = serializePortfolio(portfolio);

    return requestJson(
        `${API_BASE}/repos/${repository.owner}/${repository.repo}/contents/${repository.dataPath}`,
        cleanToken,
        {
            method: "PUT",
            body: JSON.stringify({
                message,
                content: toBase64Utf8(content),
                sha: file.sha,
                branch: repository.branch
            })
        }
    );
}

export async function getRepositoryFile(repository = GITHUB_REPOSITORY, token) {
    const cleanToken = String(token || "").trim();
    const url = new URL(`${API_BASE}/repos/${repository.owner}/${repository.repo}/contents/${repository.dataPath}`);
    url.searchParams.set("ref", repository.branch);
    return requestJson(url.href, cleanToken);
}

async function requestJson(url, token, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const message = payload?.message || `GitHub request failed (${response.status})`;
        throw new Error(message);
    }
    return payload;
}

function toBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}
