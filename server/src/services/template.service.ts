import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult, CustomerAnswer } from './ai.service';

/**
 * Extract a topic from a question or answer.
 * For STAR_RATING: extract topic noun from question like "How was the service?" -> "service"
 * For SINGLE/MULTI_CHOICE: use selected option(s) as topic
 * For TEXT: use first meaningful words from answer
 */
function extractTopic(questionText: string): string {
  let topic = questionText
    .replace(/^\s*(how\s+(was|is|are|were)\s+(the\s+)?)/i, '')
    .replace(/^\s*(rate\s+(the\s+)?)/i, '')
    .replace(/^\s*(what\s+did\s+you\s+think\s+(of|about)\s+(the\s+)?)/i, '')
    .replace(/\?+\s*$/, '')
    .trim()
    .toLowerCase();

  if (!topic || topic.length < 2) {
    topic = questionText.replace(/\?+\s*$/, '').trim().toLowerCase();
  }

  return topic;
}

/**
 * Extract topic names from customer answers — uses chip selections and text answers
 * as well as question text for star ratings.
 */
function extractTopicsFromAnswers(answers: CustomerAnswer[]): { highTopic: string; lowTopic: string; highRating: number; lowRating: number } {
  // For star ratings, sort by rating to find high/low
  const starAnswers = answers.filter(a => a.questionType === 'STAR_RATING' && a.rating);

  let highTopic = '';
  let lowTopic = '';
  let highRating = 0;
  let lowRating = 5;

  if (starAnswers.length > 0) {
    const sorted = [...starAnswers].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    highTopic = extractTopic(sorted[0].questionText);
    highRating = sorted[0].rating || 0;
    lowTopic = extractTopic(sorted[sorted.length - 1].questionText);
    lowRating = sorted[sorted.length - 1].rating || 0;
  }

  // Enrich with chip selections if available
  const chipAnswers = answers.filter(a =>
    (a.questionType === 'SINGLE_CHOICE' && a.selectedOption) ||
    (a.questionType === 'MULTI_CHOICE' && a.selectedOptions?.length)
  );
  if (chipAnswers.length > 0) {
    const firstChip = chipAnswers[0];
    if (firstChip.selectedOption) {
      highTopic = firstChip.selectedOption.toLowerCase();
    } else if (firstChip.selectedOptions?.length) {
      highTopic = firstChip.selectedOptions[0].toLowerCase();
    }
  }

  // Use text answers if available
  const textAnswers = answers.filter(a => a.questionType === 'TEXT' && a.textAnswer);
  if (textAnswers.length > 0 && textAnswers[0].textAnswer) {
    const words = textAnswers[0].textAnswer.split(/\s+/).filter(w => w.length >= 4).slice(0, 3);
    if (words.length > 0) {
      highTopic = words.join(' ').toLowerCase();
    }
  }

  if (!highTopic) highTopic = 'experience';
  if (!lowTopic) lowTopic = highTopic;

  return { highTopic, lowTopic, highRating, lowRating };
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
    const { highTopic, lowTopic, highRating, lowRating } = extractTopicsFromAnswers(input.answers);
    const sameTopic = highTopic === lowTopic;
    const commentPart = input.comment ? ` ${input.comment}` : '';

    // Use insight labels as additional topics if available
    const insightTopics = input.selectedInsights?.slice(0, 3).map(i => i.toLowerCase()) || [];
    const effectiveHighTopic = insightTopics.length > 0 ? insightTopics[0] : highTopic;
    const effectiveLowTopic = insightTopics.length > 1 ? insightTopics[1] : lowTopic;

    // ─── Professional ─────────────────────────────
    let professional = '';
    if (avgRating >= 4) {
      professional = pick([
        `Came in not knowing what to expect, and walked out genuinely impressed.`,
        `This visit turned out to be exactly what I needed — everything felt intentional and well thought out.`,
        `From the moment I arrived, the whole experience felt seamless and thoughtfully put together.`,
      ]);
      if (highRating >= 4) {
        professional += ' ' + pick([
          `The ${effectiveHighTopic} really stood out — ${highRating === 5 ? 'it left a lasting impression on me' : 'noticeably above what I\'m used to'}.`,
          `Particularly impressed by the ${effectiveHighTopic} — ${highRating === 5 ? 'the attention to detail was remarkable' : 'clearly a strong point here'}.`,
          `The ${effectiveHighTopic} was ${highRating === 5 ? 'the kind of thing that makes you want to come back' : 'handled with real care and precision'}.`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        professional += ' ' + pick([
          `The ${effectiveLowTopic} has some room to grow, but nothing that overshadowed the rest.`,
          `Minor note: the ${effectiveLowTopic} could use a bit more attention.`,
          `Only area that didn't quite match the rest was the ${effectiveLowTopic}.`,
        ]);
      }
    } else if (avgRating >= 3) {
      professional = pick([
        `My experience here was a bit of a mixed bag — some things clicked, others didn't.`,
        `It was decent overall, but felt inconsistent across different aspects.`,
        `Some parts of the visit were spot-on, while others fell a bit flat.`,
      ]);
      if (highRating >= 4) {
        professional += ' ' + pick([
          `The ${effectiveHighTopic} was a definite highlight that showed real promise.`,
          `On the bright side, the ${effectiveHighTopic} was handled with care.`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        professional += ' ' + pick([
          `Unfortunately, the ${effectiveLowTopic} fell short and needs genuine attention.`,
          `The ${effectiveLowTopic} was disappointing and dragged the experience down.`,
        ]);
      }
      professional += ' ' + pick([
        `There's real potential here if the weak spots get addressed.`,
        `Some areas need work, but I can see what they're trying to build.`,
      ]);
    } else {
      professional = pick([
        `Left feeling underwhelmed — the experience didn't come together the way I'd hoped.`,
        `Unfortunately, this visit didn't meet the bar I was expecting.`,
        `A disappointing visit overall — several things missed the mark.`,
      ]);
      if (lowRating <= 2) {
        professional += ' ' + pick([
          `The ${effectiveLowTopic} was particularly lacking and needs serious improvement.`,
          `The ${effectiveLowTopic} really let the whole experience down.`,
        ]);
      }
      if (!sameTopic && highRating >= 3) {
        professional += ' ' + pick([
          `The ${effectiveHighTopic} was passable, but not enough to save the visit.`,
          `At least the ${effectiveHighTopic} was acceptable.`,
        ]);
      }
      professional += ' ' + pick([
        `Would need to see real improvements before giving it another chance.`,
        `Hard to justify a return visit in its current state.`,
      ]);
    }
    if (commentPart) professional += commentPart;
    if (avgRating >= 4 && input.locationArea) {
      professional += ` If you're in ${input.locationArea}, this one's worth checking out.`;
    }

    // ─── Friendly ─────────────────────────────────
    let friendly = '';
    if (avgRating >= 4) {
      friendly = pick([
        `So happy I decided to come here — what a treat!`,
        `This was such a refreshing experience, honestly made my day!`,
        `Walked in curious and left with a smile — that says it all.`,
      ]);
      if (highRating >= 4) {
        friendly += ' ' + pick([
          `The ${effectiveHighTopic} just hit different — ${highRating === 5 ? 'seriously one of the best I\'ve encountered!' : 'really well done and it showed.'}`,
          `The ${effectiveHighTopic} blew me away — ${highRating === 5 ? 'couldn\'t stop thinking about it afterwards!' : 'clearly they put their heart into it.'}`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        friendly += ' ' + pick([
          `The ${effectiveLowTopic} could be a little better, but honestly it's a minor thing in the big picture.`,
          `Only tiny thing — the ${effectiveLowTopic} didn't quite match the rest, but no dealbreaker.`,
        ]);
      }
      friendly += ' ' + pick([
        `Already planning my next visit!`,
        `Can't wait to come back!`,
        `Definitely telling my friends about this place!`,
      ]);
    } else if (avgRating >= 3) {
      friendly = pick([
        `Stopped by recently — it was alright, had its moments!`,
        `Checked this place out the other day — mixed feelings.`,
        `Gave it a try recently and came away with mixed thoughts.`,
      ]);
      if (highRating >= 4) {
        friendly += ' ' + pick([
          `The ${effectiveHighTopic} was a nice surprise.`,
          `Did really enjoy the ${effectiveHighTopic} at least!`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        friendly += ' ' + pick([
          `Wasn't too thrilled about the ${effectiveLowTopic} though.`,
          `The ${effectiveLowTopic} could use some love and attention.`,
        ]);
      }
      friendly += ' ' + pick([
        `Not bad, not mind-blowing — might give it another shot sometime.`,
        `Decent enough, curious to see if things improve.`,
      ]);
    } else {
      friendly = pick([
        `Had a tough experience here — wish it went differently.`,
        `Not gonna lie, this visit was a bit of a letdown.`,
        `Wish I had a better time here — it just didn't click.`,
      ]);
      if (lowRating <= 2) {
        friendly += ' ' + pick([
          `The ${effectiveLowTopic} really didn't do it for me.`,
          `The ${effectiveLowTopic} was a real letdown honestly.`,
        ]);
      }
      friendly += ' ' + pick([
        `Hope they work on things — I'd love a reason to come back.`,
        `Hoping things improve because the concept has potential.`,
      ]);
    }
    if (commentPart) friendly += commentPart;
    if (avgRating >= 4 && input.locationArea) {
      friendly += ` If you're around ${input.locationArea}, definitely stop by!`;
    }

    // ─── Heartfelt ────────────────────────────────
    let heartfelt = '';
    if (avgRating >= 4) {
      heartfelt = pick([
        `There's something special about a place that genuinely cares — and you can feel it here.`,
        `I don't usually write reviews, but this experience moved me enough to share.`,
        `Sometimes you visit somewhere and it just stays with you — this was one of those times.`,
      ]);
      if (highRating >= 4) {
        heartfelt += ' ' + pick([
          `The ${effectiveHighTopic} felt like it was crafted with real intention — ${highRating === 5 ? 'the kind of care you rarely find anymore' : 'it clearly matters to them, and it showed'}.`,
          `What struck me most was the ${effectiveHighTopic} — ${highRating === 5 ? 'you could tell someone poured their heart into getting it right' : 'there was a thoughtfulness to it that I appreciated'}.`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        heartfelt += ' ' + pick([
          `If the ${effectiveLowTopic} catches up to the rest, this place will be truly special.`,
          `The only thing holding it back slightly is the ${effectiveLowTopic}, but it's a small note in an otherwise meaningful experience.`,
        ]);
      }
      heartfelt += ' ' + pick([
        `Grateful I found this place — it's the kind of experience that restores your faith.`,
        `This is the kind of place that reminds you why personal touches matter.`,
      ]);
    } else if (avgRating >= 3) {
      heartfelt = pick([
        `I wanted to love this place more than I did — there are glimpses of something really special here.`,
        `There's potential here that's hard to ignore, even if the execution was uneven.`,
      ]);
      if (highRating >= 4) {
        heartfelt += ' ' + pick([
          `The ${effectiveHighTopic} genuinely impressed me and shows what they're capable of.`,
          `When the ${effectiveHighTopic} was on point, I could see the vision clearly.`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        heartfelt += ' ' + pick([
          `But the ${effectiveLowTopic} was honestly disheartening — it felt like an afterthought.`,
          `The ${effectiveLowTopic} let me down and felt disconnected from the care shown elsewhere.`,
        ]);
      }
      heartfelt += ' ' + pick([
        `I'm rooting for them to bring it all together — the foundation is there.`,
        `With some refinement, this could become something truly memorable.`,
      ]);
    } else {
      heartfelt = pick([
        `I had high hopes coming in, which made the disappointment hit harder.`,
        `It's hard to write this because I could see what they were going for — but the execution fell short.`,
      ]);
      if (lowRating <= 2) {
        heartfelt += ' ' + pick([
          `The ${effectiveLowTopic} was where it hurt most — it felt neglected.`,
          `The ${effectiveLowTopic} especially felt like it hadn't been given the care it deserved.`,
        ]);
      }
      if (!sameTopic && highRating >= 3) {
        heartfelt += ' ' + pick([
          `The ${effectiveHighTopic} gave me a glimpse of what could be, which almost makes it more frustrating.`,
          `At least the ${effectiveHighTopic} showed some promise.`,
        ]);
      }
      heartfelt += ' ' + pick([
        `I genuinely hope they take feedback to heart — there's a better version of this place waiting to emerge.`,
        `With the right attention, this could become the place it's clearly trying to be.`,
      ]);
    }
    if (commentPart) heartfelt += commentPart;
    if (avgRating >= 4 && input.locationArea) {
      heartfelt += ` Glad I found this spot in ${input.locationArea}.`;
    }

    return [
      { style: 'PROFESSIONAL', content: professional },
      { style: 'FRIENDLY', content: friendly },
      { style: 'HEARTFELT', content: heartfelt },
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
