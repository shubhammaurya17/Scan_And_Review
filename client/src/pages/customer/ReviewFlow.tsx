import { useReducer, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as reviewApi from '../../services/reviewApi';
import { RatingPage } from './steps/RatingPage';
import { GeneratingPage } from './steps/GeneratingPage';
import { DraftsPage } from './steps/DraftsPage';
import { HandoffPage } from './steps/HandoffPage';
import { ThankYouPage } from './steps/ThankYouPage';
import { RefreshCw } from 'lucide-react';

type Step = 'loading' | 'rating' | 'generating' | 'drafts' | 'handoff' | 'done' | 'error';

const GENERATION_TIMEOUT_MS = 45000; // 45 seconds max for draft generation

interface State {
  step: Step;
  business: any;
  questions: any[];
  sessionToken: string | null;
  businessId: string | null;
  ratings: Record<string, number>;
  drafts: any[];
  selectedDraftId: string | null;
  editedText: string | null;
  googleReviewUrl: string | null;
  error: string | null;
  isLoading: boolean;
  canRetry: boolean;
  retryCount: number;
}

type Action =
  | { type: 'SET_BUSINESS'; payload: { business: any; questions: any[]; sessionToken: string; businessId: string } }
  | { type: 'SET_RATING'; payload: { questionId: string; rating: number } }
  | { type: 'SET_STEP'; payload: Step }
  | { type: 'SET_DRAFTS'; payload: any[] }
  | { type: 'SELECT_DRAFT'; payload: { draftId: string; editedText?: string } }
  | { type: 'SET_GOOGLE_URL'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CAN_RETRY'; payload: boolean }
  | { type: 'INCREMENT_RETRY' };

const MAX_RETRIES = 3;

const initialState: State = {
  step: 'loading',
  business: null,
  questions: [],
  sessionToken: null,
  businessId: null,
  ratings: {},
  drafts: [],
  selectedDraftId: null,
  editedText: null,
  googleReviewUrl: null,
  error: null,
  isLoading: false,
  canRetry: false,
  retryCount: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BUSINESS':
      return {
        ...state,
        business: action.payload.business,
        questions: action.payload.questions,
        sessionToken: action.payload.sessionToken,
        businessId: action.payload.businessId,
        step: 'rating',
      };
    case 'SET_RATING':
      return { ...state, ratings: { ...state.ratings, [action.payload.questionId]: action.payload.rating } };
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_DRAFTS':
      return { ...state, drafts: action.payload, step: 'drafts', canRetry: action.payload.length === 0 };
    case 'SELECT_DRAFT':
      return { ...state, selectedDraftId: action.payload.draftId, editedText: action.payload.editedText || null };
    case 'SET_GOOGLE_URL':
      return { ...state, googleReviewUrl: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, step: 'error', canRetry: state.retryCount < MAX_RETRIES && !!state.sessionToken };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_CAN_RETRY':
      return { ...state, canRetry: action.payload };
    case 'INCREMENT_RETRY':
      return { ...state, retryCount: state.retryCount + 1 };
    default:
      return state;
  }
}

export function ReviewFlow() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [state, dispatch] = useReducer(reducer, initialState);
  const generationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGenerationTimeout = useCallback(() => {
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      generationTimeoutRef.current = null;
    }
  }, []);

  // Safety timeout: if generating takes too long, show error with retry
  useEffect(() => {
    if (state.step === 'generating') {
      generationTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'SET_ERROR', payload: 'This is taking longer than expected. Please try again.' });
        dispatch({ type: 'SET_LOADING', payload: false });
      }, GENERATION_TIMEOUT_MS);
    } else {
      clearGenerationTimeout();
    }
    return clearGenerationTimeout;
  }, [state.step, clearGenerationTimeout]);

  // Load business info AND start session immediately
  useEffect(() => {
    if (!businessSlug) return;

    (async () => {
      try {
        const data = await reviewApi.getBusinessInfo(businessSlug);
        dispatch({ type: 'SET_GOOGLE_URL', payload: data.business.googleReviewUrl || '' });

        // Start session immediately so we go straight to rating
        const sessionData = await reviewApi.startSession(businessSlug);
        dispatch({
          type: 'SET_BUSINESS',
          payload: {
            business: data.business,
            questions: data.questions,
            sessionToken: sessionData.sessionToken,
            businessId: sessionData.businessId,
          },
        });
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || 'Business not found' });
      }
    })();
  }, [businessSlug]);

  const handleSetRating = (questionId: string, rating: number) => {
    dispatch({ type: 'SET_RATING', payload: { questionId, rating } });
  };

  const handleSubmitRatings = async () => {
    if (!businessSlug || !state.sessionToken) return;
    dispatch({ type: 'SET_STEP', payload: 'generating' });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await reviewApi.submitFeedback(businessSlug, {
        sessionToken: state.sessionToken,
        ratings: Object.entries(state.ratings).map(([questionId, rating]) => ({ questionId, rating })),
      });

      const drafts = await reviewApi.generateDrafts(businessSlug, state.sessionToken);
      dispatch({ type: 'SET_DRAFTS', payload: drafts });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || 'Failed to generate drafts' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleRetryDrafts = async () => {
    if (!businessSlug || !state.sessionToken) return;
    dispatch({ type: 'INCREMENT_RETRY' });
    dispatch({ type: 'SET_STEP', payload: 'generating' });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
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
            <p className="text-gray-600 mb-6">{state.error}</p>
            {state.canRetry && (
              <button
                onClick={handleRetryDrafts}
                className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                <RefreshCw size={18} className="mr-2" />
                Try Again
              </button>
            )}
          </div>
        )}

        {state.step === 'rating' && state.business && (
          <RatingPage
            business={state.business}
            questions={state.questions}
            ratings={state.ratings}
            onSetRating={handleSetRating}
            onSubmit={handleSubmitRatings}
            isLoading={state.isLoading}
          />
        )}

        {state.step === 'generating' && <GeneratingPage />}

        {state.step === 'drafts' && (
          <DraftsPage
            drafts={state.drafts}
            onSelectDraft={handleSelectDraft}
            onRetry={handleRetryDrafts}
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
