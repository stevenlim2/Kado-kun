import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: URL Content Extraction
  app.post("/api/extract-url", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      let targetUrl = url;

      // Naver Blog URL Transformation
      const naverBlogMatch = url.match(/blog\.naver\.com\/([a-zA-Z0-9_-]+)\/(\d+)/);
      if (naverBlogMatch) {
        const blogId = naverBlogMatch[1];
        const logNo = naverBlogMatch[2];
        targetUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true&directAccess=false`;
      }

      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Remove scripts, styles, and other noise
      $("script, style, nav, footer, header, iframe").remove();

      let content = "";

      if (url.includes("blog.naver.com")) {
        // Naver Blog specific selector
        content = $(".se-main-container").text().trim() || $(".post-view").text().trim() || $("#postListBody").text().trim();
      } else {
        // General content extraction
        content = $("article").text().trim() || $("main").text().trim() || $("body").text().trim();
      }

      // Clean up whitespace
      content = content.replace(/\s+/g, " ").substring(0, 10000);

      if (!content || content.length < 100) {
         // Fallback: if extraction is poor, maybe it's still an iframe or heavily protected
         // We return what we have, or a specific message
         if (response.data.includes("iframe") && url.includes("naver")) {
            // Try to find the iframe src if we didn't transform it correctly
            const iframeSrc = $("iframe#mainFrame").attr("src");
            if (iframeSrc) {
                // This would require another fetch, but usually the transformation above handles it
            }
         }
      }

      res.json({ content });
    } catch (error: any) {
      console.error("Extraction Error:", error.message);
      res.status(500).json({ error: "Failed to extract content from URL" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
