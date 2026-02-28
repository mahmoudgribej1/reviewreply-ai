import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface GenerateReplyParams {
  reviewText: string;
  reviewerName?: string;
  starRating: number;
  businessName: string;
  businessType: string;
  businessDescription: string;
  ownerFirstName: string;
  tone: string;
}

/**
 * Generate a professional reply to a Google Business review using Groq (llama-3.3-70b).
 */
export async function generateReply(params: GenerateReplyParams): Promise<string> {
  const {
    reviewText,
    reviewerName,
    starRating,
    businessName,
    businessType,
    businessDescription,
    ownerFirstName,
    tone,
  } = params;

  const systemPrompt = `You are an expert customer service manager helping small business owners craft 
professional, warm, and personalized replies to customer reviews. You know the business 
well and always write in the owner's voice. Keep replies between 60 and 120 words. 
Never use generic phrases like 'We appreciate your feedback' or 'Thank you for your 
review' as opening lines — start with something specific to the review. Never make 
promises or claims not supported by the review. Always sound human, never corporate.`;

  const userPrompt = `Business name: ${businessName}
Business type: ${businessType}
Business description: ${businessDescription}
Owner name: ${ownerFirstName}
Desired tone: ${tone}

Customer review (rated ${starRating} out of 5 stars):
Reviewer name: ${reviewerName || "the customer"}
Review: ${reviewText}

Write a reply from ${ownerFirstName} at ${businessName}.`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const reply = completion.choices[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("Groq returned an empty response");
  }

  return reply;
}
