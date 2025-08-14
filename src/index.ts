import { Hono } from "hono";
import fetch from "node-fetch";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import dns from "node:dns/promises";
import net from "node:net";
import { serve } from "@hono/node-server";
import chardet from "chardet";
import iconv from "iconv-lite";
import { cors } from "hono/cors";
import { load as loadHtml } from "cheerio";

const app = new Hono();

app.use(cors());

// プライベートIP判定
function isPrivateIP(ip: any) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    (ip.startsWith("172.") &&
      (() => {
        const n = parseInt(ip.split(".")[1], 10);
        return n >= 16 && n <= 31;
      })()) ||
    ip.startsWith("127.") ||
    ip === "0.0.0.0" ||
    ip.startsWith("169.254.") ||
    (net.isIPv6(ip) &&
      (ip.startsWith("fc") || ip.startsWith("fd") || ip === "::1"))
  );
}

app.post("/import-script", async (c) => {
  try {
    const { url } = await c.req.json();

    // 1. URLバリデーション
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return c.json({ error: "Invalid URL" }, 400);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return c.json({ error: "Only http/https allowed" }, 400);
    }

    // 2. DNS解決してIPチェック
    const ips = await dns.lookup(parsed.hostname, { all: true });
    if (ips.some(({ address }) => isPrivateIP(address))) {
      return c.json({ error: "Private network access denied" }, 403);
    }

    // 3. fetch（タイムアウト & サイズ制限）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const buf = await res.arrayBuffer();
    if (buf.byteLength > 5_000_000) {
      return c.json({ error: "Content too large" }, 413);
    }

    // 4. 文字コード自動判定してデコード
    const buffer = Buffer.from(buf);
    const detected = chardet.detect(buffer) || "UTF-8";
    const html = iconv.decode(buffer, detected);

    console.log(`Detected encoding: ${detected}`);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return c.json({ error: "Failed to parse content" }, 500);
    }

    // --- 改行保持処理 ---
    // HTMLをcheerioで読み込み
    const $ = loadHtml(article.content);
    // <br> を改行に置換
    $("br").replaceWith("\n");
    // <p> を段落扱い（末尾に改行2つ）
    $("p").each((_, el) => {
      const text = $(el).text();
      $(el).replaceWith(text + "\n\n");
    });
    // プレーンテキスト化
    let plainText = $.root().text();
    // 改行コード統一（\r\n, \r → \n）
    plainText = plainText.replace(/\r\n|\r/g, "\n");
    // 連続する3つ以上の改行は最大2つに圧縮
    plainText = plainText.replace(/\n{3,}/g, "\n\n");

    return c.json({
      title: article.title,
      htmlContent: article.content, // 元のHTML本文
      textContent: plainText, // 改行保持したプレーンテキスト
      length: plainText.length,
      sourceUrl: url,
    });
  } catch (err) {
    return c.json({ error: " err.message" }, 500);
  }
});

app.get("/", (c) => c.text("OK"));

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
