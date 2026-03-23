const MAX_HTML_CHARS = 15000;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_HTML_CHARS);
}

async function fetchPortfolioText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PortfolioRoastBot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch portfolio (${response.status})`);
  }

  const html = await response.text();
  const text = cleanText(html);

  if (!text) {
    throw new Error("The portfolio page did not return readable text");
  }

  return text;
}

async function generateRoast(url, portfolioText) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a sharp but useful portfolio critic for product and brand designers. Be honest, specific, and concise. Roast the work without being cruel. Focus on clarity, positioning, storytelling, and hiring-signal strength.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Review this portfolio URL: ${url}

Here is the readable text pulled from the page:
${portfolioText}

Return markdown with exactly these sections:
## Clarity Score
Give a score out of 100 with one sentence.

## 10-Second Verdict
One short paragraph.

## Hiring Manager POV
Three punchy bullet points.

## What's Missing
Three punchy bullet points.

## Quick Fixes
Five actionable bullet points.

Keep it under 350 words.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const data = await response.json();
  return data.output_text || "No roast returned.";
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  if (!url) {
    return res.status(400).json({ error: "Missing portfolio URL" });
  }

  try {
    const parsedUrl = new URL(url);
    const normalizedUrl = parsedUrl.toString();
    const portfolioText = await fetchPortfolioText(normalizedUrl);
    const result = await generateRoast(normalizedUrl, portfolioText);

    return res.status(200).json({
      result,
      sourceLength: portfolioText.length,
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Error generating roast",
    });
  }
}
