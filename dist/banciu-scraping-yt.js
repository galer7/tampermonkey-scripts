"use strict";
// ==UserScript==
// @name         Lumea Lui Banciu Video Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrapes YouTube videos containing "lumea lui banciu". Works with search and playlist results.
// @author       You
// @match        https://www.youtube.com/results*
// @match        https://www.youtube.com/playlist*
// @grant        GM_setClipboard
// ==/UserScript==
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function () {
    "use strict";
    const TOTAL_ESTIMATED_SHOWS = 3515;
    const STORAGE_KEY = "banciu_videos";
    const INITIAL_BACKOFF_MS = 1000; // Start with 1 second delay
    const MAX_BACKOFF_MS = 32000; // Max 32 seconds delay
    const MAX_RETRIES = 3;
    function convertDurationToSeconds(duration) {
        const parts = duration.split(":").map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function fetchWithBackoff(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, attempt = 1) {
            try {
                // Add delay based on attempt number (exponential backoff)
                const backoffMs = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
                yield sleep(backoffMs);
                const response = yield fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response;
            }
            catch (error) {
                if (attempt < MAX_RETRIES) {
                    console.warn(`Attempt ${attempt} failed for ${url}, retrying...`);
                    return fetchWithBackoff(url, attempt + 1);
                }
                throw error;
            }
        });
    }
    function getUploadDate(url) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetchWithBackoff(url);
                const html = yield response.text();
                const match = html.match(/<meta itemprop="uploadDate" content="([^"]+)"/);
                return match ? match[1] : null;
            }
            catch (error) {
                console.error("Failed to fetch upload date:", error);
                return null;
            }
        });
    }
    function parseVideoData() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const videos = [];
            const existingVideos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            // Handle search results view
            const searchVideoElements = Array.from(document.querySelectorAll("ytd-video-renderer"));
            for (const videoEl of searchVideoElements) {
                const titleEl = videoEl.querySelector("#video-title");
                const title = ((_a = titleEl === null || titleEl === void 0 ? void 0 : titleEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                // Skip if title doesn't contain "lumea lui banciu" (case insensitive)
                if (!title.toLowerCase().includes("lumea lui banciu"))
                    continue;
                const urlEl = videoEl.querySelector("#video-title");
                const url = (urlEl === null || urlEl === void 0 ? void 0 : urlEl.href) || "";
                // Check if we already have this video's upload date
                const existingVideo = existingVideos.find((v) => v.title === title);
                const uploadDate = (existingVideo === null || existingVideo === void 0 ? void 0 : existingVideo.uploadDate) || (yield getUploadDate(url));
                const channelEl = videoEl.querySelector("#channel-name a");
                const durationEl = videoEl.querySelector("#text.ytd-thumbnail-overlay-time-status-renderer");
                const dateEl = videoEl.querySelector("#metadata-line span:last-child");
                const duration = ((_b = durationEl === null || durationEl === void 0 ? void 0 : durationEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "";
                const videoData = {
                    title,
                    channel: ((_c = channelEl === null || channelEl === void 0 ? void 0 : channelEl.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || "",
                    duration,
                    durationSeconds: convertDurationToSeconds(duration),
                    date: ((_d = dateEl === null || dateEl === void 0 ? void 0 : dateEl.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || "",
                    uploadDate,
                    url,
                };
                videos.push(videoData);
            }
            // Handle playlist view
            const playlistVideoElements = Array.from(document.querySelectorAll("ytd-playlist-video-renderer"));
            for (const videoEl of playlistVideoElements) {
                const titleEl = videoEl.querySelector("#video-title");
                const title = ((_e = titleEl === null || titleEl === void 0 ? void 0 : titleEl.textContent) === null || _e === void 0 ? void 0 : _e.trim()) || "";
                // Skip if title doesn't contain "lumea lui banciu" (case insensitive)
                if (!title.toLowerCase().includes("lumea lui banciu"))
                    continue;
                const urlEl = videoEl.querySelector("#video-title");
                const url = (urlEl === null || urlEl === void 0 ? void 0 : urlEl.href) || "";
                // Check if we already have this video's upload date
                const existingVideo = existingVideos.find((v) => v.title === title);
                const uploadDate = (existingVideo === null || existingVideo === void 0 ? void 0 : existingVideo.uploadDate) || (yield getUploadDate(url));
                const channelEl = videoEl.querySelector("#channel-name a");
                const durationEl = videoEl.querySelector("#text.ytd-thumbnail-overlay-time-status-renderer");
                const dateEl = videoEl.querySelector("#metadata-line span:last-child");
                const duration = ((_f = durationEl === null || durationEl === void 0 ? void 0 : durationEl.textContent) === null || _f === void 0 ? void 0 : _f.trim()) || "";
                const videoData = {
                    title,
                    channel: ((_g = channelEl === null || channelEl === void 0 ? void 0 : channelEl.textContent) === null || _g === void 0 ? void 0 : _g.trim()) || "",
                    duration,
                    durationSeconds: convertDurationToSeconds(duration),
                    date: ((_h = dateEl === null || dateEl === void 0 ? void 0 : dateEl.textContent) === null || _h === void 0 ? void 0 : _h.trim()) || "",
                    uploadDate,
                    url,
                };
                videos.push(videoData);
            }
            return videos;
        });
    }
    function saveToStorage(videos) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            const newData = [...existingData, ...videos];
            // Remove duplicates based on title
            const uniqueData = Array.from(new Map(newData.map((item) => [item.title, item])).values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueData));
        });
    }
    // Add this helper function for parallel processing
    function processInParallel(items_1, processItem_1) {
        return __awaiter(this, arguments, void 0, function* (items, processItem, concurrency = 5) {
            const chunks = [];
            for (let i = 0; i < items.length; i += concurrency) {
                chunks.push(items.slice(i, i + concurrency));
            }
            for (const chunk of chunks) {
                yield Promise.all(chunk.map(processItem));
            }
        });
    }
    function createUI() {
        const container = document.createElement("div");
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            z-index: 9999;
        `;
        const progressInfo = document.createElement("div");
        progressInfo.style.marginBottom = "10px";
        const storedVideos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        progressInfo.textContent = `Found ${storedVideos.length} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
        container.appendChild(progressInfo);
        // Add auto-scroll status
        const scrollStatus = document.createElement("div");
        scrollStatus.style.marginBottom = "10px";
        scrollStatus.textContent = "Auto-scroll: Off";
        container.appendChild(scrollStatus);
        let isAutoScrolling = false;
        let scrollInterval = null;
        function autoScroll() {
            if (!isAutoScrolling)
                return;
            window.scrollBy(0, 8000);
            // Scrape after each scroll
            parseVideoData()
                .then((videos) => {
                saveToStorage(videos).then(() => {
                    const totalStored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").length;
                    progressInfo.textContent = `Found ${totalStored} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
                    // Check if we've reached the bottom
                    if (window.innerHeight + window.scrollY >=
                        document.documentElement.scrollHeight) {
                        // Wait for more content to load
                        setTimeout(() => {
                            // If we're still at the bottom after waiting, stop scrolling
                            if (window.innerHeight + window.scrollY >=
                                document.documentElement.scrollHeight) {
                                stopAutoScroll();
                                // Final scrape
                                parseVideoData().then((finalVideos) => {
                                    saveToStorage(finalVideos).then(() => {
                                        const finalTotal = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").length;
                                        progressInfo.textContent = `Found ${finalTotal} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
                                        alert(`Finished scrolling! Total videos stored: ${finalTotal}`);
                                    });
                                });
                            }
                        }, 2000);
                    }
                });
            })
                .catch((error) => {
                console.error("Error during auto-scroll:", error);
                stopAutoScroll();
                alert("Error during auto-scroll. Check console for details.");
            });
        }
        function startAutoScroll() {
            isAutoScrolling = true;
            scrollStatus.textContent = "Auto-scroll: On";
            scrollInterval = window.setInterval(autoScroll, 1000);
        }
        function stopAutoScroll() {
            isAutoScrolling = false;
            scrollStatus.textContent = "Auto-scroll: Off";
            if (scrollInterval) {
                clearInterval(scrollInterval);
                scrollInterval = null;
            }
        }
        // Add auto-scroll toggle button
        const autoScrollButton = document.createElement("button");
        autoScrollButton.textContent = "Toggle Auto-scroll";
        autoScrollButton.style.marginLeft = "10px";
        autoScrollButton.onclick = () => {
            if (isAutoScrolling) {
                stopAutoScroll();
            }
            else {
                startAutoScroll();
            }
        };
        // Modify existing scrape button
        const button = document.createElement("button");
        button.textContent = "Scrape Banciu Videos";
        button.onclick = () => __awaiter(this, void 0, void 0, function* () {
            button.disabled = true;
            button.textContent = "Scraping... (this may take a while)";
            try {
                const videos = yield parseVideoData();
                yield saveToStorage(videos);
                const totalStored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").length;
                progressInfo.textContent = `Found ${totalStored} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
                alert(`Found ${videos.length} new videos! Total stored: ${totalStored}`);
            }
            catch (error) {
                console.error("Error scraping videos:", error);
                alert("Error scraping videos. Check console for details.");
            }
            finally {
                button.disabled = false;
                button.textContent = "Scrape Banciu Videos";
            }
        });
        const viewButton = document.createElement("button");
        viewButton.textContent = "View Stored Videos";
        viewButton.style.marginLeft = "10px";
        viewButton.onclick = () => {
            const videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            console.table(videos);
            alert("Check console for stored videos!");
        };
        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy to Clipboard";
        copyButton.style.marginLeft = "10px";
        copyButton.onclick = () => {
            const videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            GM_setClipboard(JSON.stringify(videos, null, 2));
            alert("Videos data copied to clipboard!");
        };
        const clearButton = document.createElement("button");
        clearButton.textContent = "Clear Storage";
        clearButton.style.marginLeft = "10px";
        clearButton.style.backgroundColor = "#ffcccc";
        clearButton.onclick = () => {
            if (confirm("Are you sure you want to clear all stored videos?")) {
                localStorage.removeItem(STORAGE_KEY);
                progressInfo.textContent = `Found 0 / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
                alert("Storage cleared!");
            }
        };
        const fixUrlsButton = document.createElement("button");
        fixUrlsButton.textContent = "Fix URLs & Data";
        fixUrlsButton.style.marginLeft = "10px";
        fixUrlsButton.style.backgroundColor = "#ccffcc";
        fixUrlsButton.onclick = () => __awaiter(this, void 0, void 0, function* () {
            try {
                const videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
                fixUrlsButton.disabled = true;
                // Initialize counters
                let uploadDatesAdded = 0;
                let urlsFixed = 0;
                const totalVideos = videos.length;
                const startTime = Date.now();
                let processed = 0;
                // First, collect all videos that need fixing
                const videosNeedingFix = videos
                    .map((video) => {
                    const needsFixing = {
                        video,
                        needsUrlFix: video.url.includes("https://youtube.comhttps://"),
                        needsDurationFix: !video.durationSeconds,
                        needsUploadDateFix: !video.uploadDate,
                    };
                    return needsFixing;
                })
                    .filter((v) => v.needsUrlFix || v.needsDurationFix || v.needsUploadDateFix);
                // Process videos in parallel
                yield processInParallel(videosNeedingFix, (item) => __awaiter(this, void 0, void 0, function* () {
                    let wasModified = false;
                    const { video } = item;
                    // Fix URL if needed
                    if (item.needsUrlFix) {
                        video.url = video.url.replace("https://youtube.comhttps://", "https://");
                        urlsFixed++;
                        wasModified = true;
                    }
                    // Add duration in seconds if missing
                    if (item.needsDurationFix) {
                        video.durationSeconds = convertDurationToSeconds(video.duration);
                        wasModified = true;
                    }
                    // Fetch upload date if missing
                    if (item.needsUploadDateFix) {
                        const uploadDate = yield getUploadDate(video.url);
                        if (uploadDate) {
                            video.uploadDate = uploadDate;
                            uploadDatesAdded++;
                            wasModified = true;
                        }
                    }
                    // If anything was modified, update storage
                    if (wasModified) {
                        // Get current storage state
                        const currentVideos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
                        // Remove this video if it exists (by title)
                        const otherVideos = currentVideos.filter((v) => v.title !== video.title);
                        // Add the updated video
                        const updatedVideos = [...otherVideos, video];
                        // Save back to storage
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVideos));
                    }
                    // Update progress
                    processed++;
                    const elapsed = Date.now() - startTime;
                    const videosPerSecond = processed / (elapsed / 1000);
                    const remainingVideos = totalVideos - processed;
                    const estimatedSecondsLeft = remainingVideos / videosPerSecond;
                    const minutesLeft = Math.ceil(estimatedSecondsLeft / 60);
                    fixUrlsButton.textContent = `Fixing... ${processed}/${totalVideos} (${minutesLeft}m remaining)`;
                }), 5); // Process 5 videos at a time
                // Final count
                const finalVideos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
                const finalCount = finalVideos.length;
                alert(`Fixed ${urlsFixed} URLs, added ${uploadDatesAdded} upload dates! Final count: ${finalCount}`);
                progressInfo.textContent = `Found ${finalCount} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
            }
            catch (error) {
                console.error("Error fixing data:", error);
                alert("Error fixing data. Check console for details.");
            }
            finally {
                fixUrlsButton.disabled = false;
                fixUrlsButton.textContent = "Fix URLs & Data";
            }
        });
        container.appendChild(button);
        container.appendChild(viewButton);
        container.appendChild(autoScrollButton);
        container.appendChild(copyButton);
        container.appendChild(clearButton);
        container.appendChild(fixUrlsButton);
        document.body.appendChild(container);
    }
    // Wait for content to load
    window.addEventListener("load", () => {
        // YouTube loads content dynamically, so we need to wait a bit
        setTimeout(createUI, 2000);
    });
})();
