// ==UserScript==
// @name         Lumea Lui Banciu Video Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrapes YouTube videos containing "lumea lui banciu" that are 30+ minutes
// @author       You
// @match        https://www.youtube.com/results*
// @match        https://www.youtube.com/playlist*
// @grant        GM_setClipboard
// ==/UserScript==

declare function GM_setClipboard(text: string): void;

(function () {
  "use strict";

  interface VideoData {
    title: string;
    channel: string;
    duration: string;
    durationSeconds: number;
    date: string;
    uploadDate: string | null; // ISO date format from meta tag
    url: string;
  }

  const TOTAL_ESTIMATED_SHOWS = 3515;
  const STORAGE_KEY = "banciu_videos";
  const INITIAL_BACKOFF_MS = 1000; // Start with 1 second delay
  const MAX_BACKOFF_MS = 32000; // Max 32 seconds delay
  const MAX_RETRIES = 3;

  function convertDurationToSeconds(duration: string): number {
    const parts = duration.split(":").map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchWithBackoff(url: string, attempt = 1): Promise<Response> {
    try {
      // Add delay based on attempt number (exponential backoff)
      const backoffMs = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1),
        MAX_BACKOFF_MS
      );
      await sleep(backoffMs);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(`Attempt ${attempt} failed for ${url}, retrying...`);
        return fetchWithBackoff(url, attempt + 1);
      }
      throw error;
    }
  }

  async function getUploadDate(url: string): Promise<string | null> {
    try {
      const response = await fetchWithBackoff(url);
      const html = await response.text();
      const match = html.match(/<meta itemprop="uploadDate" content="([^"]+)"/);
      return match ? match[1] : null;
    } catch (error) {
      console.error("Failed to fetch upload date:", error);
      return null;
    }
  }

  async function parseVideoData(): Promise<VideoData[]> {
    const videos: VideoData[] = [];
    const existingVideos = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    ) as VideoData[];

    // Handle search results view
    const searchVideoElements = Array.from(
      document.querySelectorAll("ytd-video-renderer")
    );
    for (const videoEl of searchVideoElements) {
      const titleEl = videoEl.querySelector("#video-title");
      const title = titleEl?.textContent?.trim() || "";

      // Skip if title doesn't contain "lumea lui banciu" (case insensitive)
      if (!title.toLowerCase().includes("lumea lui banciu")) continue;

      const urlEl = videoEl.querySelector("#video-title");
      const url = (urlEl as HTMLAnchorElement)?.href || "";

      // Check if we already have this video's upload date
      const existingVideo = existingVideos.find((v) => v.title === title);
      const uploadDate =
        existingVideo?.uploadDate || (await getUploadDate(url));

      const channelEl = videoEl.querySelector("#channel-name a");
      const durationEl = videoEl.querySelector(
        "#text.ytd-thumbnail-overlay-time-status-renderer"
      );
      const dateEl = videoEl.querySelector("#metadata-line span:last-child");

      const duration = durationEl?.textContent?.trim() || "";

      const videoData: VideoData = {
        title,
        channel: channelEl?.textContent?.trim() || "",
        duration,
        durationSeconds: convertDurationToSeconds(duration),
        date: dateEl?.textContent?.trim() || "",
        uploadDate,
        url,
      };

      videos.push(videoData);
    }

    // Handle playlist view
    const playlistVideoElements = Array.from(
      document.querySelectorAll("ytd-playlist-video-renderer")
    );
    for (const videoEl of playlistVideoElements) {
      const titleEl = videoEl.querySelector("#video-title");
      const title = titleEl?.textContent?.trim() || "";

      // Skip if title doesn't contain "lumea lui banciu" (case insensitive)
      if (!title.toLowerCase().includes("lumea lui banciu")) continue;

      const urlEl = videoEl.querySelector("#video-title");
      const url = (urlEl as HTMLAnchorElement)?.href || "";

      // Check if we already have this video's upload date
      const existingVideo = existingVideos.find((v) => v.title === title);
      const uploadDate =
        existingVideo?.uploadDate || (await getUploadDate(url));

      const channelEl = videoEl.querySelector("#channel-name a");
      const durationEl = videoEl.querySelector(
        "#text.ytd-thumbnail-overlay-time-status-renderer"
      );
      const dateEl = videoEl.querySelector("#metadata-line span:last-child");

      const duration = durationEl?.textContent?.trim() || "";

      const videoData: VideoData = {
        title,
        channel: channelEl?.textContent?.trim() || "",
        duration,
        durationSeconds: convertDurationToSeconds(duration),
        date: dateEl?.textContent?.trim() || "",
        uploadDate,
        url,
      };

      videos.push(videoData);
    }

    return videos;
  }

  async function saveToStorage(videos: VideoData[]) {
    const existingData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const newData = [...existingData, ...videos];

    // Remove duplicates based on title
    const uniqueData = Array.from(
      new Map(newData.map((item) => [item.title, item])).values()
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueData));
  }

  // Add this helper function for parallel processing
  async function processInParallel<T>(
    items: T[],
    processItem: (item: T) => Promise<void>,
    concurrency = 5
  ): Promise<void> {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(processItem));
    }
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
    let scrollInterval: number | null = null;

    function autoScroll() {
      if (!isAutoScrolling) return;

      window.scrollBy(0, 8000);

      // Scrape after each scroll
      parseVideoData()
        .then((videos) => {
          saveToStorage(videos).then(() => {
            const totalStored = JSON.parse(
              localStorage.getItem(STORAGE_KEY) || "[]"
            ).length;
            progressInfo.textContent = `Found ${totalStored} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;

            // Check if we've reached the bottom
            if (
              window.innerHeight + window.scrollY >=
              document.documentElement.scrollHeight
            ) {
              // Wait for more content to load
              setTimeout(() => {
                // If we're still at the bottom after waiting, stop scrolling
                if (
                  window.innerHeight + window.scrollY >=
                  document.documentElement.scrollHeight
                ) {
                  stopAutoScroll();
                  // Final scrape
                  parseVideoData().then((finalVideos) => {
                    saveToStorage(finalVideos).then(() => {
                      const finalTotal = JSON.parse(
                        localStorage.getItem(STORAGE_KEY) || "[]"
                      ).length;
                      progressInfo.textContent = `Found ${finalTotal} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
                      alert(
                        `Finished scrolling! Total videos stored: ${finalTotal}`
                      );
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
      } else {
        startAutoScroll();
      }
    };

    // Modify existing scrape button
    const button = document.createElement("button");
    button.textContent = "Scrape Banciu Videos";
    button.onclick = async () => {
      button.disabled = true;
      button.textContent = "Scraping... (this may take a while)";
      try {
        const videos = await parseVideoData();
        await saveToStorage(videos);
        const totalStored = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "[]"
        ).length;
        progressInfo.textContent = `Found ${totalStored} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
        alert(
          `Found ${videos.length} new videos! Total stored: ${totalStored}`
        );
      } catch (error) {
        console.error("Error scraping videos:", error);
        alert("Error scraping videos. Check console for details.");
      } finally {
        button.disabled = false;
        button.textContent = "Scrape Banciu Videos";
      }
    };

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
    fixUrlsButton.onclick = async () => {
      try {
        const videos = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "[]"
        ) as VideoData[];

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
          .filter(
            (v) => v.needsUrlFix || v.needsDurationFix || v.needsUploadDateFix
          );

        // Process videos in parallel
        await processInParallel(
          videosNeedingFix,
          async (item) => {
            let wasModified = false;
            const { video } = item;

            // Fix URL if needed
            if (item.needsUrlFix) {
              video.url = video.url.replace(
                "https://youtube.comhttps://",
                "https://"
              );
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
              const uploadDate = await getUploadDate(video.url);
              if (uploadDate) {
                video.uploadDate = uploadDate;
                uploadDatesAdded++;
                wasModified = true;
              }
            }

            // If anything was modified, update storage
            if (wasModified) {
              // Get current storage state
              const currentVideos = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
              ) as VideoData[];

              // Remove this video if it exists (by title)
              const otherVideos = currentVideos.filter(
                (v) => v.title !== video.title
              );

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
          },
          5
        ); // Process 5 videos at a time

        // Final count
        const finalVideos = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "[]"
        ) as VideoData[];
        const finalCount = finalVideos.length;

        alert(
          `Fixed ${urlsFixed} URLs, added ${uploadDatesAdded} upload dates! Final count: ${finalCount}`
        );
        progressInfo.textContent = `Found ${finalCount} / ~${TOTAL_ESTIMATED_SHOWS} estimated shows`;
      } catch (error) {
        console.error("Error fixing data:", error);
        alert("Error fixing data. Check console for details.");
      } finally {
        fixUrlsButton.disabled = false;
        fixUrlsButton.textContent = "Fix URLs & Data";
      }
    };

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
