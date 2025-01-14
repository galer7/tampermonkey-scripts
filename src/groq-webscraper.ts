// ==UserScript==
// @name         Rich Content to Markdown Converter
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Convert webpage content including images to markdown using Groq API
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

interface PageContent {
  text: string;
  html: string;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface GMXMLHttpRequestResponse {
  responseText: string;
  status: number;
  statusText: string;
}

declare function GM_xmlhttpRequest(details: {
  method: string;
  url: string;
  headers: Record<string, string>;
  data: string;
  onload: (response: GMXMLHttpRequestResponse) => void;
  onerror: (error: any) => void;
}): void;

declare function GM_getValue(key: string, defaultValue?: any): any;
declare function GM_setValue(key: string, value: any): void;

(function () {
  "use strict";

  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
  let apiKey = GM_getValue(
    "GROQ_API_KEY",
    process.env.USERSCRIPT_GROQ_API_KEY || ""
  );

  // Function to set up API key
  function setupApiKey(): void {
    if (!apiKey) {
      const key = prompt("Please enter your Groq API key:");
      if (key) {
        GM_setValue("GROQ_API_KEY", key);
        apiKey = key;
      } else {
        alert("API key is required for this script to work.");
        return;
      }
    }
  }

  // Create container for the button
  const container = document.createElement("div");
  container.id = "markdown-converter-container";
  container.style.position = "fixed";
  container.style.bottom = "20px";
  container.style.right = "20px";
  container.style.zIndex = "999999";
  container.style.pointerEvents = "auto";

  // Create floating button
  const button = document.createElement("button");
  button.innerHTML = "📝 Copy Rich Content";
  button.style.padding = "10px";
  button.style.borderRadius = "5px";
  button.style.backgroundColor = "#4CAF50";
  button.style.color = "white";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.fontSize = "14px";
  button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
  button.style.userSelect = "none";
  button.style.webkitUserSelect = "none";

  // Create settings button
  const settingsButton = document.createElement("button");
  settingsButton.innerHTML = "⚙️";
  settingsButton.style.padding = "10px";
  settingsButton.style.borderRadius = "5px";
  settingsButton.style.backgroundColor = "#4CAF50";
  settingsButton.style.color = "white";
  settingsButton.style.border = "none";
  settingsButton.style.cursor = "pointer";
  settingsButton.style.marginLeft = "5px";
  settingsButton.onclick = () => {
    const newKey = prompt("Enter new Groq API key:", apiKey);
    if (newKey !== null) {
      GM_setValue("GROQ_API_KEY", newKey);
      apiKey = newKey;
    }
  };

  // Add hover effect
  button.onmouseover = () => {
    button.style.backgroundColor = "#45a049";
  };
  button.onmouseout = () => {
    button.style.backgroundColor = "#4CAF50";
  };

  // Add buttons to container
  container.appendChild(button);
  container.appendChild(settingsButton);

  // Function to ensure button stays on page
  function ensureButtonPresence(): void {
    if (!document.getElementById("markdown-converter-container")) {
      document.body.appendChild(container);
    }
  }

  // Add button to page and set up periodic check
  document.body.appendChild(container);
  setInterval(ensureButtonPresence, 1000);

  // Function to download image as base64
  async function imageToBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image:", error);
      return null;
    }
  }

