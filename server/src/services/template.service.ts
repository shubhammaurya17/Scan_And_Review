import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult } from './ai.service';

/**
 * Extract the topic noun from a question like "How was the service?" → "service"
 */
function extractTopic(questionText: string): string {
  let topic = questionText
    .replace(/^\s*(how\s+(was|is|are|were)\s+(the\s+)?)/i, '')
    .replace(/^\s*(rate\s+(the\s+)?)/i, '')
    .replace(/^\s*(what\s+did\s+you\s+think\s+(of|about)\s+(the\s+)?)/i, '')
    .replace(/\?+\s*$/, '')
    .trim()
    .toLowerCase();

  // Fallback: if we didn't extract anything meaningful, use original minus question mark
  if (!topic || topic.length < 2) {
    topic = questionText.replace(/\?+\s*$/, '').trim().toLowerCase();
  }

  return topic;
}

// Randomize phrasing to avoid repetition
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class TemplateService implements IAIService {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateReviewDrafts(input: ReviewDraftInput): Promise<GeneratedDraft[]> {
    const avgRating = input.averageRating;
    const highTopic = extractTopic(
      [...input.ratings].sort((a, b) => b.rating - a.rating)[0]?.questionText || ''
    );
    const lowTopic = extractTopic(
      [...input.ratings].sort((a, b) => a.rating - b.rating)[0]?.questionText || ''
    );
    const highRating = [...input.ratings].sort((a, b) => b.rating - a.rating)[0]?.rating || 0;
    const lowRating = [...input.ratings].sort((a, b) => a.rating - b.rating)[0]?.rating || 0;
    const sameTopic = highTopic === lowTopic;
    const businessName = input.businessName;
    const commentPart = input.comment ? ` ${input.comment}` : '';

    // ─── Professional ─────────────────────────────
    let professional = '';
    if (avgRating >= 4) {
      professional = pick([
        `Visited ${businessName} and had a really solid experience.`,
        `Had a great visit to ${businessName} — impressed overall.`,
        `${businessName} delivered a quality experience across the board.`,
      ]);
      if (highRating >= 4) {
        professional += ' ' + pick([
          `The ${highTopic} really stood out — ${highRating === 5 ? 'genuinely impressive' : 'well above average'}.`,
          `Particularly pleased with the ${highTopic} — ${highRating === 5 ? 'top-tier' : 'definitely a strong point'}.`,
          `The ${highTopic} was ${highRating === 5 ? 'excellent, honestly one of the best I\'ve experienced' : 'really well done'}.`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        professional += ' ' + pick([
          `The ${lowTopic} has some room to grow, but nothing that would stop me from returning.`,
          `Minor note: the ${lowTopic} could be a touch better.`,
          `Only small area for improvement would be the ${lowTopic}.`,
        ]);
      }
    } else if (avgRating >= 3) {
      professional = pick([
        `My experience at ${businessName} was a mixed bag.`,
        `${businessName} was decent, but inconsistent.`,
        `Visited ${businessName} — some things were good, others not so much.`,
      ]);
      if (highRating >= 4) {
        professional += ' ' + pick([
          `The ${highTopic} was a definite highlight.`,
          `On the bright side, the ${highTopic} was solid.`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        professional += ' ' + pick([
          `Unfortunately, the ${lowTopic} fell short of expectations.`,
          `The ${lowTopic} was disappointing and needs attention.`,
        ]);
      }
      professional += ' ' + pick([
        `Has potential if they address the weak spots.`,
        `Some areas need work, but I can see the potential.`,
      ]);
    } else {
      professional = pick([
        `Disappointing visit to ${businessName}.`,
        `Left ${businessName} feeling underwhelmed.`,
        `${businessName} didn't meet expectations, unfortunately.`,
      ]);
      if (lowRating <= 2) {
        professional += ' ' + pick([
          `The ${lowTopic} was particularly lacking.`,
          `The ${lowTopic} really let the experience down.`,
        ]);
      }
      if (!sameTopic && highRating >= 3) {
        professional += ' ' + pick([
          `The ${highTopic} was passable, but not enough to save the visit.`,
          `At least the ${highTopic} was okay.`,
        ]);
      }
      professional += ' ' + pick([
        `Would need to see real improvements before giving it another chance.`,
        `Hard to recommend in its current state.`,
      ]);
    }
    if (commentPart) professional += commentPart;

    // ─── Friendly ─────────────────────────────────
    let friendly = '';
    if (avgRating >= 4) {
      friendly = pick([
        `Really enjoyed my time at ${businessName}!`,
        `Had such a good time at ${businessName}!`,
        `${businessName} was a great experience!`,
      ]);
      if (highRating >= 4) {
        friendly += ' ' + pick([
          `Loved the ${highTopic} — ${highRating === 5 ? 'seriously top-notch!' : 'really well done.'}`,
          `The ${highTopic} was amazing — ${highRating === 5 ? 'couldn\'t ask for better!' : 'really happy with it.'}`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        friendly += ' ' + pick([
          `The ${lowTopic} could be a little better, but honestly it's a minor thing.`,
          `Only tiny thing — the ${lowTopic} was just okay.`,
        ]);
      }
      friendly += ' ' + pick([
        `Would definitely come back!`,
        `Can't wait to visit again!`,
        `Highly recommend checking it out!`,
      ]);
    } else if (avgRating >= 3) {
      friendly = pick([
        `Went to ${businessName} — it was alright!`,
        `Checked out ${businessName} the other day.`,
        `Stopped by ${businessName} recently.`,
      ]);
      if (highRating >= 4) {
        friendly += ' ' + pick([
          `The ${highTopic} was nice.`,
          `Did enjoy the ${highTopic} at least!`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        friendly += ' ' + pick([
          `Wasn't too happy with the ${lowTopic} though.`,
          `The ${lowTopic} could use some love.`,
        ]);
      }
      friendly += ' ' + pick([
        `Not bad, not amazing — might give it another shot.`,
        `Decent enough, might try again and see if it's better.`,
      ]);
    } else {
      friendly = pick([
        `Had a tough experience at ${businessName}.`,
        `Not gonna lie, ${businessName} was a bit of a letdown.`,
        `Wish I had a better time at ${businessName}.`,
      ]);
      if (lowRating <= 2) {
        friendly += ' ' + pick([
          `The ${lowTopic} really didn't do it for me.`,
          `The ${lowTopic} was a real letdown.`,
        ]);
      }
      friendly += ' ' + pick([
        `Hope they work on things — I'd love a reason to come back.`,
        `Hoping things improve because the concept is nice.`,
      ]);
    }
    if (commentPart) friendly += commentPart;

    // ─── Concise ──────────────────────────────────
    let concise = '';
    if (avgRating >= 4) {
      concise = pick([
        `Great experience at ${businessName}.`,
        `${businessName} — really good.`,
        `Solid visit to ${businessName}.`,
      ]);
      if (highRating >= 4) {
        concise += ' ' + pick([
          `${highTopic.charAt(0).toUpperCase() + highTopic.slice(1)} was excellent.`,
          `Standout ${highTopic}.`,
        ]);
      }
      concise += ' ' + pick([`Recommended.`, `Would go again.`, `Worth a visit.`]);
    } else if (avgRating >= 3) {
      concise = pick([
        `${businessName} was decent.`,
        `${businessName} — okay, nothing special.`,
      ]);
      if (highRating >= 4) concise += ` Good ${highTopic}.`;
      if (!sameTopic && lowRating <= 2) concise += ` ${lowTopic.charAt(0).toUpperCase() + lowTopic.slice(1)} needs work.`;
    } else {
      concise = pick([
        `${businessName} was below expectations.`,
        `${businessName} — not great.`,
        `Wouldn't recommend ${businessName} right now.`,
      ]);
      if (lowRating <= 2) concise += ` ${lowTopic.charAt(0).toUpperCase() + lowTopic.slice(1)} was the main issue.`;
    }
    if (commentPart) concise += commentPart;

    return [
      { style: 'PROFESSIONAL', content: professional },
      { style: 'FRIENDLY', content: friendly },
      { style: 'CONCISE', content: concise },
    ];
  }

  async generateReply(review: string, businessName: string, tone: string): Promise<string> {
    const isPositive = /great|excellent|amazing|love|wonderful|fantastic|best|good|enjoyed|impressed/i.test(review);
    const isNegative = /bad|terrible|awful|worst|horrible|disappointed|poor|slow|rude|dirty|cold/i.test(review);
    const sentiment = isNegative ? 'negative' : isPositive ? 'positive' : 'neutral';

    const templates: Record<string, Record<string, string>> = {
      PROFESSIONAL: {
        positive: `Thank you for your positive feedback about ${businessName}. We are delighted to hear about your experience and remain committed to maintaining these high standards. We look forward to welcoming you again.`,
        negative: `Thank you for sharing your concerns regarding ${businessName}. We take all feedback seriously and are reviewing the issues you've raised. Please don't hesitate to contact us directly so we can address this properly.`,
        neutral: `Thank you for your review of ${businessName}. We value your feedback and continuously strive to improve our offerings. We hope to see you again soon.`,
      },
      FRIENDLY: {
        positive: `So glad you had a great time at ${businessName}! 😊 Thanks for the kind words — it really means a lot to our team. Can't wait to see you again!`,
        negative: `Oh no, we're sorry to hear that your visit to ${businessName} didn't meet expectations! That's definitely not what we aim for. We'd love a chance to make it right — please reach out to us!`,
        neutral: `Thanks for stopping by ${businessName} and sharing your thoughts! We appreciate the feedback and are always looking for ways to do better. Hope to see you again soon!`,
      },
      GRATEFUL: {
        positive: `We are truly grateful for your wonderful review of ${businessName}! Your kind words inspire our team to keep delivering the best experience possible. Thank you for your support!`,
        negative: `We sincerely appreciate you taking the time to share your experience at ${businessName}. We're grateful for honest feedback as it helps us grow. We want to make this right — please give us another chance.`,
        neutral: `Thank you so much for reviewing ${businessName}! We're grateful for every piece of feedback we receive. Your thoughts help us become better every day.`,
      },
      APOLOGETIC: {
        positive: `Thank you for your generous review of ${businessName}! We're glad everything went well, and we apologize if anything was less than perfect. We always strive to exceed expectations.`,
        negative: `We sincerely apologize for the experience you had at ${businessName}. This falls short of our standards and we take full responsibility. We would like to make it up to you — please contact us directly.`,
        neutral: `Thank you for your feedback about ${businessName}. We apologize if any aspect of your experience could have been better. We are committed to continuous improvement.`,
      },
      CONCISE: {
        positive: `Thanks for the great review! We're glad you enjoyed ${businessName}. See you again soon.`,
        negative: `Sorry about your experience at ${businessName}. We'll do better. Please reach out so we can make it right.`,
        neutral: `Thanks for your feedback about ${businessName}. We appreciate it and will keep improving.`,
      },
    };

    const toneTemplates = templates[tone.toUpperCase()] || templates.PROFESSIONAL;
    return toneTemplates[sentiment];
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const lower = text.toLowerCase();
    const positiveWords = ['great', 'excellent', 'amazing', 'love', 'wonderful', 'fantastic', 'best', 'good', 'enjoyed', 'impressed'];
    const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'horrible', 'disappointed', 'poor', 'slow', 'rude', 'dirty'];

    const posCount = positiveWords.filter(w => lower.includes(w)).length;
    const negCount = negativeWords.filter(w => lower.includes(w)).length;

    if (posCount > negCount) return { score: 0.6, label: 'POSITIVE' };
    if (negCount > posCount) return { score: -0.6, label: 'NEGATIVE' };
    return { score: 0, label: 'NEUTRAL' };
  }

  async detectTopics(texts: string[]): Promise<string[]> {
    const topicKeywords: Record<string, string[]> = {
      'Food Quality': ['food', 'taste', 'meal', 'dish', 'menu', 'cook', 'flavor'],
      'Service': ['service', 'staff', 'waiter', 'waitress', 'server', 'attentive'],
      'Ambiance': ['ambiance', 'atmosphere', 'decor', 'music', 'vibe', 'setting'],
      'Cleanliness': ['clean', 'dirty', 'hygiene', 'sanitary', 'tidy'],
      'Value': ['price', 'value', 'expensive', 'cheap', 'worth', 'cost'],
      'Wait Time': ['wait', 'slow', 'fast', 'quick', 'time', 'delay'],
    };

    const combined = texts.join(' ').toLowerCase();
    return Object.entries(topicKeywords)
      .filter(([_, keywords]) => keywords.some(k => combined.includes(k)))
      .map(([topic]) => topic);
  }
}
