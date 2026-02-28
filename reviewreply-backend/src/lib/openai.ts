import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateReplyInput {
  reviewText: string;
  reviewerName: string;
  starRating: number;
  businessName: string;
  businessType: string;
  businessDescription: string;
  ownerFirstName: string;
  tone: string;
}

/**
 * Generate a professional reply to a Google Business review using GPT-4o-mini.
 */
export async function generateReply(input: GenerateReplyInput): Promise<string> {
  const {
    reviewText,
    reviewerName,
    starRating,
    businessName,
    businessType,
    businessDescription,
    ownerFirstName,
    tone,
  } = input;

  const sentiment =
    starRating >= 4
      ? "positive"
      : starRating === 3
        ? "neutral/mixed"
        : "negative";

  const systemPrompt = `You are a professional reply writer for "${businessName}", a ${businessType} business.

Business description: ${businessDescription}

Your job is to write a reply to a Google Business review on behalf of ${ownerFirstName}, the owner.

RULES:
- Tone: ${tone}
- Address the reviewer by their first name if provided
- Keep replies concise: 2-4 sentences for positive reviews, 3-5 sentences for negative ones
- For positive reviews: thank them warmly, reference something specific from their review, invite them back
- For negative reviews: apologize sincerely, acknowledge their concern, offer to make it right (suggest they contact the business directly), do NOT be defensive
- For neutral reviews: thank them, address any specific feedback, express hope to see them again
- Sign off as ${ownerFirstName}
- Do NOT use hashtags, emojis, or marketing language
- Do NOT start with "Dear" — use a natural greeting like "Hi [Name]" or "Thank you [Name]"
- Write ONLY the reply text — no labels, no quotes, no extra formatting`;

  const userPrompt = `Review from ${reviewerName} (${starRating}/5 stars — ${sentiment}):

"${reviewText}"

Write a reply:`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const reply = completion.choices[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("OpenAI returned an empty response");
  }

  return reply;
}