  // Function to get main content including images
  async function getMainContent(): Promise<PageContent> {
    // Try to find main content using common selectors
    const selectors = [
      "article",
      "main",
      ".main-content",
      "#main-content",
      ".post-content",
      ".article-content",
    ];

    let mainElement: HTMLElement | null = null;
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        mainElement = element;
        break;
      }
    }

    // Fallback to body if no main content found
    mainElement = mainElement || document.body;

    // Clone the element to avoid modifying the original page
    const contentClone = mainElement.cloneNode(true) as HTMLElement;

    // Process images in the clone
    const images = contentClone.getElementsByTagName("img");
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.src) {
        try {
          const base64Data = await imageToBase64(img.src);
          if (base64Data) {
            img.setAttribute("src", base64Data);
          }
        } catch (error) {
          console.error("Error processing image:", error);
        }
      }
    }

    return {
      text: contentClone.innerText,
      html: contentClone.innerHTML,
    };
  }

  // Function to chunk content into smaller pieces
  function chunkContent(
    content: string,
    maxChunkSize: number = 400000
  ): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    // Split by paragraphs or elements to maintain context
    const elements = content.split(/(?=<[^>]+>)/);

    for (const element of elements) {
      if (
        (currentChunk + element).length > maxChunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk);
        currentChunk = element;
      } else {
        currentChunk += element;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Function to send content to Groq API
  async function convertToMarkdown(content: PageContent): Promise<string> {
    if (!apiKey) {
      throw new Error("API key not set");
    }

    console.log("Starting convertToMarkdown...");
    const systemPrompt = `You are a helpful assistant that converts webpage content to clean, well-formatted markdown. 
      Preserve images using proper markdown image syntax.
      Remove navigation elements, ads, and other irrelevant content.
      Preserve headings, lists, and important formatting.`;

    // Split content into manageable chunks
    const htmlChunks = chunkContent(content.html);
    const textChunks = chunkContent(content.text);

    console.log(`Content split into ${htmlChunks.length} chunks`);

    let markdownParts: string[] = [];

    for (let i = 0; i < htmlChunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${htmlChunks.length}`);

      const result = await new Promise<string>((resolve, reject) => {
        console.log("Making API request to Groq...");
        GM_xmlhttpRequest({
          method: "POST",
          url: GROQ_API_URL,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          data: JSON.stringify({
            model: "mixtral-8x7b-32768",
            messages: [
              {
                role: "system",
                content: `${systemPrompt}${
                  i > 0
                    ? "\nThis is part " +
                      (i + 1) +
                      " of the content. Continue the markdown formatting from the previous part."
                    : ""
                }`,
              },
              {
                role: "user",
                content: `HTML Content:\n${htmlChunks[i]}\n\nText Content:\n${
                  textChunks[i] || ""
                }`,
              },
            ],
            temperature: 0.3,
            max_tokens: 32000,
          }),
          onload: function (response: GMXMLHttpRequestResponse) {
            console.log(
              "Received API response:",
              response.status,
              response.statusText
            );

            try {
              if (response.status !== 200) {
                const errorData = JSON.parse(response.responseText);
                console.error("API Error:", errorData);
                throw new Error(
                  `API Error: ${errorData.error?.message || "Unknown error"}`
                );
              }

              const data = JSON.parse(response.responseText) as GroqResponse;
              console.log("Parsed response data:", data);

              if (!data.choices?.[0]?.message?.content) {
                throw new Error("Invalid API response format");
              }

              resolve(data.choices[0].message.content);
            } catch (error) {
              console.error("Error parsing response:", error);
              console.error("Raw response:", response.responseText);
              reject(error);
            }
          },
          onerror: function (error: any) {
            console.error("Request error:", error);
            reject(error);
          },
        });
      });

      markdownParts.push(result);
    }

    return markdownParts.join("\n\n");
  }

  // Function to create rich clipboard data
  function createClipboardData(
    markdown: string,
    content: PageContent
  ): HTMLDivElement {
    // Create a temporary container
    const container = document.createElement("div");

    // Add the markdown as text
    const pre = document.createElement("pre");
    pre.textContent = markdown;
    container.appendChild(pre);

    // Add the original HTML content (with base64 images) in a hidden div
    const htmlContent = document.createElement("div");
    htmlContent.style.display = "none";
    htmlContent.innerHTML = content.html;
    container.appendChild(htmlContent);

    return container;
  }

  // Create modal for displaying and copying content
  function createModal(markdown: string, content: PageContent): void {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.backgroundColor = "white";
    modal.style.padding = "20px";
    modal.style.borderRadius = "5px";
    modal.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    modal.style.maxWidth = "80%";
    modal.style.maxHeight = "80vh";
    modal.style.overflow = "auto";
    modal.style.zIndex = "10000";

    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordWrap = "break-word";
    pre.textContent = markdown;

    const closeButton = document.createElement("button");
    closeButton.innerHTML = "✕";
    closeButton.style.position = "absolute";
    closeButton.style.top = "10px";
    closeButton.style.right = "10px";
    closeButton.style.border = "none";
    closeButton.style.background = "none";
    closeButton.style.cursor = "pointer";
    closeButton.onclick = () => modal.remove();

    const copyButton = document.createElement("button");
    copyButton.innerHTML = "Copy Rich Content";
    copyButton.style.marginTop = "10px";
    copyButton.style.padding = "5px 10px";
    copyButton.onclick = () => {
      const clipboardContent = createClipboardData(markdown, content);
      document.body.appendChild(clipboardContent);

      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(clipboardContent);
        selection.removeAllRanges();
        selection.addRange(range);

        try {
          // Copy as rich text
          document.execCommand("copy");
          copyButton.innerHTML = "Copied!";
          setTimeout(() => (copyButton.innerHTML = "Copy Rich Content"), 2000);
        } catch (err) {
          console.error("Copy failed:", err);
          copyButton.innerHTML = "Copy Failed!";
        }

        document.body.removeChild(clipboardContent);
        selection.removeAllRanges();
      }
    };

    modal.appendChild(closeButton);
    modal.appendChild(pre);
    modal.appendChild(copyButton);
    document.body.appendChild(modal);
  }

  // Add click handler to button
  button.onclick = async () => {
    if (!apiKey) {
      setupApiKey();
      if (!apiKey) return;
    }

    button.disabled = true;
    button.innerHTML = "Converting...";

    try {
      const content = await getMainContent();
      const markdown = await convertToMarkdown(content);
      createModal(markdown, content);
    } catch (error) {
      console.error("Error during conversion:", error);
      alert("Failed to convert content. Please check the console for details.");
    } finally {
      button.disabled = false;
      button.innerHTML = "📝 Copy Rich Content";
    }
  };

  // Initial setup
  setupApiKey();
})();
