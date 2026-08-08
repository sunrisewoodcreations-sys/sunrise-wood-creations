// Calls OpenAI's image API to produce a cornhole-board design concept
// from a text prompt, optionally guided by a reference image.
//
// IMPORTANT LIMITATION: AI image generators produce images around
// 1024–1536 pixels on a side — nowhere near the resolution needed to
// print crisp at a true 24x48 inch board size (that would need roughly
// 7200x14400 pixels at 300 DPI). This gives a strong concept/composition
// to work from — you (or your printer/vector software) will still need
// to scale, clean up, and finalize it for actual production printing.
//
// Requires an OPENAI_API_KEY environment variable — sign up for API
// access at platform.openai.com and add billing before this will work.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CORNHOLE_PROMPT_PREFIX =
  "A single flat, top-down view design for a cornhole board (like a rectangular game board graphic), " +
  "clean crisp vector-style linework, bold clear shapes, high contrast, no photo-realistic textures unless requested, " +
  "centered composition suitable for printing on a 24 inch by 48 inch board. " +
  "Do not include any circular hole, cutout, or moon-like shape unless it's specifically requested below. " +
  "Do not add any text, words, banners, or mottos unless specifically requested below. " +
  "Design request: ";

export async function generateCornholeDesign(opts: {
  prompt: string;
  referenceImageBuffer?: Buffer;
  referenceImageMimeType?: string;
}): Promise<Buffer> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Add it in your Vercel project's environment variables.");
  }

  const fullPrompt = CORNHOLE_PROMPT_PREFIX + opts.prompt;

  let response: Response;

  if (opts.referenceImageBuffer) {
    // Reference image provided — use the edits endpoint so the result is
    // guided by what was uploaded.
    const form = new FormData();
    form.append("model", "gpt-image-1.5");
    form.append("prompt", fullPrompt);
    form.append("size", "1024x1536");
    form.append("quality", "high");
    form.append(
      "image",
      new Blob([opts.referenceImageBuffer], { type: opts.referenceImageMimeType || "image/png" }),
      "reference.png"
    );

    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form
    });
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1.5",
        prompt: fullPrompt,
        size: "1024x1536",
        quality: "high"
      })
    });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI image request failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI response didn't include an image.");
  }

  return Buffer.from(b64, "base64");
}
