export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  try {
    const prompt = `
You are a brutally honest product design hiring manager.

Review this portfolio: ${url}

Give:
1. Clarity score (0-100)
2. Hiring manager POV
3. 10-second verdict
4. What’s missing
5. Quick fixes

Tone: sharp, witty, honest. No fluff.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    res.status(200).json({
      result: data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: "Error generating roast" });
  }
}
