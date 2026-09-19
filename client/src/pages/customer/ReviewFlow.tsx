import { useReducer, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import * as reviewApi from '../../services/reviewApi';
import { WelcomePage } from './steps/WelcomePage';
import { RatingPage } from './steps/RatingPage';
import { CommentPage } from './steps/CommentPage';
import { GeneratingPage } from './steps/GeneratingPage';
import { DraftsPage } from './steps/DraftsPage';
import { HandoffPage } from './steps/HandoffPage';
import { ThankYouPage } from './steps/ThankYouPage';

type Step = 'loading' | 'welcome' | 'rating' | 'comment' | 'generating' | 'drafts' | 'handoff' | 'done' | 'error';

interface State {
  step: Step;
  business: any;
  questions: any[];
  sessionToken: string | null;
  businessId: string | null;
  ratings: Record<string, number>;
  comment: string;
  drafts: any[];
  selectedDraftId: string | null;
  editedText: string | null;
  googleReviewUrl: string | null;
  error: string | null;
  isLoading: boolean;
}

type Action =
  | { type: 'SET_BUSINESS'; payload: { business: any; questions: any[] } }
  | { type: 'SET_SESSION'; payload: { sessionToken: string; businessId: string } }
  | { type: 'SET_RATING'; payload: { questionId: string; rating: number } }
  | { type: 'SET_COMMENT'; payload: string }
  | { type: 'SET_STEP'; payload: Step }
  | { type: 'SET_DRAFTS'; payload: any[] }
  | { type: 'SELECT_DRAFT'; payload: { draftId: string; editedText?: string } }
  | { type: 'SET_GOOGLE_URL'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: State = {
  step: 'loading',
  business: null,
  questions: [],
  sessionToken: null,
  businessId: null,
  ratings: {},
  comment: '',
  drafts: [],
  selectedDraftId: null,
  editedText: null,
  googleReviewUrl: null,
  error: null,
  isLoading: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BUSINESS':
      return { ...state, business: action.payload.business, questions: action.payload.questions, step: 'welcome' };
    case 'SET_SESSION':
      return { ...state, sessionToken: action.payload.sessionToken, businessId: action.payload.businessId };
    case 'SET_RATING':
      return { ...state, ratings: { ...state.ratings, [action.payload.questionId]: action.payload.rating } };
    case 'SET_COMMENT':
      return { ...state, comment: action.payload };
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_DRAFTS':
      return { ...state, drafts: action.payload, step: 'drafts' };
    case 'SELECT_DRAFT':
      return { ...state, selectedDraftId: action.payload.draftId, editedText: action.payload.editedText || null };
    case 'SET_GOOGLE_URL':
      return { ...state, googleReviewUrl: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, step: 'error' };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function ReviewFlow() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load business info
  useEffect(() => {
    if (!businessSlug) return;
    reviewApi.getBusinessInfo(businessSlug)
      .then(data => {
        dispatch({ type: 'SET_BUSINESS', payload: data });
        dispatch({ type: 'SET_GOOGLE_URL', payload: data.business.googleReviewUrl || '' });
      })
      .catch(err => {
        dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || 'Business not found' });
      });
  }, [businessSlug]);

  const handleStartSession = async () => {
    if (!businessSlug) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await reviewApi.startSession(businessSlug);
      dispatch({ type: 'SET_SESSION', payload: data });
      dispatch({ type: 'SET_STEP', payload: 'rating' });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || 'Failed to start session' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSetRating = (questionId: string, rating: number) => {
    dispatch({ type: 'SET_RATING', payload: { questionId, rating } });
  };

  const handleSubmitRatings = () => {
    dispatch({ type: 'SET_STEP', payload: 'comment' });
  };

  const handleSubmitFeedback = async (skipComment = false) => {
    if (!businessSlug || !state.sessionToken) return;
    dispatch({ type: 'SET_STEP', payload: 'generating' });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await reviewApi.submitFeedback(businessSlug, {
        sessionToken: state.sessionToken,
        ratings: Object.entries(state.ratings).map(([questionId, rating]) => ({ questionId, rating })),
        comment: skipComment ? undefined : state.comment || undefined,
      });

      const drafts = await reviewApi.generateDrafts(businessSlug, state.sessionToken);
      dispatch({ type: 'SET_DRAFTS', payload: drafts });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || 'Failed to generate drafts' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSelectDraft = async (draftId: string, editedText?: string) => {
    if (!businessSlug || !state.sessionToken) return;
    dispatch({ type: 'SELECT_DRAFT', payload: { draftId, editedText } });

    try {
      await reviewApi.selectDraft(businessSlug, {
        sessionToken: state.sessionToken,
        draftId,
        editedText,
      });
    } catch {
      // Non-blocking
    }

    dispatch({ type: 'SET_STEP', payload: 'handoff' });
  };

  const handleHandoff = async () => {
    if (!businessSlug || !state.sessionToken) return;
    try {
      await reviewApi.recordHandoff(businessSlug, state.sessionToken);
    } catch {
      // Non-blocking
    }
    dispatch({ type: 'SET_STEP', payload: 'done' });
  };

  const selectedDraft = state.drafts.find((d: any) => d.id === state.selectedDraftId);
  const reviewText = state.editedText || selectedDraft?.content || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {state.step === 'loading' && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        )}

        {state.step === 'error' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">😕</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Oops!</h2>
            <p className="text-gray-600">{state.error}</p>
          </div>
        )}

        {state.step === 'welcome' && (
          <WelcomePage
            business={state.business}
            onStart={handleStartSession}
            isLoading={state.isLoading}
          />
        )}

        {state.step === 'rating' && (
          <RatingPage
            questions={state.questions}
            ratings={state.ratings}
            onSetRating={handleSetRating}
            onSubmit={handleSubmitRatings}
          />
        )}

        {state.step === 'comment' && (
          <CommentPage
            comment={state.comment}
            onSetComment={(c) => dispatch({ type: 'SET_COMMENT', payload: c })}
            onSubmit={() => handleSubmitFeedback(false)}
            onSkip={() => handleSubmitFeedback(true)}
          />
        )}

        {state.step === 'generating' && <GeneratingPage />}

        {state.step === 'drafts' && (
          <DraftsPage
            drafts={state.drafts}
            onSelectDraft={handleSelectDraft}
          />
        )}

        {state.step === 'handoff' && (
          <HandoffPage
            reviewText={reviewText}
            googleReviewUrl={state.googleReviewUrl || ''}
            onHandoff={handleHandoff}
          />
        )}

        {state.step === 'done' && (
          <ThankYouPage businessName={state.business?.name} />
        )}
      </div>
    </div>
  );
}
