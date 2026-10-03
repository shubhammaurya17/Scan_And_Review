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
        `Didn't know what to expect going in, but I'm really glad I went.`,
        `This was just what I needed — everything was done right.`,
        `Really happy with how my visit went here.`,
      ]);
      if (highRating >= 4) {
        professional += ' ' + pick([
          `The ${effectiveHighTopic} stood out the most — ${highRating === 5 ? 'honestly one of the best I\'ve come across' : 'definitely better than what I\'m used to'}.`,
          `I was especially happy with the ${effectiveHighTopic} — ${highRating === 5 ? 'they clearly know what they\'re doing' : 'you can tell they care about it'}.`,
          `The ${effectiveHighTopic} ${highRating === 5 ? 'alone would make me come back' : 'was done with real care'}.`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        professional += ' ' + pick([
          `The ${effectiveLowTopic} could be a bit better, but it didn't ruin anything.`,
          `Small thing — the ${effectiveLowTopic} wasn't quite there yet.`,
          `Only thing I'd mention is the ${effectiveLowTopic} could use some work.`,
        ]);
      }
    } else if (avgRating >= 3) {
      professional = pick([
        `It was a bit hit or miss — some things were on point, others not so much.`,
        `Had a mixed time here — parts of it were fine, other parts less so.`,
        `Some things worked, some didn't. It was okay overall.`,
      ]);
      if (highRating >= 4) {
        professional += ' ' + pick([
          `The ${effectiveHighTopic} was the best part by far.`,
          `I did like the ${effectiveHighTopic} — that part was done well.`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        professional += ' ' + pick([
          `But the ${effectiveLowTopic} really needs some work.`,
          `The ${effectiveLowTopic} was a letdown and brought the whole thing down.`,
        ]);
      }
      professional += ' ' + pick([
        `Could be a lot better if they fix a few things.`,
        `There's something here, they just need to iron out the rough spots.`,
      ]);
    } else {
      professional = pick([
        `Left pretty disappointed — it just wasn't what I was hoping for.`,
        `This one didn't work out for me, unfortunately.`,
        `Not the experience I expected — a few things went wrong.`,
      ]);
      if (lowRating <= 2) {
        professional += ' ' + pick([
          `The ${effectiveLowTopic} was the biggest issue for me.`,
          `The ${effectiveLowTopic} really brought the whole thing down.`,
        ]);
      }
      if (!sameTopic && highRating >= 3) {
        professional += ' ' + pick([
          `The ${effectiveHighTopic} was okay, but not enough to make up for the rest.`,
          `At least the ${effectiveHighTopic} was alright.`,
        ]);
      }
      professional += ' ' + pick([
        `They'd need to fix some things before I'd try again.`,
        `Hard to see myself going back unless things change.`,
      ]);
    }
    if (commentPart) professional += commentPart;

    // ─── Friendly ─────────────────────────────────
    let friendly = '';
    if (avgRating >= 4) {
      friendly = pick([
        `So glad I came here — it really made my day!`,
        `Had such a nice time! Everything just clicked.`,
        `Walked in not sure what to expect and left really happy.`,
      ]);
      if (highRating >= 4) {
        friendly += ' ' + pick([
          `The ${effectiveHighTopic} was my favourite part — ${highRating === 5 ? 'seriously so so impressed!' : 'they really nailed it.'}`,
          `Loved the ${effectiveHighTopic} — ${highRating === 5 ? 'it was that thing you keep thinking about later!' : 'you could tell they put effort into it.'}`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        friendly += ' ' + pick([
          `The ${effectiveLowTopic} could be a tiny bit better, but honestly no big deal.`,
          `Only small thing — the ${effectiveLowTopic} wasn't quite as strong, but whatever.`,
        ]);
      }
      friendly += ' ' + pick([
        `Would totally go back!`,
        `Can't wait to come back!`,
        `Already told my friends about it!`,
      ]);
    } else if (avgRating >= 3) {
      friendly = pick([
        `Went the other day — it was fine, nothing crazy.`,
        `Tried this place out recently — had mixed feelings about it.`,
        `It was alright! Some things I liked, some not so much.`,
      ]);
      if (highRating >= 4) {
        friendly += ' ' + pick([
          `The ${effectiveHighTopic} was a nice surprise though.`,
          `I did like the ${effectiveHighTopic} — that was the highlight for me!`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        friendly += ' ' + pick([
          `Wasn't happy with the ${effectiveLowTopic} though.`,
          `The ${effectiveLowTopic} kinda let it down.`,
        ]);
      }
      friendly += ' ' + pick([
        `Might try again sometime and see if it's better.`,
        `Not bad but not rushing back either.`,
      ]);
    } else {
      friendly = pick([
        `Ugh, this one was a miss for me.`,
        `Not gonna lie, I was pretty disappointed.`,
        `Wish it went better — just wasn't my experience.`,
      ]);
      if (lowRating <= 2) {
        friendly += ' ' + pick([
          `The ${effectiveLowTopic} was the main thing that bugged me.`,
          `The ${effectiveLowTopic} just wasn't it.`,
        ]);
      }
      friendly += ' ' + pick([
        `Hope they sort things out — would love a reason to try again.`,
        `Maybe they'll improve, fingers crossed.`,
      ]);
    }
    if (commentPart) friendly += commentPart;

    // ─── Heartfelt ────────────────────────────────
    let heartfelt = '';
    if (avgRating >= 4) {
      heartfelt = pick([
        `You can really tell the people here care about what they do — and that means a lot.`,
        `I don't write reviews often, but this one felt worth sharing.`,
        `Sometimes you go somewhere and it just stays with you — this was one of those times.`,
      ]);
      if (highRating >= 4) {
        heartfelt += ' ' + pick([
          `The ${effectiveHighTopic} really touched me — ${highRating === 5 ? 'you just don\'t see that level of care very often' : 'it clearly matters to them and you can feel it'}.`,
          `What I keep thinking about is the ${effectiveHighTopic} — ${highRating === 5 ? 'someone here really puts their heart into it' : 'there was a warmth to it that I appreciated'}.`,
        ]);
      }
      if (!sameTopic && lowRating <= 3) {
        heartfelt += ' ' + pick([
          `If the ${effectiveLowTopic} gets the same love, this place will be something really special.`,
          `Only thing I'd say is the ${effectiveLowTopic} didn't quite match, but it's a small thing.`,
        ]);
      }
      heartfelt += ' ' + pick([
        `Really glad I found this place.`,
        `This is the kind of place that makes you feel looked after.`,
      ]);
    } else if (avgRating >= 3) {
      heartfelt = pick([
        `I wanted to love this place more than I did — you can see they're trying.`,
        `There's something here, I could feel it, but it wasn't all the way there yet.`,
      ]);
      if (highRating >= 4) {
        heartfelt += ' ' + pick([
          `The ${effectiveHighTopic} really showed me what they're capable of.`,
          `When the ${effectiveHighTopic} was on, I could see exactly what this place could be.`,
        ]);
      }
      if (!sameTopic && lowRating <= 2) {
        heartfelt += ' ' + pick([
          `But the ${effectiveLowTopic} let me down — it felt like it was forgotten about.`,
          `The ${effectiveLowTopic} felt off compared to everything else.`,
        ]);
      }
      heartfelt += ' ' + pick([
        `I'm cheering for them — they just need to bring it all together.`,
        `With a little more effort, this could be really something.`,
      ]);
    } else {
      heartfelt = pick([
        `I had my hopes up, which made it hurt more when it didn't pan out.`,
        `This is hard to write because I could see what they were going for — it just missed.`,
      ]);
      if (lowRating <= 2) {
        heartfelt += ' ' + pick([
          `The ${effectiveLowTopic} was the part that bothered me most — it felt overlooked.`,
          `The ${effectiveLowTopic} needed more care than it got.`,
        ]);
      }
      if (!sameTopic && highRating >= 3) {
        heartfelt += ' ' + pick([
          `The ${effectiveHighTopic} showed a glimpse of what's possible, which almost makes it harder.`,
          `At least the ${effectiveHighTopic} gave me a little hope.`,
        ]);
      }
      heartfelt += ' ' + pick([
        `I really hope they listen to feedback — there's a better version of this place in there.`,
        `With the right changes, this could be the place it wants to be.`,
      ]);
    }
    if (commentPart) heartfelt += commentPart;

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
